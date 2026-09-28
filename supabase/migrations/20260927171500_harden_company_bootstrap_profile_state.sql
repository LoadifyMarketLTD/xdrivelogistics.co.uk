BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Company context repair is a privileged compatibility path. It may only run
-- for an active authenticated profile; inactive/pending profiles must not gain
-- or recover tenant authority through SECURITY DEFINER execution.
CREATE OR REPLACE FUNCTION public.get_or_create_company_for_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_membership public.company_memberships%ROWTYPE;
  v_active_membership_count integer := 0;
  v_membership_count integer := 0;
  v_company_id uuid;
  v_company_status text;
  v_onboarding_approved boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user is required to resolve company context.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = v_user_id
      AND COALESCE(p.status::text, '') = 'active'
  ) THEN
    RAISE EXCEPTION 'Active profile is required to resolve company context.'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    count(*) FILTER (WHERE cm.status::text = 'active'),
    count(*)
  INTO
    v_active_membership_count,
    v_membership_count
  FROM public.company_memberships cm
  WHERE cm.user_id = v_user_id;

  IF v_active_membership_count > 1 THEN
    RAISE EXCEPTION 'Multiple active company memberships exist. Select a workspace explicitly.'
      USING ERRCODE = '42501';
  END IF;

  IF v_active_membership_count = 1 THEN
    SELECT cm.*
    INTO STRICT v_membership
    FROM public.company_memberships cm
    WHERE cm.user_id = v_user_id
      AND cm.status::text = 'active';

    SELECT c.status::text
    INTO v_company_status
    FROM public.companies c
    WHERE c.id = v_membership.company_id;

    IF v_company_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Company is not active.' USING ERRCODE = '42501';
    END IF;

    RETURN v_membership.company_id;
  END IF;

  IF v_membership_count > 0 THEN
    RAISE EXCEPTION 'Company membership is not active and cannot be restored by authentication bootstrap.'
      USING ERRCODE = '42501';
  END IF;

  SELECT c.id, c.status::text
  INTO v_company_id, v_company_status
  FROM public.companies c
  WHERE c.created_by = v_user_id
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No approved company context exists. Complete onboarding first.'
      USING ERRCODE = '42501';
  END IF;

  IF v_company_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Company is not active.' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.user_id = v_user_id
      AND oa.company_id = v_company_id
      AND oa.status::text = 'approved'
  )
  INTO v_onboarding_approved;

  IF NOT v_onboarding_approved THEN
    RAISE EXCEPTION 'Approved onboarding is required before company membership can be repaired.'
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
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN v_company_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bootstrap_company_membership()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_company_id uuid;
  v_membership public.company_memberships%ROWTYPE;
  v_company_status text;
  v_is_creator boolean := false;
  v_onboarding_approved boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated user is required to bootstrap company membership.'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.company_id
  INTO v_profile_company_id
  FROM public.profiles p
  WHERE p.user_id = v_user_id
    AND COALESCE(p.status::text, '') = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active profile is required to bootstrap company membership.'
      USING ERRCODE = '42501';
  END IF;

  IF v_profile_company_id IS NULL THEN
    RETURN public.get_or_create_company_for_user();
  END IF;

  SELECT cm.*
  INTO v_membership
  FROM public.company_memberships cm
  WHERE cm.user_id = v_user_id
    AND cm.company_id = v_profile_company_id
  LIMIT 1;

  IF FOUND THEN
    IF v_membership.status::text <> 'active' THEN
      RAISE EXCEPTION 'Company membership is not active and cannot be restored by authentication bootstrap.'
        USING ERRCODE = '42501';
    END IF;

    SELECT c.status::text
    INTO v_company_status
    FROM public.companies c
    WHERE c.id = v_profile_company_id;

    IF v_company_status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Company is not active.' USING ERRCODE = '42501';
    END IF;

    RETURN v_profile_company_id;
  END IF;

  SELECT
    c.status::text,
    c.created_by = v_user_id
  INTO
    v_company_status,
    v_is_creator
  FROM public.companies c
  WHERE c.id = v_profile_company_id;

  IF v_company_status IS NULL THEN
    RAISE EXCEPTION 'Profile references an unknown company.' USING ERRCODE = '42501';
  END IF;

  IF v_company_status <> 'active' THEN
    RAISE EXCEPTION 'Company is not active.' USING ERRCODE = '42501';
  END IF;

  IF NOT v_is_creator THEN
    RAISE EXCEPTION 'Missing membership cannot be self-created for a company the user does not own.'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.onboarding_applications oa
    WHERE oa.user_id = v_user_id
      AND oa.company_id = v_profile_company_id
      AND oa.status::text = 'approved'
  )
  INTO v_onboarding_approved;

  IF NOT v_onboarding_approved THEN
    RAISE EXCEPTION 'Approved onboarding is required before company membership can be repaired.'
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
    v_profile_company_id,
    v_user_id,
    'owner',
    'active',
    now()
  )
  ON CONFLICT (company_id, user_id) DO NOTHING;

  RETURN v_profile_company_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_company_creator(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    JOIN public.profiles p
      ON p.user_id = c.created_by
    WHERE c.id = cid
      AND c.created_by = auth.uid()
      AND c.status::text = 'pending_approval'
      AND COALESCE(p.status::text, '') = 'active'
  );
$function$;

REVOKE ALL ON FUNCTION public.get_or_create_company_for_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bootstrap_company_membership() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_creator(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_or_create_company_for_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bootstrap_company_membership() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_creator(uuid) TO authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
