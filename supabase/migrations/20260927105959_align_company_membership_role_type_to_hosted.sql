BEGIN;

-- Hosted XDrive stores company_memberships.role_in_company as text. Fresh
-- databases still inherit the legacy public.company_role enum from the baseline
-- schema. Preserve every RLS policy that depends on this column while changing
-- only the column type/default/nullability to the hosted contract.
CREATE TEMP TABLE _role_in_company_policy_backup (
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

INSERT INTO _role_in_company_policy_backup (
  schema_name, table_name, policy_name, policy_cmd, policy_permissive,
  policy_roles, using_expr, with_check_expr
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
  JOIN pg_attribute a
    ON a.attrelid = d.refobjid
   AND a.attnum = d.refobjsubid
  WHERE d.classid = 'pg_policy'::regclass
    AND d.objid = p.oid
    AND d.refclassid = 'pg_class'::regclass
    AND d.refobjid = 'public.company_memberships'::regclass
    AND a.attname = 'role_in_company'
);

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT * FROM _role_in_company_policy_backup
    ORDER BY schema_name, table_name, policy_name
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policy_name, p.schema_name, p.table_name);
  END LOOP;
END;
$$;

ALTER TABLE public.company_memberships
  DROP CONSTRAINT IF EXISTS company_memberships_role_in_company_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.company_memberships
    WHERE role_in_company IS NULL
  ) THEN
    RAISE EXCEPTION 'company_memberships.role_in_company contains NULL rows; manual remediation required before hosted type alignment.';
  END IF;
END;
$$;

ALTER TABLE public.company_memberships
  ALTER COLUMN role_in_company DROP DEFAULT;

ALTER TABLE public.company_memberships
  ALTER COLUMN role_in_company TYPE text
  USING role_in_company::text;

ALTER TABLE public.company_memberships
  ALTER COLUMN role_in_company SET DEFAULT 'member'::text;

ALTER TABLE public.company_memberships
  ALTER COLUMN role_in_company SET NOT NULL;

DO $$
DECLARE
  p record;
  sql_stmt text;
BEGIN
  FOR p IN
    SELECT * FROM _role_in_company_policy_backup
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

COMMIT;