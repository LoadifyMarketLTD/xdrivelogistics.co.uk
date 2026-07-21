BEGIN;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY driver_id, doc_type
      ORDER BY
        (file_path IS NOT NULL) DESC,
        (status = 'approved') DESC,
        verified_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS position
  FROM public.driver_documents
)
DELETE FROM public.driver_documents target
USING ranked
WHERE target.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS driver_documents_driver_type_uidx
  ON public.driver_documents (driver_id, doc_type);

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY company_id, user_id
      ORDER BY
        (status = 'active') DESC,
        COALESCE(app_access, false) DESC,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS position
  FROM public.drivers
  WHERE user_id IS NOT NULL
)
DELETE FROM public.drivers target
USING ranked
WHERE target.id = ranked.id
  AND ranked.position > 1
  AND NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.assigned_driver_id = target.id)
  AND NOT EXISTS (SELECT 1 FROM public.vehicles v WHERE v.assigned_driver_id = target.id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.drivers
    WHERE user_id IS NOT NULL
    GROUP BY company_id, user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate company/user driver identities require explicit reassignment.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'drivers_company_user_unique'
      AND conrelid = 'public.drivers'::regclass
  ) THEN
    ALTER TABLE public.drivers
      ADD CONSTRAINT drivers_company_user_unique UNIQUE (company_id, user_id);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.rotate_fleet_driver_invitation_token(
  p_invitation_id uuid,
  p_actor_user_id uuid,
  p_force boolean DEFAULT false
)
RETURNS TABLE (
  invitation_id uuid,
  raw_token text,
  expires_at timestamptz,
  last_sent_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.fleet_driver_invitations%ROWTYPE;
  v_raw_token text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invitation
  FROM public.fleet_driver_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fleet driver invitation not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT p_force AND v_invitation.last_sent_at > now() - interval '60 seconds' THEN
    RAISE EXCEPTION 'Invitation resend is rate limited.' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    WHERE cm.company_id = v_invitation.company_id
      AND cm.user_id = p_actor_user_id
      AND cm.status = 'active'
      AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
  ) THEN
    RAISE EXCEPTION 'Actor is not authorised for this company.' USING ERRCODE = '42501';
  END IF;

  v_raw_token := encode(gen_random_bytes(32), 'hex');

  UPDATE public.fleet_driver_invitations fdi
  SET token_hash = encode(digest(v_raw_token, 'sha256'), 'hex'),
      status = 'invited',
      expires_at = now() + interval '48 hours',
      last_sent_at = now(),
      accepted_at = NULL,
      approved_at = NULL,
      approved_by = NULL,
      revoked_at = NULL,
      revoked_by = NULL,
      updated_at = now()
  WHERE fdi.id = p_invitation_id
  RETURNING fdi.id, fdi.expires_at, fdi.last_sent_at
  INTO invitation_id, expires_at, last_sent_at;

  raw_token := v_raw_token;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.fleet_driver_compliance_current(p_driver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.fleet_driver_invitations%ROWTYPE;
  v_required_docs text[] := ARRAY['driving_licence', 'proof_of_address', 'right_to_work'];
BEGIN
  IF p_driver_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_invitation
  FROM public.fleet_driver_invitations
  WHERE driver_id = p_driver_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF v_invitation.status <> 'approved'
     OR v_invitation.accepted_at IS NULL
     OR v_invitation.approved_at IS NULL THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM unnest(v_required_docs) required(doc_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.driver_documents dd
      WHERE dd.driver_id = p_driver_id
        AND dd.doc_type = required.doc_type
        AND dd.file_path IS NOT NULL
        AND dd.status = 'approved'
        AND (dd.expiry_date IS NULL OR dd.expiry_date >= current_date)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_driver_access_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_driver_approved boolean := false;
  v_fleet_invitation_exists boolean := false;
  v_fleet_access_allowed boolean := false;
BEGIN
  IF COALESCE(NEW.app_access, false) IS NOT TRUE OR COALESCE(NEW.status, '') <> 'active' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.onboarding_applications oa
      WHERE oa.user_id = NEW.user_id
        AND oa.account_type = 'owner_driver'
        AND oa.status = 'approved'
    ) INTO v_owner_driver_approved;
  END IF;

  IF v_owner_driver_approved
     AND public.owner_driver_compliance_current(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.fleet_driver_invitations fdi WHERE fdi.driver_id = NEW.id
  ), public.fleet_driver_compliance_current(NEW.id)
  INTO v_fleet_invitation_exists, v_fleet_access_allowed;

  IF v_fleet_invitation_exists AND v_fleet_access_allowed THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.status, '') = 'active'
     AND COALESCE(OLD.app_access, false) IS TRUE
     AND NOT v_fleet_invitation_exists
     AND NOT v_owner_driver_approved THEN
    RETURN NEW;
  END IF;

  NEW.status := 'invited';
  NEW.app_access := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_driver_access_activation ON public.drivers;
