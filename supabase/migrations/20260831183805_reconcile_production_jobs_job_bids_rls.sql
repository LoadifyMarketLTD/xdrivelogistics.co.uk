-- P0 forward-only RLS convergence for Production-only drift discovered 2026-08-31.
--
-- Covers:
--   #436 public.jobs cross-company driver SELECT isolation
--   #437 public.job_bids competitor mutation isolation
--
-- Production safety:
-- - This migration must be validated on a disposable/preview database first.
-- - It must not be executed against Production by an agent.
-- - No business data is mutated; only policies and grants are reconciled.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- #436: remove Production-only permissive SELECT policies that are not part of
-- the canonical jobs RLS contract. The canonical assigned-driver, company,
-- awarded-carrier and restrictive pre-award Marketplace policies remain intact.
DROP POLICY IF EXISTS drivers_select_all_jobs ON public.jobs;
DROP POLICY IF EXISTS jobs_select_exchange_posted ON public.jobs;
DROP POLICY IF EXISTS jobs_select_authenticated ON public.jobs;
DROP POLICY IF EXISTS jobs_select_company_members_active ON public.jobs;
DROP POLICY IF EXISTS jobs_select_owner ON public.jobs;
DROP POLICY IF EXISTS jobs_select_assigned_driver_scoped ON public.jobs;
DROP POLICY IF EXISTS jobs_driver_assigned_or_awarded_v1 ON public.jobs;

-- #437: retire broad/legacy direct-client mutation policies. Company/Fleet
-- commercial writes use trusted server routes; authenticated direct INSERT is
-- the named-driver path only.
DROP POLICY IF EXISTS job_bids_insert_authenticated ON public.job_bids;
DROP POLICY IF EXISTS job_bids_update_authenticated ON public.job_bids;
DROP POLICY IF EXISTS job_bids_update_bidder_or_admin ON public.job_bids;

DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND bidder_driver_id IS NOT NULL
    AND public.can_authenticated_driver_quote(
      bidder_driver_id,
      job_id,
      company_id
    )
  );

-- Direct authenticated UPDATE is only required for the Driver web self-withdraw
-- flow. Protect all commercial/identity columns at the privilege layer and allow
-- only a submitted own bid to become withdrawn. Trusted server/RPC mutations run
-- with their definer/service privileges and are not widened by this policy.
REVOKE UPDATE ON TABLE public.job_bids FROM PUBLIC, anon, authenticated;
GRANT UPDATE (status) ON public.job_bids TO authenticated;

DROP POLICY IF EXISTS job_bids_self_withdraw ON public.job_bids;
CREATE POLICY job_bids_self_withdraw
  ON public.job_bids
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    bidder_user_id = auth.uid()
    AND status = 'submitted'
  )
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND status = 'withdrawn'
  );

-- Fail closed if the migration did not converge the intended policy/privilege
-- contract. These checks inspect catalog state only and do not mutate business data.
DO $$
BEGIN
  IF EXISTS (
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
  ) THEN
    RAISE EXCEPTION 'Legacy broad jobs SELECT policy remains after convergence.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_preaward_marketplace_privacy_guard'
      AND permissive = 'RESTRICTIVE'
      AND cmd = 'SELECT'
      AND 'authenticated' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'Canonical restrictive jobs Marketplace privacy guard is missing or weakened.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_bids'
      AND policyname IN (
        'job_bids_insert_authenticated',
        'job_bids_update_authenticated',
        'job_bids_update_bidder_or_admin'
      )
  ) THEN
    RAISE EXCEPTION 'Legacy broad job_bids mutation policy remains after convergence.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_bids'
      AND policyname = 'job_bids_self_withdraw'
      AND cmd = 'UPDATE'
      AND 'authenticated' = ANY (roles)
  ) THEN
    RAISE EXCEPTION 'Canonical self-withdraw job_bids UPDATE policy is missing.';
  END IF;

  IF has_table_privilege('authenticated', 'public.job_bids', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated still has table-wide UPDATE on public.job_bids.';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.job_bids', 'status', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated lost required status-only UPDATE on public.job_bids.';
  END IF;

  IF has_column_privilege('authenticated', 'public.job_bids', 'amount', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.job_bids', 'bid_price_gbp', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.job_bids', 'company_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.job_bids', 'bidder_user_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.job_bids', 'job_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.job_bids', 'message', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated retains UPDATE on protected job_bids columns.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
