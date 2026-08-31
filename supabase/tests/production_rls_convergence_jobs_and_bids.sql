-- Regression contract for Production-only RLS drift discovered on 2026-08-31.
--
-- Covers:
--   #436 public.jobs cross-company driver SELECT isolation
--   #437 public.job_bids competitor mutation isolation + own self-withdraw
--
-- Run after the full migration chain against a disposable/local/preview database.
-- Synthetic fixtures live only inside this transaction and are always rolled back.

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

CREATE OR REPLACE FUNCTION pg_temp.expect_no_row_update(
  p_statement text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows bigint := 0;
BEGIN
  BEGIN
    EXECUTE p_statement;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  EXCEPTION
    WHEN insufficient_privilege THEN
      -- A protected-column UPDATE can fail before RLS because #437 intentionally
      -- grants authenticated UPDATE on `status` only. That is a valid fail-closed
      -- result for a mutation that attempts any protected commercial field.
      RETURN;
  END;

  IF v_rows <> 0 THEN
    RAISE EXCEPTION '% (affected rows: %)', p_message, v_rows;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Catalog convergence: legacy Production-only broad policies must not reappear.
-- ---------------------------------------------------------------------------

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname IN (
        'drivers_select_all_jobs',
        'jobs_select_exchange_posted',
        'jobs_select_authenticated',
        'jobs_select_company_members_active',
        'jobs_select_owner',
        'jobs_select_assigned_driver_scoped',
        'jobs_driver_assigned_or_awarded_v1'
      )
  ),
  'Legacy Production-only jobs SELECT policies are present after convergence.'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_preaward_marketplace_privacy_guard'
      AND permissive = 'RESTRICTIVE'
      AND cmd = 'SELECT'
      AND 'authenticated' = ANY (roles)
  ),
  'Canonical restrictive Marketplace pre-award privacy guard is missing or weakened.'
);

SELECT pg_temp.assert_true(
  NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_bids'
      AND policyname IN (
        'job_bids_insert_authenticated',
        'job_bids_update_authenticated',
        'job_bids_update_bidder_or_admin'
      )
  ),
  'Legacy broad job_bids mutation policies are present after convergence.'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_bids'
      AND policyname = 'job_bids_exchange_insert'
      AND permissive = 'PERMISSIVE'
      AND cmd = 'INSERT'
      AND 'authenticated' = ANY (roles)
      AND with_check ILIKE '%bidder_user_id = auth.uid()%'
      AND with_check ILIKE '%bidder_driver_id IS NOT NULL%'
      AND with_check ILIKE '%can_authenticated_driver_quote%'
  ),
  'Canonical own-named-driver INSERT policy is missing or weakened.'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_bids'
      AND policyname = 'job_bids_self_withdraw'
      AND permissive = 'PERMISSIVE'
      AND cmd = 'UPDATE'
      AND 'authenticated' = ANY (roles)
      AND qual ILIKE '%bidder_user_id = auth.uid()%'
      AND qual ILIKE '%status = ''submitted''%'
      AND with_check ILIKE '%bidder_user_id = auth.uid()%'
      AND with_check ILIKE '%status = ''withdrawn''%'
  ),
  'Canonical own submitted -> withdrawn policy is missing or weakened.'
);

-- Authenticated callers must not retain table-wide UPDATE. The Driver web
-- self-withdraw path needs only the status column; commercial identity/value
-- fields remain server/RPC controlled.
SELECT pg_temp.assert_true(
  NOT has_table_privilege('authenticated', 'public.job_bids', 'UPDATE'),
  'authenticated still has table-wide UPDATE on public.job_bids.'
);

SELECT pg_temp.assert_true(
  has_column_privilege('authenticated', 'public.job_bids', 'status', 'UPDATE'),
  'authenticated lost the required status-only self-withdraw privilege.'
);

