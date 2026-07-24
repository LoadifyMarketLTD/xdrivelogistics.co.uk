-- Real-database regression test for ambiguous auth-session company resolution.
-- Run only against disposable/local/staging. The transaction is rolled back.

BEGIN;

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
VALUES (
  '44000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'rpc-multi-company@example.test',
  '',
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

INSERT INTO public.companies (id, name, status, created_by)
VALUES
  ('45000000-0000-0000-0000-000000000001', 'RPC Multi Company A', 'active', '44000000-0000-0000-0000-000000000001'),
  ('45000000-0000-0000-0000-000000000002', 'RPC Multi Company B', 'active', '44000000-0000-0000-0000-000000000001');

UPDATE public.profiles
SET company_id = NULL
WHERE user_id = '44000000-0000-0000-0000-000000000001';

INSERT INTO public.company_memberships (
  company_id, user_id, role_in_company, status, updated_at
)
VALUES
  ('45000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', 'owner', 'active', now()),
  ('45000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000001', 'owner', 'active', now());

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '44000000-0000-0000-0000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

SET LOCAL ROLE authenticated;

SELECT pg_temp.expect_forbidden(
  'SELECT public.get_or_create_company_for_user()',
  'Ambiguous multi-company resolution silently selected one active workspace.'
);

SELECT pg_temp.expect_forbidden(
  'SELECT public.bootstrap_company_membership()',
  'Bootstrap silently selected one active workspace when profile company_id was null.'
);

RESET ROLE;
ROLLBACK;
