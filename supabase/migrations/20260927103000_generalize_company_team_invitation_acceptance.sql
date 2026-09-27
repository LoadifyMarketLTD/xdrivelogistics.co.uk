BEGIN;

CREATE OR REPLACE FUNCTION public.accept_company_team_invitation_atomic(
  p_user_id uuid
)
RETURNS TABLE (
  membership_id uuid,
  company_id uuid,
  role_in_company text,
  profile_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_membership public.company_memberships%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_invited_count integer;
  v_active_count integer;
  v_company_status text;
  v_profile_role text;
  v_membership_role text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invitation user is required.' USING ERRCODE = '22004';
  END IF;

  SELECT count(*)
    INTO v_active_count
  FROM public.company_memberships cm
  WHERE cm.user_id = p_user_id
    AND cm.status = 'active';

  IF v_active_count > 0 THEN
    RAISE EXCEPTION 'This account already has an active company membership.'
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)
    INTO v_invited_count
  FROM public.company_memberships cm
  WHERE cm.user_id = p_user_id
    AND cm.status = 'invited';

  IF v_invited_count <> 1 THEN
    RAISE EXCEPTION 'Exactly one pending company invitation is required; found %.', v_invited_count
      USING ERRCODE = '23514';
  END IF;

  SELECT cm.*
    INTO v_membership
  FROM public.company_memberships cm
  WHERE cm.user_id = p_user_id
    AND cm.status = 'invited'
  FOR UPDATE;

  SELECT p.*
    INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation profile is missing.' USING ERRCODE = 'P0002';
  END IF;

  IF v_profile.company_id IS DISTINCT FROM v_membership.company_id THEN
    RAISE EXCEPTION 'Invitation profile company does not match membership company.'
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(v_profile.status::text, '') <> 'pending' THEN
    RAISE EXCEPTION 'Invitation profile must remain pending until explicit acceptance.'
      USING ERRCODE = '23514';
  END IF;

  v_profile_role := lower(COALESCE(v_profile.role, ''));
  v_membership_role := lower(COALESCE(v_membership.role_in_company, ''));

  IF v_profile_role IN ('customer', 'broker') THEN
    IF v_membership_role NOT IN ('admin', 'dispatcher', 'viewer') THEN
      RAISE EXCEPTION 'Customer/Broker invitation membership role is not eligible for team activation.'
        USING ERRCODE = '23514';
    END IF;
  ELSIF v_profile_role = 'company_staff' THEN
    IF v_membership_role <> 'fleet_manager' THEN
      RAISE EXCEPTION 'Company staff invitation is not eligible for Fleet Manager activation.'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invitation profile role is not eligible for company team activation.'
      USING ERRCODE = '23514';
  END IF;

  SELECT c.status::text
    INTO v_company_status
  FROM public.companies c
  WHERE c.id = v_membership.company_id
  FOR SHARE;

  IF v_company_status IS NULL THEN
    RAISE EXCEPTION 'Invitation company does not exist.' USING ERRCODE = 'P0002';
  END IF;

  IF v_company_status <> 'active' THEN
    RAISE EXCEPTION 'Invitation company is not active.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.company_memberships cm
  SET status = 'active',
      updated_at = now()
  WHERE cm.id = v_membership.id
    AND cm.user_id = p_user_id
    AND cm.status = 'invited';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation membership changed before activation.' USING ERRCODE = '40001';
  END IF;

  UPDATE public.profiles p
  SET status = 'active',
      company_id = v_membership.company_id,
      updated_at = now()
  WHERE p.user_id = p_user_id
    AND p.status::text = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation profile changed before activation.' USING ERRCODE = '40001';
  END IF;

  RETURN QUERY
  SELECT
    v_membership.id,
    v_membership.company_id,
    v_membership.role_in_company,
    v_profile.role;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_company_team_invitation_atomic(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_company_team_invitation_atomic(uuid)
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
