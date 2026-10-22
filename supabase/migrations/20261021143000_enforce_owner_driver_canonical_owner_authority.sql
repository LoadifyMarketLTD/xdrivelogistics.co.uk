BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Canonical invariant:
-- A verified Owner Driver owns exactly the company bound to the approved
-- owner_driver onboarding application. That authority is persisted as an
-- active company_memberships.role_in_company = 'owner', while the same user
-- also retains the driver execution identity in public.drivers.
--
-- This deliberately does not infer ownership from metadata or driver_type
-- alone. Authority requires all canonical bindings to agree.

CREATE OR REPLACE FUNCTION public.is_verified_owner_driver_company_owner(
  p_user_id uuid,
  p_company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    JOIN public.companies c
      ON c.id = oa.company_id
    JOIN public.profiles p
      ON p.user_id = oa.user_id
    JOIN public.drivers d
      ON d.user_id = oa.user_id
     AND d.company_id = oa.company_id
    WHERE oa.user_id = p_user_id
      AND oa.company_id = p_company_id
      AND oa.account_type::text = 'owner_driver'
      AND oa.status::text = 'approved'
      AND c.created_by = p_user_id
      AND c.status::text = 'active'
      AND p.company_id = p_company_id
      AND COALESCE(p.status::text, '') = 'active'
      AND COALESCE(d.driver_type::text, '') = 'owner_driver'
      AND COALESCE(d.status::text, '') = 'active'
      AND COALESCE(d.is_active, false) = true
  );
$function$;