CREATE TRIGGER trg_guard_driver_access_activation
BEFORE INSERT OR UPDATE OF status, app_access, user_id
ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.guard_driver_access_activation();

CREATE OR REPLACE FUNCTION public.guard_fleet_driver_membership_activation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver_id uuid;
BEGIN
  IF NEW.role_in_company NOT IN ('driver', 'member') OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT d.id INTO v_driver_id
  FROM public.drivers d
  WHERE d.company_id = NEW.company_id
    AND d.user_id = NEW.user_id
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF v_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.fleet_driver_compliance_current(v_driver_id)
     AND EXISTS (
       SELECT 1 FROM public.fleet_driver_invitations fdi
       WHERE fdi.driver_id = v_driver_id AND fdi.status = 'approved'
     ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'active'
     AND NOT EXISTS (
       SELECT 1 FROM public.fleet_driver_invitations fdi WHERE fdi.driver_id = v_driver_id
     ) THEN
    RETURN NEW;
  END IF;

  NEW.status := 'invited';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_fleet_driver_membership_activation ON public.company_memberships;
CREATE TRIGGER trg_guard_fleet_driver_membership_activation
BEFORE INSERT OR UPDATE OF status, role_in_company, user_id, company_id
ON public.company_memberships
FOR EACH ROW
EXECUTE FUNCTION public.guard_fleet_driver_membership_activation();

CREATE OR REPLACE FUNCTION public.sync_fleet_driver_document_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver_id uuid;
  v_access_allowed boolean;
BEGIN
  v_driver_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.driver_id ELSE NEW.driver_id END;

  IF EXISTS (
    SELECT 1 FROM public.fleet_driver_invitations fdi WHERE fdi.driver_id = v_driver_id
  ) THEN
    v_access_allowed := public.fleet_driver_compliance_current(v_driver_id);

    UPDATE public.drivers
    SET app_access = v_access_allowed,
        updated_at = now()
    WHERE id = v_driver_id;

    IF NOT v_access_allowed THEN
      UPDATE public.company_memberships cm
      SET status = 'invited',
          updated_at = now()
      FROM public.drivers d
      WHERE d.id = v_driver_id
        AND cm.company_id = d.company_id
        AND cm.user_id = d.user_id
        AND cm.role_in_company IN ('driver', 'member')
        AND cm.status = 'active';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_fleet_driver_document_access ON public.driver_documents;
CREATE TRIGGER trg_sync_fleet_driver_document_access
AFTER INSERT OR UPDATE OF file_path, status, expiry_date OR DELETE
ON public.driver_documents
FOR EACH ROW
EXECUTE FUNCTION public.sync_fleet_driver_document_access();

CREATE OR REPLACE FUNCTION public.current_user_driver_access_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.user_id = auth.uid()
      AND d.status = 'active'
      AND d.app_access IS TRUE
      AND public.owner_driver_compliance_current(d.user_id)
      AND public.fleet_driver_compliance_current(d.id)
  );
