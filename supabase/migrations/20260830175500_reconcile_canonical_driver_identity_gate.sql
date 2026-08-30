BEGIN;

-- P0-02: canonical Driver identity reconciliation.
-- Approval is the only positive activation event. Missing, mismatched or
-- non-active identity always fails closed using values that actually exist in
-- the production enums.

CREATE OR REPLACE FUNCTION public.enforce_driver_profile_identity_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_identity public.platform_identity_registry%ROWTYPE;
BEGIN
  IF NEW.role IS DISTINCT FROM 'driver' OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_identity
  FROM public.platform_identity_registry i
  WHERE i.user_id = NEW.user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_identity.company_id IS DISTINCT FROM NEW.company_id
       OR v_identity.identity_mode NOT IN ('company_driver', 'owner_driver') THEN
      RAISE EXCEPTION 'Identity conflict: verified Driver identity belongs to another company or mode.'
        USING ERRCODE = '23505';
    END IF;

    IF v_identity.status = 'active' AND v_identity.verified_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    NEW.status := 'pending'::public.user_status;
    RETURN NEW;
  END IF;

  PERFORM public.ensure_company_driver_onboarding(
    NEW.user_id, NEW.company_id, NEW.full_name, NEW.phone
  );
  NEW.status := 'pending'::public.user_status;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_driver_record_identity_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_identity public.platform_identity_registry%ROWTYPE;
BEGIN
  IF NEW.user_id IS NULL OR NEW.company_id IS NULL THEN
    NEW.status := 'inactive'::public.status_enum;
    NEW.is_active := false;
    NEW.app_access := false;
    RETURN NEW;
  END IF;

  SELECT * INTO v_identity
  FROM public.platform_identity_registry i
  WHERE i.user_id = NEW.user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_identity.company_id IS DISTINCT FROM NEW.company_id
       OR v_identity.identity_mode NOT IN ('company_driver', 'owner_driver') THEN
      RAISE EXCEPTION 'Identity conflict: verified Driver identity belongs to another company or mode.'
        USING ERRCODE = '23505';
    END IF;

    IF v_identity.status = 'active' AND v_identity.verified_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    NEW.status := 'inactive'::public.status_enum;
    NEW.is_active := false;
    NEW.app_access := false;
    RETURN NEW;
  END IF;

  PERFORM public.ensure_company_driver_onboarding(
    NEW.user_id, NEW.company_id, NEW.display_name, NEW.phone
  );
  NEW.status := 'inactive'::public.status_enum;
  NEW.is_active := false;
  NEW.app_access := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drivers_identity_gate ON public.drivers;
CREATE TRIGGER trg_drivers_identity_gate
BEFORE INSERT OR UPDATE OF user_id, company_id, status, is_active, app_access
ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_driver_record_identity_gate();

-- Approval remains the sole positive activation path.
CREATE OR REPLACE FUNCTION public.activate_approved_onboarding_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_identity_mode text;
  v_existing public.platform_identity_registry%ROWTYPE;
  v_normalized_name text;