REVOKE ALL ON FUNCTION public.is_verified_owner_driver_company_owner(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_verified_owner_driver_company_owner(uuid, uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_verified_owner_driver_membership_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF public.is_verified_owner_driver_company_owner(NEW.user_id, NEW.company_id) THEN
    NEW.role_in_company := 'owner';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_verified_owner_driver_membership_role()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_verified_owner_driver_membership_role()
  TO service_role;

DROP TRIGGER IF EXISTS trg_enforce_verified_owner_driver_membership_role
  ON public.company_memberships;

CREATE TRIGGER trg_enforce_verified_owner_driver_membership_role
BEFORE INSERT OR UPDATE OF user_id, company_id, role_in_company
ON public.company_memberships
FOR EACH ROW
EXECUTE FUNCTION public.enforce_verified_owner_driver_membership_role();

CREATE OR REPLACE FUNCTION public.protect_verified_owner_driver_membership_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF public.is_verified_owner_driver_company_owner(OLD.user_id, OLD.company_id) THEN
    RAISE EXCEPTION
      'Verified Owner Driver ownership membership cannot be deleted while the owner, company and driver identity remain active.'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$function$;

REVOKE ALL ON FUNCTION public.protect_verified_owner_driver_membership_delete()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_verified_owner_driver_membership_delete()
  TO service_role;

DROP TRIGGER IF EXISTS trg_protect_verified_owner_driver_membership_delete
  ON public.company_memberships;

CREATE TRIGGER trg_protect_verified_owner_driver_membership_delete
BEFORE DELETE
ON public.company_memberships
FOR EACH ROW
EXECUTE FUNCTION public.protect_verified_owner_driver_membership_delete();

-- Approval boundary: preserve existing roles for non-owner-driver company users,
-- but never preserve a downgraded role for a verified Owner Driver.
CREATE OR REPLACE FUNCTION public.review_onboarding_application_atomic_authority_base_v1(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(onboarding_application_id uuid, status text, company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_user_id uuid;
  v_account_type text;
  v_existing_membership_role text;
  v_company_creator uuid;
BEGIN
  SELECT oa.company_id, oa.user_id, oa.account_type::text
    INTO v_company_id, v_user_id, v_account_type
  FROM public.onboarding_applications oa
  WHERE oa.id = p_application_id;

  IF p_action = 'approve' AND v_company_id IS NOT NULL THEN
    SELECT cm.role_in_company::text
      INTO v_existing_membership_role
    FROM public.company_memberships cm
    WHERE cm.company_id = v_company_id
      AND cm.user_id = v_user_id
      AND cm.status::text = 'active'
    LIMIT 1;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.review_onboarding_application_atomic_authority_base_v1_legacy_20260927(
    p_application_id,
    p_actor_user_id,
    p_action,
    p_notes
  );

  IF p_action <> 'approve' OR v_company_id IS NULL THEN
    RETURN;
  END IF;

  IF v_account_type = 'owner_driver' THEN
    SELECT c.created_by
      INTO v_company_creator
    FROM public.companies c
    WHERE c.id = v_company_id;

    IF v_company_creator IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION
        'Owner Driver authority mismatch: the approved onboarding company is not owned by this user.'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.profiles
    SET company_id = v_company_id,
        role = 'driver',
        is_driver = true,
        updated_at = now()
    WHERE user_id = v_user_id;

    UPDATE public.drivers
    SET company_id = v_company_id,
        driver_type = 'owner_driver',
        status = 'active',
        is_active = true,
        app_access = true,
        can_commercial_bid = true,
        updated_at = now()
    WHERE user_id = v_user_id;

    INSERT INTO public.company_memberships (
      company_id,
      user_id,
      invited_email,
      role_in_company,
      status,
      updated_at
    )
    SELECT
      v_company_id,
      v_user_id,
      oa.email,
      'owner',
      'active',
      now()
    FROM public.onboarding_applications oa
    WHERE oa.id = p_application_id
    ON CONFLICT ON CONSTRAINT company_memberships_company_id_user_id_key
    DO UPDATE SET
      invited_email = COALESCE(EXCLUDED.invited_email, public.company_memberships.invited_email),
      role_in_company = 'owner',
      status = 'active',
      updated_at = now();

    IF NOT public.is_verified_owner_driver_company_owner(v_user_id, v_company_id) THEN
      RAISE EXCEPTION
        'Owner Driver approval did not produce a canonical owner + driver company identity.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF v_existing_membership_role IS NOT NULL THEN
    UPDATE public.company_memberships cm
    SET role_in_company = v_existing_membership_role,
        updated_at = now()
    WHERE cm.company_id = v_company_id
      AND cm.user_id = v_user_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic_authority_base_v1(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Safe compatibility RPC used by auth resolution. It never creates authority
-- from metadata alone: it repairs only an already-approved, explicitly-bound
-- Owner Driver company relationship.
CREATE OR REPLACE FUNCTION public.bootstrap_owner_driver_workspace()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user is required.' USING ERRCODE = '42501';
  END IF;

  SELECT oa.company_id
    INTO v_company_id
  FROM public.onboarding_applications oa
  JOIN public.companies c
    ON c.id = oa.company_id
   AND c.created_by = oa.user_id
   AND c.status::text = 'active'
  JOIN public.profiles p
    ON p.user_id = oa.user_id
   AND COALESCE(p.status::text, '') = 'active'
  WHERE oa.user_id = v_user_id
    AND oa.account_type::text = 'owner_driver'
    AND oa.status::text = 'approved'
    AND oa.company_id IS NOT NULL
  ORDER BY oa.reviewed_at DESC NULLS LAST, oa.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION
      'Approved canonical Owner Driver company binding is required.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET company_id = v_company_id,
      role = 'driver',
      is_driver = true,
      updated_at = now()
  WHERE user_id = v_user_id;

  UPDATE public.drivers
  SET company_id = v_company_id,
      driver_type = 'owner_driver',
      status = 'active',
      is_active = true,
      app_access = true,
      can_commercial_bid = true,
      updated_at = now()
  WHERE user_id = v_user_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.user_id = v_user_id
      AND d.company_id = v_company_id
      AND d.driver_type::text = 'owner_driver'
      AND COALESCE(d.status::text, '') = 'active'
      AND COALESCE(d.is_active, false) = true
  ) THEN
    RAISE EXCEPTION
      'Canonical Owner Driver record is missing; authority cannot be bootstrapped.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.company_memberships (
    company_id,
    user_id,
    role_in_company,
    status,
    updated_at
  )
  VALUES (
    v_company_id,
    v_user_id,
    'owner',
    'active',
    now()
  )
  ON CONFLICT ON CONSTRAINT company_memberships_company_id_user_id_key
  DO UPDATE SET
    role_in_company = 'owner',
    status = 'active',
    updated_at = now();

  IF NOT public.is_verified_owner_driver_company_owner(v_user_id, v_company_id) THEN
    RAISE EXCEPTION
      'Owner Driver bootstrap failed canonical identity verification.'
      USING ERRCODE = '23514';
  END IF;

  RETURN v_company_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.bootstrap_owner_driver_workspace()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_owner_driver_workspace()
  TO authenticated, service_role;

-- Repair existing verified Owner Drivers only when every canonical identity
-- binding already agrees. This upgrades authority; it never guesses ownership.
UPDATE public.company_memberships cm
SET role_in_company = 'owner',
    status = 'active',
    updated_at = now()
FROM public.onboarding_applications oa
JOIN public.companies c
  ON c.id = oa.company_id
 AND c.created_by = oa.user_id
 AND c.status::text = 'active'
JOIN public.profiles p
  ON p.user_id = oa.user_id
 AND p.company_id = oa.company_id
 AND COALESCE(p.status::text, '') = 'active'
JOIN public.drivers d
  ON d.user_id = oa.user_id
 AND d.company_id = oa.company_id
 AND d.driver_type::text = 'owner_driver'
 AND COALESCE(d.status::text, '') = 'active'
 AND COALESCE(d.is_active, false) = true
WHERE oa.account_type::text = 'owner_driver'
  AND oa.status::text = 'approved'
  AND cm.user_id = oa.user_id
  AND cm.company_id = oa.company_id
  AND (
    cm.role_in_company::text <> 'owner'
    OR cm.status::text <> 'active'
  );

DO $verify$
DECLARE
  v_invalid_count integer;
BEGIN
  SELECT count(*)
    INTO v_invalid_count
  FROM public.onboarding_applications oa
  JOIN public.companies c
    ON c.id = oa.company_id
   AND c.created_by = oa.user_id
   AND c.status::text = 'active'
  JOIN public.profiles p
    ON p.user_id = oa.user_id
   AND p.company_id = oa.company_id
   AND COALESCE(p.status::text, '') = 'active'
  JOIN public.drivers d
    ON d.user_id = oa.user_id
   AND d.company_id = oa.company_id
   AND d.driver_type::text = 'owner_driver'
   AND COALESCE(d.status::text, '') = 'active'
   AND COALESCE(d.is_active, false) = true
  LEFT JOIN public.company_memberships cm
    ON cm.user_id = oa.user_id
   AND cm.company_id = oa.company_id
   AND cm.status::text = 'active'
   AND cm.role_in_company::text = 'owner'
  WHERE oa.account_type::text = 'owner_driver'
    AND oa.status::text = 'approved'
    AND cm.id IS NULL;

  IF v_invalid_count <> 0 THEN
    RAISE EXCEPTION
      'Owner Driver authority invariant failed for % verified account(s).',
      v_invalid_count
      USING ERRCODE = '23514';
  END IF;
END;
$verify$;

NOTIFY pgrst, 'reload schema';
COMMIT;