SELECT pg_temp.assert_true(
  NOT has_column_privilege('authenticated', 'public.job_bids', 'job_id', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.job_bids', 'company_id', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.job_bids', 'bidder_user_id', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.job_bids', 'bidder_driver_id', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.job_bids', 'amount', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.job_bids', 'bid_price_gbp', 'UPDATE')
  AND NOT has_column_privilege('authenticated', 'public.job_bids', 'message', 'UPDATE'),
  'authenticated retains UPDATE on protected job_bids columns.'
);

-- ---------------------------------------------------------------------------
-- Synthetic principals.
-- ---------------------------------------------------------------------------

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '86000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'rls-driver-a@example.test', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '86000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'rls-owner-b@example.test', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

INSERT INTO public.companies (id, name, status, created_by)
VALUES
  (
    '86100000-0000-0000-0000-000000000001',
    'RLS Carrier A',
    'active',
    '86000000-0000-0000-0000-000000000001'
  ),
  (
    '86100000-0000-0000-0000-000000000002',
    'RLS Customer B',
    'active',
    '86000000-0000-0000-0000-000000000002'
  );

UPDATE public.profiles
SET role = CASE user_id
      WHEN '86000000-0000-0000-0000-000000000001'::uuid THEN 'driver'
      WHEN '86000000-0000-0000-0000-000000000002'::uuid THEN 'customer'
      ELSE role
    END,
    status = 'active',
    company_id = CASE user_id
      WHEN '86000000-0000-0000-0000-000000000001'::uuid THEN '86100000-0000-0000-0000-000000000001'::uuid
      WHEN '86000000-0000-0000-0000-000000000002'::uuid THEN '86100000-0000-0000-0000-000000000002'::uuid
      ELSE company_id
    END
WHERE user_id IN (
  '86000000-0000-0000-0000-000000000001',
  '86000000-0000-0000-0000-000000000002'
);

INSERT INTO public.company_memberships (
  company_id, user_id, role_in_company, status, updated_at
)
VALUES
  (
    '86100000-0000-0000-0000-000000000001',
    '86000000-0000-0000-0000-000000000001',
    'owner',
    'active',
    now()
  ),
  (
    '86100000-0000-0000-0000-000000000002',
    '86000000-0000-0000-0000-000000000002',
    'owner',
    'active',
    now()
  )
ON CONFLICT (company_id, user_id)
DO UPDATE SET
  role_in_company = EXCLUDED.role_in_company,
  status = EXCLUDED.status,
  updated_at = now();

INSERT INTO public.drivers (
  id, company_id, user_id, display_name, status, app_access,
  driver_type, can_commercial_bid
)
VALUES (
  '86200000-0000-0000-0000-000000000001',
  '86100000-0000-0000-0000-000000000001',
  '86000000-0000-0000-0000-000000000001',
  'RLS Driver A',
  'active',
  true,
  'company_driver',
  true
);

-- ---------------------------------------------------------------------------
-- #436: an app-access driver can read their own assigned job but must not read
-- an unrelated other-company row outside the pre-award Marketplace boundary.
-- The second job is deliberately `delivered`, so the RESTRICTIVE pre-award guard
-- evaluates true and cannot hide a reintroduced broad permissive driver policy.
-- ---------------------------------------------------------------------------

INSERT INTO public.jobs (
  id, company_id, created_by, status, assigned_driver_id,
  assigned_company_id, awarded_carrier_company_id
)
VALUES
  (
    '86300000-0000-0000-0000-000000000001',
    '86100000-0000-0000-0000-000000000001',
    '86000000-0000-0000-0000-000000000001',
    'allocated',
    '86200000-0000-0000-0000-000000000001',
    '86100000-0000-0000-0000-000000000001',
    '86100000-0000-0000-0000-000000000001'
  ),
  (
    '86300000-0000-0000-0000-000000000002',
    '86100000-0000-0000-0000-000000000002',
    '86000000-0000-0000-0000-000000000002',
    'delivered',
    NULL,
    NULL,
    NULL
  );

SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '86000000-0000-0000-0000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.jobs WHERE id = '86300000-0000-0000-0000-000000000001') = 1,
  'Assigned driver lost access to their own assigned job.'
);

SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.jobs WHERE id = '86300000-0000-0000-0000-000000000002') = 0,
  'App-access driver can read an unrelated other-company delivered job.'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- #437: seed one synthetic submitted competitor bid without invoking business
-- INSERT triggers. The seed is privileged test setup only; RLS is exercised below
-- under the real `authenticated` role. session_replication_role is restored
-- immediately and the entire transaction rolls back.
--
-- Legacy bidder_company_id / quote_amount columns are intentionally omitted:
-- clean main uses company_id as bidder-company authority and derives quote amount
-- in public.job_bids_with_job_owner rather than requiring those physical columns.
-- ---------------------------------------------------------------------------

SET LOCAL session_replication_role = replica;

INSERT INTO public.job_bids (
  id,
  job_id,
  company_id,
  bidder_user_id,
  bid_price_gbp,
  amount,
  currency,
  status,
  message
)
VALUES (
  '86400000-0000-0000-0000-000000000001',
  '86300000-0000-0000-0000-000000000002',
  '86100000-0000-0000-0000-000000000001',
  '86000000-0000-0000-0000-000000000001',
  250,
  250,
  'GBP',
  'submitted',
  'Original bidder message'
);

SET LOCAL session_replication_role = origin;

-- Job owner cannot alter the competitor's commercial/identity fields. This must
-- fail at column privilege or affect zero rows; either outcome is fail-closed.
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '86000000-0000-0000-0000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;

SELECT pg_temp.expect_no_row_update(
  $sql$
    UPDATE public.job_bids
       SET company_id = '86100000-0000-0000-0000-000000000002',
           message = 'Tampered by job owner'
     WHERE id = '86400000-0000-0000-0000-000000000001'
  $sql$,
  'Job-owning company modified competitor commercial/identity fields.'
);

-- Even on the one client-writable column, the job owner must not be able to
-- withdraw the competitor's submitted bid. This exercises the row-level policy.
SELECT pg_temp.expect_no_row_update(
  $sql$
    UPDATE public.job_bids
       SET status = 'withdrawn'
     WHERE id = '86400000-0000-0000-0000-000000000001'
  $sql$,
  'Job-owning company withdrew a competitor submitted bid through raw UPDATE.'
);

RESET ROLE;

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.job_bids
    WHERE id = '86400000-0000-0000-0000-000000000001'
      AND company_id = '86100000-0000-0000-0000-000000000001'
      AND message = 'Original bidder message'
      AND status = 'submitted'
  ),
  'Competitor bid changed despite the negative mutation boundary.'
);

-- The actual bidder must retain the one explicitly supported direct mutation:
-- their own submitted bid can become withdrawn, and only through status UPDATE.
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '86000000-0000-0000-0000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;

UPDATE public.job_bids
   SET status = 'withdrawn'
 WHERE id = '86400000-0000-0000-0000-000000000001';

RESET ROLE;

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM public.job_bids
    WHERE id = '86400000-0000-0000-0000-000000000001'
      AND company_id = '86100000-0000-0000-0000-000000000001'
      AND bidder_user_id = '86000000-0000-0000-0000-000000000001'
      AND message = 'Original bidder message'
      AND bid_price_gbp = 250
      AND amount = 250
      AND status = 'withdrawn'
  ),
  'Own submitted bid could not be withdrawn without mutating protected fields.'
);

ROLLBACK;
