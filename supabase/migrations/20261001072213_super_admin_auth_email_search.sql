BEGIN;

CREATE OR REPLACE FUNCTION public.super_admin_search_auth_users(
  p_query text,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT u.id, u.email
  FROM auth.users u
  WHERE u.email IS NOT NULL
    AND u.email ILIKE '%' || replace(replace(COALESCE(p_query, ''), '%', '\%'), '_', '\_') || '%' ESCAPE '\'
  ORDER BY lower(u.email), u.id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.super_admin_search_auth_users(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_search_auth_users(text, integer) TO service_role;

COMMENT ON FUNCTION public.super_admin_search_auth_users(text, integer) IS
  'Service-role-only bounded Auth email search for Super Admin global search.';

COMMIT;
NOTIFY pgrst, 'reload schema';
