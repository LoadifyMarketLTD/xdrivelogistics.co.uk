-- ============================================================
-- Migration 090 — Fix is_company_member parameter name clash
-- ============================================================
-- Root cause: migration 042 (adaptive repair) could recreate
-- public.is_company_member(uuid) with parameter "_company_id".
-- PostgreSQL does not allow renaming function parameters through
-- CREATE OR REPLACE FUNCTION, so later migrations using "cid"
-- fail with "cannot change name of input parameter".
--
-- Fix strategy:
--   1) Snapshot all RLS policies that depend on is_company_member(uuid)
--   2) DROP FUNCTION ... CASCADE
--   3) Recreate function with canonical parameter name cid
--   4) Recreate every captured policy exactly as it existed
-- ============================================================

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _is_company_member_policy_backup (
  schema_name text NOT NULL,
  table_name text NOT NULL,
  policy_name text NOT NULL,
  policy_cmd text NOT NULL,
  policy_permissive boolean NOT NULL,
  policy_roles text NOT NULL,
  using_expr text,
  with_check_expr text
) ON COMMIT DROP;

TRUNCATE _is_company_member_policy_backup;

INSERT INTO _is_company_member_policy_backup (
  schema_name,
  table_name,
  policy_name,
  policy_cmd,
  policy_permissive,
  policy_roles,
  using_expr,
  with_check_expr
)
SELECT
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
    WHEN COALESCE(array_length(p.polroles, 1), 0) = 0
         OR 0 = ANY (p.polroles)
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
    AND d.refobjid = to_regprocedure('public.is_company_member(uuid)')::oid
);

DROP FUNCTION IF EXISTS public.is_company_member(uuid) CASCADE;

CREATE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status <> 'suspended'
      AND c.status::text = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;

DO $$
DECLARE
  p record;
  sql_stmt text;
BEGIN
  FOR p IN
    SELECT *
    FROM _is_company_member_policy_backup
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
