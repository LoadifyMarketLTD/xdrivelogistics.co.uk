-- P0-6 regression test for application-owned SECURITY DEFINER helpers.
-- Run after all migrations against a disposable/local/staging database.
-- The transaction is always rolled back.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(
  p_condition boolean,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_message;
  END IF;
END;
$$;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('51000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'p0-6-active@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('51000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'p0-6-suspended@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.companies (id, name, status, created_by)
VALUES
  ('52000000-0000-0000-0000-000000000001', 'P0-6 Active Company', 'active', '51000000-0000-0000-0000-000000000001'),
  ('52000000-0000-0000-0000-000000000002', 'P0-6 Suspended Company', 'active', '51000000-0000-0000-0000-000000000002');

UPDATE public.profiles
SET company_id = CASE user_id
  WHEN '51000000-0000-0000-0000-000000000001'::uuid THEN '52000000-0000-0000-0000-000000000001'::uuid
  WHEN '51000000-0000-0000-0000-000000000002'::uuid THEN '52000000-0000-0000-0000-000000000002'::uuid
  ELSE company_id
END
WHERE user_id IN (
  '51000000-0000-0000-0000-000000000001',
  '51000000-0000-0000-0000-000000000002'
);

INSERT INTO public.company_memberships (
  company_id, user_id, role_in_company, status, updated_at
)
VALUES
  ('52000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', 'owner', 'suspended', now());

SELECT pg_temp.assert_true(
  NOT has_function_privilege('anon', 'public.is_company_member(uuid)', 'EXECUTE'),
  'Anonymous role can execute is_company_member(uuid).'
);
SELECT pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.is_company_member(uuid)', 'EXECUTE'),
  'Authenticated role cannot execute is_company_member(uuid).'
);
SELECT pg_temp.assert_true(
  NOT has_function_privilege('anon', 'public.next_invoice_number(uuid)', 'EXECUTE'),
  'Anonymous role can execute next_invoice_number(uuid).'
);
SELECT pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.next_invoice_number(uuid)', 'EXECUTE'),
  'Authenticated role cannot execute next_invoice_number(uuid).'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'is_company_member'
      AND proconfig IS NOT NULL
      AND array_to_string(proconfig, ',') LIKE '%search_path=public%'
  ),
  'public.is_company_member(uuid) is missing an explicit search_path.'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'is_company_admin'
      AND proconfig IS NOT NULL
      AND array_to_string(proconfig, ',') LIKE '%search_path=public%'
  ),
  'public.is_company_admin(uuid) is missing an explicit search_path.'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'auth_company_id'
      AND proconfig IS NOT NULL
      AND array_to_string(proconfig, ',') LIKE '%search_path=public%'
  ),
  'public.auth_company_id() is missing an explicit search_path.'
);
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'next_invoice_number'
      AND proconfig IS NOT NULL
      AND array_to_string(proconfig, ',') LIKE '%search_path=public%'
  ),
  'public.next_invoice_number(uuid) is missing an explicit search_path.'
);

CREATE TEMP TABLE company_memberships (
  company_id uuid,
  user_id uuid,
  role_in_company text,
  status text
);
INSERT INTO company_memberships (company_id, user_id, role_in_company, status)
VALUES
  ('52000000-0000-0000-0000-000000000002', '51000000-0000-0000-0000-000000000002', 'owner', 'active');

CREATE TEMP TABLE profiles (
  user_id uuid,
  company_id uuid
);
INSERT INTO profiles (user_id, company_id)
VALUES
  ('51000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002');

CREATE TEMP TABLE invoices (
  id uuid,
  company_id uuid,
  invoice_number text
);
INSERT INTO invoices (id, company_id, invoice_number)
SELECT
  format('53000000-0000-0000-0000-%012s', series)::uuid,
  '52000000-0000-0000-0000-000000000001'::uuid,
  format('INV-%s-%s', to_char(now(), 'YYYYMM'), lpad(series::text, 3, '0'))
FROM generate_series(1, 25) AS series;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '51000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT pg_temp.assert_true(
  public.is_company_member('52000000-0000-0000-0000-000000000001'::uuid),
  'Active membership lookup failed.'
);
SELECT pg_temp.assert_true(
  public.is_company_admin('52000000-0000-0000-0000-000000000001'::uuid),
  'Active admin lookup failed.'
);
SELECT pg_temp.assert_true(
  public.auth_company_id() = '52000000-0000-0000-0000-000000000001'::uuid,
  'auth_company_id() read a shadowed temp profile instead of public.profiles.'
);
SELECT pg_temp.assert_true(
  public.next_invoice_number('52000000-0000-0000-0000-000000000001'::uuid)
    = format('INV-%s-001', to_char(now(), 'YYYYMM')),
  'next_invoice_number(uuid) used shadowed temp invoices instead of public.invoices.'
);

RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '51000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT pg_temp.assert_true(
  NOT public.is_company_member('52000000-0000-0000-0000-000000000002'::uuid),
  'Suspended membership was reactivated by a shadowed temp table.'
);
SELECT pg_temp.assert_true(
  NOT public.is_company_admin('52000000-0000-0000-0000-000000000002'::uuid),
  'Suspended admin membership was reactivated by a shadowed temp table.'
);

RESET ROLE;
ROLLBACK;
