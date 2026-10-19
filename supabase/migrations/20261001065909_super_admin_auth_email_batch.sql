BEGIN;

CREATE OR REPLACE FUNCTION public.super_admin_auth_user_emails(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT u.id, u.email
  FROM auth.users u
  WHERE u.id = ANY(COALESCE(p_user_ids, ARRAY[]::uuid[]));
$$;

REVOKE ALL ON FUNCTION public.super_admin_auth_user_emails(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_auth_user_emails(uuid[]) TO service_role;

COMMENT ON FUNCTION public.super_admin_auth_user_emails(uuid[]) IS
  'Service-role-only batched authoritative Auth email lookup for Super Admin views.';

COMMIT;

NOTIFY pgrst, 'reload schema';
