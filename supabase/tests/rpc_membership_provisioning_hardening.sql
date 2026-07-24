-- Real-database regression tests for authenticated company-context helpers.
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

CREATE OR REPLACE FUNCTION pg_temp.expect_forbidden(
  p_statement text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    EXECUTE p_statement;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RETURN;
  END;

  RAISE EXCEPTION '%', p_message;
END;
$$;

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('41000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rpc-active@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('41000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rpc-suspended@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('41000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'rpc-no-company@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('41000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'rpc-approved-repair@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('41000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'rpc-unapproved@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.companies (id, name, status, created_by)
VALUES
  ('42000000-0000-0000-0000-000000000001', 'RPC Active Company', 'active', '41000000-0000-0000-0000-000000000001'),
  ('42000000-0000-0000-0000-000000000002', 'RPC Suspended Member Company', 'active', '41000000-0000-0000-0000-000000000002'),
  ('42000000-0000-0000-0000-000000000004', 'RPC Approved Repair Company', 'active', '41000000-0000-0000-0000-000000000004'),
  ('42000000-0000-0000-0000-000000000005', 'RPC Unapproved Company', 'active', '41000000-0000-0000-0000-000000000005');

UPDATE public.profiles
SET company_id = CASE user_id
  WHEN '41000000-0000-0000-0000-000000000001'::uuid THEN '42000000-0000-0000-0000-000000000001'::uuid
  WHEN '41000000-0000-0000-0000-000000000002'::uuid THEN '42000000-0000-0000-0000-000000000002'::uuid
  WHEN '41000000-0000-0000-0000-000000000004'::uuid THEN '42000000-0000-0000-0000-000000000004'::uuid
  WHEN '41000000-0000-0000-0000-000000000005'::uuid THEN '42000000-0000-0000-0000-000000000005'::uuid
  ELSE company_id
END
WHERE user_id IN (
  '41000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000002',
  '41000000-0000-0000-0000-000000000004',
  '41000000-0000-0000-0000-000000000005'
);

INSERT INTO public.company_memberships (
  company_id, user_id, role_in_company, status, updated_at
)
VALUES
  ('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('42000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', 'owner', 'suspended', now());

INSERT INTO public.onboarding_applications (
  id, user_id, email, account_type, status, current_step,
  completion_percentage, company_id, payload
)
VALUES
  ('43000000-0000-0000-0000-000000000004', '41000000-0000-0000-0000-000000000004', 'rpc-approved-repair@example.test', 'owner_driver', 'approved', 'workspace_unlocked', 100, '42000000-0000-0000-0000-000000000004', '{}'::jsonb),
  ('43000000-0000-0000-0000-000000000005', '41000000-0000-0000-0000-000000000005', 'rpc-unapproved@example.test', 'owner_driver', 'under_review', 'pending_review', 100, '42000000-0000-0000-0000-000000000005', '{}'::jsonb);

SELECT pg_temp.assert_true(
  NOT has_function_privilege('anon', 'public.bootstrap_company_membership()', 'EXECUTE'),
  'Anonymous role can execute bootstrap_company_membership.'
);
SELECT pg_temp.assert_true(
  NOT has_function_privilege('anon', 'public.get_or_create_company_for_user()', 'EXECUTE'),
  'Anonymous role can execute get_or_create_company_for_user.'
);
SELECT pg_temp.assert_true(
  has_function_privilege('authenticated', 'public.bootstrap_company_membership()', 'EXECUTE'),
  'Authenticated role cannot execute the safe membership bootstrap helper.'
);

-- Existing active membership remains an idempotent resolution path.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '41000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(
  public.bootstrap_company_membership() = '42000000-0000-0000-0000-000000000001'::uuid,
  'Active membership did not resolve its company.'
);
RESET ROLE;

-- A suspended membership must never be restored by browser auth bootstrap.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '41000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_forbidden(
  'SELECT public.bootstrap_company_membership()',
  'Suspended membership was unexpectedly restored.'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  (SELECT status::text = 'suspended' FROM public.company_memberships WHERE user_id = '41000000-0000-0000-0000-000000000002'),
  'Suspended membership status changed during bootstrap.'
);

-- Auth resolution must not create a first company or owner membership.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '41000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_forbidden(
  'SELECT public.get_or_create_company_for_user()',
  'User without approved company context created a company.'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  NOT EXISTS (SELECT 1 FROM public.companies WHERE created_by = '41000000-0000-0000-0000-000000000003'),
  'Company was created outside canonical onboarding.'
);
SELECT pg_temp.assert_true(
  NOT EXISTS (SELECT 1 FROM public.company_memberships WHERE user_id = '41000000-0000-0000-0000-000000000003'),
  'Owner membership was created outside canonical onboarding.'
);

-- A genuinely missing creator membership may be repaired only after approval.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '41000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(
  public.bootstrap_company_membership() = '42000000-0000-0000-0000-000000000004'::uuid,
  'Approved creator membership was not repaired.'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.company_memberships
    WHERE company_id = '42000000-0000-0000-0000-000000000004'
      AND user_id = '41000000-0000-0000-0000-000000000004'
      AND role_in_company::text = 'owner'
      AND status::text = 'active'
  ),
  'Approved creator repair did not create the expected active owner membership.'
);

-- An active company alone is insufficient without approved onboarding.
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '41000000-0000-0000-0000-000000000005', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_forbidden(
  'SELECT public.bootstrap_company_membership()',
  'Unapproved creator obtained an active owner membership.'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1 FROM public.company_memberships
    WHERE company_id = '42000000-0000-0000-0000-000000000005'
      AND user_id = '41000000-0000-0000-0000-000000000005'
  ),
  'Unapproved creator membership was created.'
);

ROLLBACK;
