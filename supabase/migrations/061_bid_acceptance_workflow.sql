-- ── Migration 061: Bid Acceptance / Awarding Workflow ───────────────────────
-- Adds RLS policies so that:
--   1. Job owners can SELECT all bids placed on their own jobs.
--   2. Awarded carriers can SELECT won jobs (jobs where they are the awarded carrier).
--   3. Carrier companies can INSERT bids only on exchange-visible jobs from other companies.
-- The actual ACCEPT / REJECT mutations are performed via the service-role API
-- route (/api/admin/bids/[id]/accept|reject) to keep the transaction atomic
-- and bypass RLS safely on the server side.
--
-- Idempotent: all statements use DROP … IF EXISTS / CREATE … IF NOT EXISTS guards.

-- ── 1. Job-owner can view all bids placed on their jobs ────────────────────────
-- The existing "bids_all_member" policy only grants access where
-- job_bids.company_id = the caller's company (i.e. the carrier/bidder).
-- Shippers who own the job need a separate permissive SELECT policy.
DROP POLICY IF EXISTS job_bids_owner_select ON public.job_bids;
CREATE POLICY job_bids_owner_select ON public.job_bids
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.company_memberships cm
        ON cm.company_id = j.company_id
       AND cm.user_id = auth.uid()
       AND cm.status = 'active'
      WHERE j.id = job_bids.job_id
    )
  );

-- ── 2. Awarded carrier can SELECT their won jobs ───────────────────────────────
-- jobs.awarded_carrier_company_id is populated when a bid is accepted.
-- We add a permissive SELECT policy so that the winning carrier can query the
-- job from the marketplace Won Jobs tab.
DROP POLICY IF EXISTS jobs_awarded_carrier_select ON public.jobs;
CREATE POLICY jobs_awarded_carrier_select ON public.jobs
  FOR SELECT
  USING (
    awarded_carrier_company_id IS NOT NULL
    AND public.is_company_member(awarded_carrier_company_id)
  );

-- ── 3. Carrier exchange INSERT guard ──────────────────────────────────────────
-- Prevent carriers from bidding on their own jobs or non-exchange jobs.
-- The existing "bids_all_member" policy already allows INSERT where
-- company_id = caller's company.  We add a WITH CHECK constraint here via a
-- separate policy so that the INSERT is only permitted when the target job is
-- exchange-visible and belongs to a different company.
DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert ON public.job_bids
  FOR INSERT
  WITH CHECK (
    -- bidder must be authenticated and the bid must belong to their company
    bidder_user_id = auth.uid()
    AND company_id IS NOT NULL
    AND public.is_company_member(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_bids.job_id
        AND j.exchange_visibility = 'exchange'
        AND j.status = 'posted'
        -- carrier cannot bid on their own company's job
        AND j.company_id != company_id
    )
  );

-- ── 4. Index for job-owner bid queries ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS job_bids_job_id_created_idx
  ON public.job_bids (job_id, created_at DESC);