BEGIN
  IF NEW.status <> 'approved' OR COALESCE(OLD.status, '') = 'approved' THEN
    RETURN NEW;
  END IF;

  v_identity_mode := CASE
    WHEN NEW.account_type = 'individual_driver' THEN 'company_driver'
    WHEN NEW.account_type = 'owner_driver' THEN 'owner_driver'
    WHEN NEW.account_type IN ('fleet_courier', 'broker_shipper') THEN 'company_owner'
    ELSE 'company_user'
  END;

  IF v_identity_mode IN ('company_driver', 'owner_driver') AND NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Cannot activate % identity without one linked company.', v_identity_mode
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_existing
  FROM public.platform_identity_registry i
  WHERE i.user_id = NEW.user_id
  FOR UPDATE;

  IF FOUND AND (
    v_existing.identity_mode <> v_identity_mode
    OR v_existing.company_id IS DISTINCT FROM NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Identity conflict: approval would replace another company or identity mode.'
      USING ERRCODE = '23505';
  END IF;

  v_normalized_name := lower(trim(COALESCE(
    NULLIF(NEW.payload->>'full_name', ''),
    NULLIF(NEW.payload->>'contact_person', ''),
    split_part(NEW.email, '@', 1)
  )));

  INSERT INTO public.platform_identity_registry (
    user_id, company_id, identity_mode, legal_name_normalized,
    status, verified_at, verified_by, updated_at
  ) VALUES (
    NEW.user_id, NEW.company_id, v_identity_mode, v_normalized_name,
    'active', now(), COALESCE(NEW.risk_reviewed_by, NEW.reviewed_by), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    identity_mode = EXCLUDED.identity_mode,
    legal_name_normalized = EXCLUDED.legal_name_normalized,
    status = 'active',
    verified_at = now(),
    verified_by = EXCLUDED.verified_by,
    updated_at = now();

  UPDATE public.profiles
  SET status = 'active'::public.user_status,
      company_id = COALESCE(NEW.company_id, company_id),
      updated_at = now()
  WHERE user_id = NEW.user_id;

  IF v_identity_mode IN ('company_driver', 'owner_driver') THEN
    UPDATE public.drivers
    SET status = 'active'::public.status_enum,
        is_active = true,
        app_access = true,
        company_id = NEW.company_id,
        updated_at = now()
    WHERE user_id = NEW.user_id;

    UPDATE public.company_memberships
    SET status = 'active',
        role_in_company = CASE
          WHEN v_identity_mode = 'company_driver' AND role_in_company = 'owner' THEN 'member'
          ELSE role_in_company
        END,
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND company_id = NEW.company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_approved_onboarding_identity
  ON public.onboarding_applications;
CREATE TRIGGER trg_activate_approved_onboarding_identity
AFTER UPDATE OF status ON public.onboarding_applications
FOR EACH ROW
EXECUTE FUNCTION public.activate_approved_onboarding_identity();

-- Identity revocation / hold / ban must immediately remove runtime Driver access.
CREATE OR REPLACE FUNCTION public.fail_close_driver_access_on_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_identity_mode text;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_company_id := OLD.company_id;
    v_identity_mode := OLD.identity_mode;
    v_status := 'closed';
  ELSE
    v_user_id := NEW.user_id;
    v_company_id := NEW.company_id;
    v_identity_mode := NEW.identity_mode;
    v_status := NEW.status;
  END IF;

  IF v_identity_mode NOT IN ('company_driver', 'owner_driver') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' OR v_status <> 'active' THEN
    UPDATE public.profiles
    SET status = 'pending'::public.user_status,
        updated_at = now()
    WHERE user_id = v_user_id AND role = 'driver';

    UPDATE public.company_memberships
    SET status = 'invited', updated_at = now()
    WHERE user_id = v_user_id
      AND company_id = v_company_id
      AND status = 'active';

    UPDATE public.drivers
    SET status = 'inactive'::public.status_enum,
        is_active = false,
        app_access = false,
        updated_at = now()
    WHERE user_id = v_user_id AND company_id = v_company_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.fail_close_driver_access_on_identity_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_close_driver_access_on_identity_change() FROM anon;
REVOKE ALL ON FUNCTION public.fail_close_driver_access_on_identity_change() FROM authenticated;

DROP TRIGGER IF EXISTS trg_fail_close_driver_access_on_identity_update
  ON public.platform_identity_registry;
CREATE TRIGGER trg_fail_close_driver_access_on_identity_update
AFTER UPDATE OF status, company_id, identity_mode
ON public.platform_identity_registry
FOR EACH ROW
EXECUTE FUNCTION public.fail_close_driver_access_on_identity_change();

DROP TRIGGER IF EXISTS trg_fail_close_driver_access_on_identity_delete
  ON public.platform_identity_registry;
CREATE TRIGGER trg_fail_close_driver_access_on_identity_delete
AFTER DELETE ON public.platform_identity_registry
FOR EACH ROW
EXECUTE FUNCTION public.fail_close_driver_access_on_identity_change();

-- Conservative backfill: create a missing canonical Driver identity only when an
-- already-approved, risk-clear and fully compliant onboarding proves it.
DO $$
DECLARE
  v_app record;
  v_expected_mode text;
  v_missing integer;
BEGIN
  FOR v_app IN
    SELECT oa.*
    FROM public.onboarding_applications oa
    JOIN public.companies c
      ON c.id = oa.company_id AND c.status::text = 'active'
    JOIN public.drivers d
      ON d.user_id = oa.user_id AND d.company_id = oa.company_id
    JOIN public.profiles p
      ON p.user_id = oa.user_id AND p.role = 'driver' AND p.company_id = oa.company_id
    JOIN public.company_memberships cm
      ON cm.user_id = oa.user_id AND cm.company_id = oa.company_id AND cm.status = 'active'
    WHERE oa.account_type IN ('owner_driver', 'individual_driver')
      AND oa.status = 'approved'
      AND oa.risk_status = 'clear'
    ORDER BY oa.created_at, oa.id
  LOOP
    v_expected_mode := CASE WHEN v_app.account_type = 'owner_driver'
      THEN 'owner_driver' ELSE 'company_driver' END;

    SELECT count(*) INTO v_missing
    FROM public.get_missing_onboarding_documents(v_app.id);
    IF v_missing <> 0 THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.platform_identity_registry i
      WHERE i.user_id = v_app.user_id
        AND (i.company_id IS DISTINCT FROM v_app.company_id
             OR i.identity_mode IS DISTINCT FROM v_expected_mode)
    ) THEN
      RAISE EXCEPTION 'Historical identity conflict for approved Driver user %.', v_app.user_id
        USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.platform_identity_registry (
      user_id, company_id, identity_mode, legal_name_normalized,
      status, verified_at, verified_by, updated_at
    )
    SELECT
      v_app.user_id,
      v_app.company_id,
      v_expected_mode,
      lower(trim(COALESCE(
        NULLIF(v_app.payload->>'full_name', ''),
        NULLIF(v_app.payload->>'contact_person', ''),
        split_part(v_app.email, '@', 1)
      ))),
      'active',
      COALESCE(v_app.reviewed_at, v_app.updated_at, now()),
      COALESCE(v_app.risk_reviewed_by, v_app.reviewed_by),
      now()
    WHERE NOT EXISTS (
      SELECT 1 FROM public.platform_identity_registry i WHERE i.user_id = v_app.user_id
    );
  END LOOP;
END;
$$;

-- Historical records without an active verified identity remain stored, but are
-- not operationally active. These statements do not approve anyone.
UPDATE public.profiles p
SET status = 'pending'::public.user_status, updated_at = now()
WHERE p.role = 'driver'
  AND p.company_id IS NOT NULL
  AND NOT public.identity_registry_allows_driver_access(p.user_id, p.company_id);

UPDATE public.company_memberships cm
SET status = 'invited', updated_at = now()
WHERE cm.status = 'active'
  AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.user_id = cm.user_id AND p.role = 'driver'
  )
  AND NOT public.identity_registry_allows_driver_access(cm.user_id, cm.company_id);

