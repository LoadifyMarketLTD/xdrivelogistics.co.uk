-- Executable integration checks for identity/fairness migrations on real schema objects.
-- Run only on disposable/local/staging databases after:
--   - supabase/migrations/20260729161000_identity_compliance_and_fraud_foundation.sql
--   - supabase/migrations/20260729162000_marketplace_single_active_quote_per_identity.sql

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

CREATE OR REPLACE FUNCTION pg_temp.expect_exception(
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
    WHEN OTHERS THEN
      RETURN;
  END;

  RAISE EXCEPTION '%', p_message;
END;
$$;

SELECT pg_temp.assert_true(
  to_regclass('public.company_memberships_one_active_company_per_user_uidx') IS NOT NULL,
  'Missing index company_memberships_one_active_company_per_user_uidx.'
);
SELECT pg_temp.assert_true(
  to_regclass('public.drivers_one_identity_per_auth_user_uidx') IS NOT NULL,
  'Missing index drivers_one_identity_per_auth_user_uidx.'
);
SELECT pg_temp.assert_true(
  to_regclass('public.document_fingerprints_exact_file_uidx') IS NOT NULL,
  'Missing index document_fingerprints_exact_file_uidx.'
);
SELECT pg_temp.assert_true(
  to_regclass('public.job_bids_one_active_company_quote_per_job_uidx') IS NOT NULL,
  'Missing index job_bids_one_active_company_quote_per_job_uidx.'
);
SELECT pg_temp.assert_true(
  to_regclass('public.job_bids_one_active_independent_quote_per_job_uidx') IS NOT NULL,
  'Missing index job_bids_one_active_independent_quote_per_job_uidx.'
);

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('61000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'preflight-user-1@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'preflight-user-2@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'preflight-user-3@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('61000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'preflight-user-4@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.companies (id, name, status, created_by)
VALUES
  ('62000000-0000-0000-0000-000000000001', 'Preflight Co A', 'active', '61000000-0000-0000-0000-000000000001'),
  ('62000000-0000-0000-0000-000000000002', 'Preflight Co B', 'active', '61000000-0000-0000-0000-000000000001');

INSERT INTO public.company_memberships (
  company_id, user_id, role_in_company, status, updated_at
)
VALUES (
  '62000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  'owner',
  'active',
  now()
);

SELECT pg_temp.expect_exception(
  $sql$
  INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status, updated_at)
  VALUES (
    '62000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000001',
    'dispatcher',
    'active',
    now()
  )
  $sql$,
  'Active-membership uniqueness index did not reject a duplicate active company membership.'
);

INSERT INTO public.drivers (id, user_id, account_status)
VALUES (
  '63000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000002',
  'active'
);

SELECT pg_temp.expect_exception(
  $sql$
  INSERT INTO public.drivers (id, user_id, account_status)
  VALUES (
    '63000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000002',
    'active'
  )
  $sql$,
  'Driver-identity uniqueness index did not reject duplicate auth-user mapping.'
);

INSERT INTO public.jobs (id, created_by)
VALUES ('64000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001');

INSERT INTO public.job_bids (id, job_id, company_id, bidder_user_id, status)
VALUES (
  '65000000-0000-0000-0000-000000000001',
  '64000000-0000-0000-0000-000000000001',
  '62000000-0000-0000-0000-000000000001',
  '61000000-0000-0000-0000-000000000001',
  'submitted'
);

SELECT pg_temp.expect_exception(
  $sql$
  INSERT INTO public.job_bids (id, job_id, company_id, bidder_user_id, status)
  VALUES (
    '65000000-0000-0000-0000-000000000002',
    '64000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000003',
    'accepted'
  )
  $sql$,
  'Company active-quote uniqueness index did not reject a duplicate quote.'
);

INSERT INTO public.job_bids (id, job_id, company_id, bidder_user_id, status)
VALUES (
  '65000000-0000-0000-0000-000000000003',
  '64000000-0000-0000-0000-000000000001',
  NULL,
  '61000000-0000-0000-0000-000000000004',
  'submitted'
);

SELECT pg_temp.expect_exception(
  $sql$
  INSERT INTO public.job_bids (id, job_id, company_id, bidder_user_id, status)
  VALUES (
    '65000000-0000-0000-0000-000000000004',
    '64000000-0000-0000-0000-000000000001',
    NULL,
    '61000000-0000-0000-0000-000000000004',
    'accepted'
  )
  $sql$,
  'Independent active-quote uniqueness index did not reject a duplicate quote.'
);

ROLLBACK;
