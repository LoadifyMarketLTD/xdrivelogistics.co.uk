-- Regression coverage for job_bids_exchange_insert.
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
  ('71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'policy-member@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('71000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'policy-driver@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('71000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'policy-driver-blocked@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('71000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'policy-profile-only@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now());

INSERT INTO public.companies (id, name, status, created_by)
VALUES
  ('72000000-0000-0000-0000-000000000001', 'Policy Customer Company', 'active', '71000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000002', 'Policy Carrier Company', 'active', '71000000-0000-0000-0000-000000000001'),
  ('72000000-0000-0000-0000-000000000003', 'Policy Other Carrier Company', 'active', '71000000-0000-0000-0000-000000000001');

UPDATE public.profiles
SET role = CASE user_id
      WHEN '71000000-0000-0000-0000-000000000001'::uuid THEN 'company'
      WHEN '71000000-0000-0000-0000-000000000002'::uuid THEN 'driver'
      WHEN '71000000-0000-0000-0000-000000000003'::uuid THEN 'driver'
      WHEN '71000000-0000-0000-0000-000000000004'::uuid THEN 'driver'
      ELSE role
    END,
    status = 'active',
    company_id = CASE user_id
      WHEN '71000000-0000-0000-0000-000000000001'::uuid THEN '72000000-0000-0000-0000-000000000002'::uuid
      WHEN '71000000-0000-0000-0000-000000000002'::uuid THEN '72000000-0000-0000-0000-000000000002'::uuid
      WHEN '71000000-0000-0000-0000-000000000003'::uuid THEN '72000000-0000-0000-0000-000000000002'::uuid
      ELSE NULL
    END
WHERE user_id IN (
  '71000000-0000-0000-0000-000000000001',
  '71000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000003',
  '71000000-0000-0000-0000-000000000004'
);

INSERT INTO public.company_memberships (
  company_id, user_id, role_in_company, status, updated_at
)
VALUES (
  '72000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000001',
  'owner',
  'active',
  now()
);

INSERT INTO public.drivers (
  id, company_id, user_id, display_name, status, app_access, driver_type, can_commercial_bid
)
VALUES
  (
    '73000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000002',
    'Policy Allowed Driver',
    'active',
    true,
    'company_driver',
    true
  ),
  (
    '73000000-0000-0000-0000-000000000002',
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000003',
    'Policy Blocked Driver',
    'active',
    true,
    'company_driver',
    false
  );

INSERT INTO public.jobs (
  id, company_id, created_by, status, exchange_visibility, direct_invite_company_id
)
VALUES
  (
    '74000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'posted',
    'exchange',
    NULL
  ),
  (
    '74000000-0000-0000-0000-000000000002',
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'posted',
    'direct',
    '72000000-0000-0000-0000-000000000002'
  ),
  (
    '74000000-0000-0000-0000-000000000003',
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'posted',
    'direct',
    '72000000-0000-0000-0000-000000000003'
  ),
  (
    '74000000-0000-0000-0000-000000000004',
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000001',
    'posted',
    'exchange',
    NULL
  ),
  (
    '74000000-0000-0000-0000-000000000005',
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'posted',
    'exchange',
    NULL
  );

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '71000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
INSERT INTO public.job_bids (
  id, job_id, company_id, bidder_user_id, amount, bid_price_gbp, currency, status
)
VALUES (
  '75000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000001',
  101,
  101,
  'GBP',
  'submitted'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.job_bids
    WHERE id = '75000000-0000-0000-0000-000000000001'
  ),
  'Active company membership did not permit an exchange bid.'
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '71000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
INSERT INTO public.job_bids (
  id, job_id, company_id, bidder_user_id, amount, bid_price_gbp, currency, status
)
VALUES (
  '75000000-0000-0000-0000-000000000002',
  '74000000-0000-0000-0000-000000000002',
  '72000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000001',
  102,
  102,
  'GBP',
  'submitted'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.job_bids
    WHERE id = '75000000-0000-0000-0000-000000000002'
  ),
  'Direct invite bid was rejected for the invited company membership.'
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '71000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_forbidden(
  $sql$
  INSERT INTO public.job_bids (
    id, job_id, company_id, bidder_user_id, amount, bid_price_gbp, currency, status
  )
  VALUES (
    '75000000-0000-0000-0000-000000000003',
    '74000000-0000-0000-0000-000000000003',
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000001',
    103,
    103,
    'GBP',
    'submitted'
  )
  $sql$,
  'Direct invite bid succeeded for a non-invited company membership.'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '71000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
INSERT INTO public.job_bids (
  id, job_id, company_id, bidder_user_id, bidder_driver_id, amount, bid_price_gbp, currency, status
)
VALUES (
  '75000000-0000-0000-0000-000000000004',
  '74000000-0000-0000-0000-000000000005',
  '72000000-0000-0000-0000-000000000002',
  '71000000-0000-0000-0000-000000000002',
  '73000000-0000-0000-0000-000000000001',
  104,
  104,
  'GBP',
  'submitted'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.job_bids
    WHERE id = '75000000-0000-0000-0000-000000000004'
  ),
  'Active commercial driver could not insert an exchange bid.'
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '71000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_forbidden(
  $sql$
  INSERT INTO public.job_bids (
    id, job_id, company_id, bidder_user_id, bidder_driver_id, amount, bid_price_gbp, currency, status
  )
  VALUES (
    '75000000-0000-0000-0000-000000000005',
    '74000000-0000-0000-0000-000000000005',
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000003',
    '73000000-0000-0000-0000-000000000002',
    105,
    105,
    'GBP',
    'submitted'
  )
  $sql$,
  'Driver without can_commercial_bid unexpectedly inserted a bid.'
);
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '71000000-0000-0000-0000-000000000004', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
INSERT INTO public.job_bids (
  id, job_id, company_id, bidder_user_id, amount, bid_price_gbp, currency, status
)
VALUES (
  '75000000-0000-0000-0000-000000000006',
  '74000000-0000-0000-0000-000000000001',
  NULL,
  '71000000-0000-0000-0000-000000000004',
  106,
  106,
  'GBP',
  'submitted'
);
RESET ROLE;
SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.job_bids
    WHERE id = '75000000-0000-0000-0000-000000000006'
  ),
  'Profile-only active driver fallback could not insert an exchange bid.'
);

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '71000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_forbidden(
  $sql$
  INSERT INTO public.job_bids (
    id, job_id, company_id, bidder_user_id, amount, bid_price_gbp, currency, status
  )
  VALUES (
    '75000000-0000-0000-0000-000000000007',
    '74000000-0000-0000-0000-000000000004',
    '72000000-0000-0000-0000-000000000002',
    '71000000-0000-0000-0000-000000000001',
    107,
    107,
    'GBP',
    'submitted'
  )
  $sql$,
  'Carrier company was able to bid on its own job.'
);
RESET ROLE;

ROLLBACK;
