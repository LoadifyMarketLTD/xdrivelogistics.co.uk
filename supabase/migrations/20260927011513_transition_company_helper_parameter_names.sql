BEGIN;

CREATE TEMP TABLE _company_helper_policy_backup (
  schema_name text NOT NULL,
  table_name text NOT NULL,
  policy_name text NOT NULL,
  policy_cmd text NOT NULL,
  policy_permissive boolean NOT NULL,
  policy_roles text NOT NULL,
  using_expr text,
  with_check_expr text,
  PRIMARY KEY (schema_name, table_name, policy_name)
) ON COMMIT DROP;

INSERT INTO _company_helper_policy_backup (
  schema_name,
  table_name,
  policy_name,
  policy_cmd,
  policy_permissive,
  policy_roles,
  using_expr,
  with_check_expr
)
SELECT DISTINCT
  n.nspname,
  c.relname,
  p.polname,
  CASE p.polcmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END,
  p.polpermissive,
  CASE
    WHEN COALESCE(array_length(p.polroles, 1), 0) = 0 OR 0 = ANY (p.polroles)
      THEN 'PUBLIC'
    ELSE COALESCE((
      SELECT string_agg(quote_ident(r.rolname), ', ' ORDER BY r.rolname)
      FROM unnest(p.polroles) AS role_oid
      JOIN pg_roles r ON r.oid = role_oid
    ), 'PUBLIC')
  END,
  pg_get_expr(p.polqual, p.polrelid),
  pg_get_expr(p.polwithcheck, p.polrelid)
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE EXISTS (
  SELECT 1
  FROM pg_depend d
  WHERE d.classid = 'pg_policy'::regclass
    AND d.objid = p.oid
    AND d.refclassid = 'pg_proc'::regclass
    AND d.refobjid IN (
      to_regprocedure('public.is_company_member(uuid)')::oid,
      to_regprocedure('public.is_company_admin(uuid)')::oid
    )
);

DROP FUNCTION IF EXISTS public.is_company_member(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_company_admin(uuid) CASCADE;

CREATE FUNCTION public.is_company_member(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_active_company_membership(_company_id, auth.uid());
$$;

CREATE FUNCTION public.is_company_admin(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.active_company_membership_role(_company_id, auth.uid()) IN ('owner', 'admin'),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated, service_role;

DO $$
DECLARE
  p record;
  sql_stmt text;
BEGIN
  FOR p IN
    SELECT *
    FROM _company_helper_policy_backup
    ORDER BY schema_name, table_name, policy_name
  LOOP
    sql_stmt := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      p.policy_name,
      p.schema_name,
      p.table_name,
      CASE WHEN p.policy_permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      p.policy_cmd,
      p.policy_roles
    );

    IF p.using_expr IS NOT NULL THEN
      sql_stmt := sql_stmt || format(' USING (%s)', p.using_expr);
    END IF;

    IF p.with_check_expr IS NOT NULL THEN
      sql_stmt := sql_stmt || format(' WITH CHECK (%s)', p.with_check_expr);
    END IF;

    EXECUTE sql_stmt;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;