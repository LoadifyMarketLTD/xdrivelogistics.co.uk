BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Modernize the membership-role helper to use the current JWT role claim while
-- preserving caller scoping: normal users may only ask for their own role;
-- service-role callers may inspect any user.
CREATE OR REPLACE FUNCTION public.active_company_membership_role(
  p_company_id uuid,
  p_user_id uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT CASE
    WHEN COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
      OR p_user_id = auth.uid()
    THEN (
      SELECT cm.role_in_company::text
      FROM public.company_memberships cm
      JOIN public.companies c
        ON c.id = cm.company_id
      JOIN public.profiles p
        ON p.user_id = cm.user_id
      WHERE cm.company_id = p_company_id
        AND cm.user_id = p_user_id
        AND cm.status::text = 'active'
        AND c.status::text = 'active'
        AND COALESCE(p.status::text, '') = 'active'
      LIMIT 1
    )
    ELSE NULL
  END;
$function$;

REVOKE ALL ON FUNCTION public.active_company_membership_role(uuid, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_company_membership_role(uuid, uuid)
TO authenticated, service_role;

-- Accepting an old invite into a suspended/inactive company must fail closed.
-- This legacy RPC exists only on hosted histories that still contain the retired
-- invites/company_members tables. Fresh canonical schemas intentionally omit
-- those tables, so guard the hardening instead of recreating legacy storage.
DO $legacy_invite$
BEGIN
  IF to_regclass('public.invites') IS NOT NULL
     AND to_regclass('public.company_members') IS NOT NULL
     AND to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE $ddl$
CREATE OR REPLACE FUNCTION public.accept_driver_invite(
  p_token text,
  p_full_name text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text
)
RETURNS TABLE(invite invites, profile profiles, membership company_members)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_auth_email text;
  v_auth_phone text;
  v_inv public.invites;
  v_prof public.profiles;
  v_mem public.company_members;
  v_company_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT
    lower(btrim(u.email)),
    regexp_replace(coalesce(u.phone, ''), '[^0-9]+', '', 'g')
  INTO v_auth_email, v_auth_phone
  FROM auth.users u
  WHERE u.id = v_uid;

  SELECT *
  INTO v_inv
  FROM public.invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid token' USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.status <> 'sent' THEN
    RAISE EXCEPTION 'Invite not available' USING ERRCODE = '23514';
  END IF;

  IF v_inv.expires_at <= now() THEN
    UPDATE public.invites
    SET status = 'expired'
    WHERE id = v_inv.id;

    RAISE EXCEPTION 'Invite expired' USING ERRCODE = '23514';
  END IF;

  SELECT c.status::text
  INTO v_company_status
  FROM public.companies c
  WHERE c.id = v_inv.company_id;

  IF v_company_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Invite company is not active.' USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(v_inv.invite_email), '') IS NOT NULL
     AND lower(btrim(v_inv.invite_email)) IS DISTINCT FROM v_auth_email THEN
    RAISE EXCEPTION 'This invite belongs to a different email address.'
      USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(v_inv.invite_email), '') IS NULL
     AND nullif(btrim(v_inv.invite_phone), '') IS NOT NULL THEN
    IF nullif(v_auth_phone, '') IS NULL
       OR regexp_replace(v_inv.invite_phone, '[^0-9]+', '', 'g')
          IS DISTINCT FROM v_auth_phone THEN
      RAISE EXCEPTION 'This invite belongs to a different phone number.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.profiles(user_id, role, status, full_name, phone)
  VALUES (v_uid, 'driver', 'active', p_full_name, p_phone)
  ON CONFLICT (user_id) DO UPDATE
  SET
    role = 'driver',
    status = 'active',
    full_name = COALESCE(excluded.full_name, public.profiles.full_name),
    phone = COALESCE(excluded.phone, public.profiles.phone)
  RETURNING * INTO v_prof;

  INSERT INTO public.company_members(company_id, user_id, member_role)
  VALUES (v_inv.company_id, v_uid, 'driver')
  ON CONFLICT (company_id, user_id) DO UPDATE
  SET member_role = 'driver'
  RETURNING * INTO v_mem;

  UPDATE public.invites
  SET status = 'accepted',
      used_by = v_uid,
      used_at = now()
  WHERE id = v_inv.id
  RETURNING * INTO v_inv;

  invite := v_inv;
  profile := v_prof;
  membership := v_mem;
  RETURN NEXT;
END;
$function$;
$ddl$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.accept_driver_invite(text, text, text) FROM PUBLIC, anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.accept_driver_invite(text, text, text) TO authenticated, service_role';
  END IF;
END;
$legacy_invite$;

COMMIT;

NOTIFY pgrst, 'reload schema';