$$;

CREATE OR REPLACE FUNCTION public.guard_job_driver_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
BEGIN
  IF NEW.assigned_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.assigned_driver_id IS NOT DISTINCT FROM OLD.assigned_driver_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_driver FROM public.drivers WHERE id = NEW.assigned_driver_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assigned driver does not exist.' USING ERRCODE = '23503';
  END IF;

  IF COALESCE(v_driver.status, '') <> 'active'
     OR COALESCE(v_driver.app_access, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Driver is not approved for application access and cannot be assigned.' USING ERRCODE = '23514';
  END IF;

  IF v_driver.user_id IS NOT NULL
     AND NOT public.owner_driver_compliance_current(v_driver.user_id) THEN
    RAISE EXCEPTION 'Owner-driver compliance is missing, unverified or expired.' USING ERRCODE = '23514';
  END IF;

  IF NOT public.fleet_driver_compliance_current(v_driver.id) THEN
    RAISE EXCEPTION 'Fleet-driver invitation or compliance is incomplete or expired.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_job_driver_assignment ON public.jobs;
CREATE TRIGGER trg_guard_job_driver_assignment
BEFORE INSERT OR UPDATE OF assigned_driver_id
ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.guard_job_driver_assignment();

CREATE OR REPLACE FUNCTION public.approve_fleet_driver_invitation(
  p_invitation_id uuid,
  p_actor_user_id uuid
)
RETURNS public.fleet_driver_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.fleet_driver_invitations%ROWTYPE;
  v_required_docs text[] := ARRAY['driving_licence', 'proof_of_address', 'right_to_work'];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invitation
  FROM public.fleet_driver_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fleet driver invitation not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.company_id = v_invitation.company_id
      AND cm.user_id = p_actor_user_id
      AND cm.status = 'active'
      AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
  ) THEN
    RAISE EXCEPTION 'Actor is not authorised for this company.' USING ERRCODE = '42501';
  END IF;

  IF v_invitation.status <> 'accepted' OR v_invitation.accepted_at IS NULL THEN
    RAISE EXCEPTION 'Invitation must be accepted before approval.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_required_docs) required(doc_type)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.driver_documents dd
      WHERE dd.driver_id = v_invitation.driver_id
        AND dd.doc_type = required.doc_type
        AND dd.file_path IS NOT NULL
        AND dd.status = 'approved'
        AND (dd.expiry_date IS NULL OR dd.expiry_date >= current_date)
    )
  ) THEN
    RAISE EXCEPTION 'Required driver documents are missing, unapproved or expired.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.fleet_driver_invitations
  SET status = 'approved',
      approved_at = now(),
      approved_by = p_actor_user_id,
      token_hash = NULL,
      updated_at = now()
  WHERE id = p_invitation_id
  RETURNING * INTO v_invitation;

  UPDATE public.drivers
  SET status = 'active',
      app_access = true,
      must_change_password = false,
      updated_at = now()
  WHERE id = v_invitation.driver_id
    AND company_id = v_invitation.company_id
    AND user_id = v_invitation.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fleet driver record is missing or belongs to another tenant.' USING ERRCODE = '23503';
  END IF;

  UPDATE public.company_memberships
  SET role_in_company = 'driver',
      status = 'active',
      invited_email = v_invitation.invited_email,
      updated_at = now()
  WHERE company_id = v_invitation.company_id
    AND user_id = v_invitation.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fleet driver membership is missing.' USING ERRCODE = '23503';
  END IF;

  UPDATE public.profiles
  SET role = 'driver',
      status = 'active',
      is_driver = true,
      updated_at = now()
  WHERE user_id = v_invitation.user_id;

  RETURN v_invitation;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_fleet_driver_invitation(
  p_invitation_id uuid,
  p_actor_user_id uuid
)
RETURNS public.fleet_driver_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.fleet_driver_invitations%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invitation
  FROM public.fleet_driver_invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fleet driver invitation not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_memberships cm
    WHERE cm.company_id = v_invitation.company_id
      AND cm.user_id = p_actor_user_id
      AND cm.status = 'active'
      AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
  ) THEN
    RAISE EXCEPTION 'Actor is not authorised for this company.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.fleet_driver_invitations
  SET status = 'revoked',
      token_hash = NULL,
      revoked_at = now(),
      revoked_by = p_actor_user_id,
      approved_at = NULL,
      approved_by = NULL,
      updated_at = now()
  WHERE id = p_invitation_id
  RETURNING * INTO v_invitation;

  UPDATE public.drivers
  SET status = 'suspended',
      app_access = false,
      updated_at = now()
  WHERE id = v_invitation.driver_id;

  UPDATE public.company_memberships
  SET status = 'suspended',
      updated_at = now()
  WHERE company_id = v_invitation.company_id
    AND user_id = v_invitation.user_id
    AND role_in_company IN ('driver', 'member');

  RETURN v_invitation;