UPDATE public.drivers d
SET status = 'inactive'::public.status_enum,
    is_active = false,
    app_access = false,
    updated_at = now()
WHERE NOT public.identity_registry_allows_driver_access(d.user_id, d.company_id);

-- Final invariant: operational Driver authority may never exist without an
-- active verified canonical Driver identity.
DO $$
DECLARE
  v_driver_access integer;
  v_driver_active integer;
  v_profile_active integer;
  v_membership_active integer;
  v_approved_missing integer;
BEGIN
  SELECT count(*) INTO v_driver_access
  FROM public.drivers d
  WHERE d.app_access = true
    AND NOT public.identity_registry_allows_driver_access(d.user_id, d.company_id);

  SELECT count(*) INTO v_driver_active
  FROM public.drivers d
  WHERE (d.status::text = 'active' OR d.is_active = true)
    AND NOT public.identity_registry_allows_driver_access(d.user_id, d.company_id);

  SELECT count(*) INTO v_profile_active
  FROM public.profiles p
  WHERE p.role = 'driver' AND p.company_id IS NOT NULL AND p.status::text = 'active'
    AND NOT public.identity_registry_allows_driver_access(p.user_id, p.company_id);

  SELECT count(*) INTO v_membership_active
  FROM public.company_memberships cm
  JOIN public.profiles p ON p.user_id = cm.user_id AND p.role = 'driver'
  WHERE cm.status = 'active'
    AND NOT public.identity_registry_allows_driver_access(cm.user_id, cm.company_id);

  SELECT count(*) INTO v_approved_missing
  FROM public.onboarding_applications oa
  JOIN public.companies c ON c.id = oa.company_id AND c.status::text = 'active'
  JOIN public.drivers d ON d.user_id = oa.user_id AND d.company_id = oa.company_id
  JOIN public.profiles p ON p.user_id = oa.user_id AND p.role = 'driver' AND p.company_id = oa.company_id
  JOIN public.company_memberships cm ON cm.user_id = oa.user_id AND cm.company_id = oa.company_id AND cm.status = 'active'
  WHERE oa.account_type IN ('owner_driver', 'individual_driver')
    AND oa.status = 'approved'
    AND oa.risk_status = 'clear'
    AND NOT EXISTS (SELECT 1 FROM public.get_missing_onboarding_documents(oa.id))
    AND NOT public.identity_registry_allows_driver_access(oa.user_id, oa.company_id);

  IF v_driver_access <> 0 OR v_driver_active <> 0 OR v_profile_active <> 0
     OR v_membership_active <> 0 OR v_approved_missing <> 0 THEN
    RAISE EXCEPTION
      'Driver identity invariant failed: app_access=%, driver_active=%, profile_active=%, membership_active=%, approved_missing=%',
      v_driver_access, v_driver_active, v_profile_active, v_membership_active, v_approved_missing;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