END;
$$;

CREATE OR REPLACE FUNCTION public.bridge_legacy_fleet_driver_invitation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_created_by uuid;
BEGIN
  IF NEW.role_in_company NOT IN ('driver', 'member')
     OR NEW.status <> 'invited'
     OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers d
  WHERE d.company_id = NEW.company_id
    AND d.user_id = NEW.user_id
  ORDER BY d.created_at DESC
  LIMIT 1;

  IF NOT FOUND OR EXISTS (
    SELECT 1 FROM public.fleet_driver_invitations fdi WHERE fdi.driver_id = v_driver.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
    c.created_by,
    (
      SELECT cm.user_id
      FROM public.company_memberships cm
      WHERE cm.company_id = NEW.company_id
        AND cm.status = 'active'
        AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
      ORDER BY CASE cm.role_in_company WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,
               cm.created_at
      LIMIT 1
    )
  ) INTO v_created_by
  FROM public.companies c
  WHERE c.id = NEW.company_id;

  IF v_created_by IS NULL THEN
    RAISE EXCEPTION 'Cannot create fleet driver invitation without a company operator.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.fleet_driver_invitations (
    company_id, driver_id, user_id, invited_email, token_hash,
    status, expires_at, last_sent_at, created_by
  ) VALUES (
    NEW.company_id, v_driver.id, NEW.user_id,
    lower(trim(COALESCE(NEW.invited_email, v_driver.email))),
    NULL, 'invited', now() + interval '48 hours', now(), v_created_by
  )
  ON CONFLICT (driver_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_legacy_fleet_driver_invitation ON public.company_memberships;
CREATE TRIGGER trg_bridge_legacy_fleet_driver_invitation
AFTER INSERT OR UPDATE OF status, role_in_company, user_id, company_id, invited_email
ON public.company_memberships
FOR EACH ROW
EXECUTE FUNCTION public.bridge_legacy_fleet_driver_invitation();

REVOKE ALL ON FUNCTION public.rotate_fleet_driver_invitation_token(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fleet_driver_compliance_current(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.approve_fleet_driver_invitation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_fleet_driver_invitation(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_driver_access_activation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_fleet_driver_membership_activation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_fleet_driver_document_access() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bridge_legacy_fleet_driver_invitation() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.rotate_fleet_driver_invitation_token(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.fleet_driver_compliance_current(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.approve_fleet_driver_invitation(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_fleet_driver_invitation(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_driver_access_allowed() TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.rotate_fleet_driver_invitation_token(uuid,uuid,boolean)') IS NULL
     OR to_regprocedure('public.approve_fleet_driver_invitation(uuid,uuid)') IS NULL
     OR to_regprocedure('public.revoke_fleet_driver_invitation(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Fleet Driver runtime reconciliation failed.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
