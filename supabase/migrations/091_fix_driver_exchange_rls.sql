-- Migration 091: Fix driver access to exchange load board and bid submission
--
-- Problems fixed:
-- 1. jobs_exchange_select_policy — only checked company_memberships, blocking
--    driver accounts that have a drivers row but no memberships row (or where
--    the membership upsert failed on driver creation).
--    Fix: add an OR branch that allows any active driver record to SELECT
--    exchange-posted jobs.  Also adds a profile-role branch so self-registered
--    standalone drivers (profiles.role = 'driver') without a rows in the
--    drivers table can still browse the load board.
--
-- 2. job_bids_exchange_insert — relied on is_company_member() which checks
--    company_memberships.  A driver without a memberships row could never bid.
--    Fix: add an OR branch so a driver can bid using their drivers row.
--    Standalone drivers (company_id IS NULL) are already covered by the existing
--    bids_all_member FOR ALL policy (USING company_id IS NULL).
--
-- 3. bids_all_member — the original catch-all SELECT policy on job_bids checks
--    company_id = the company from the caller's membership.  Drivers whose
--    membership upsert failed see no bids at all.
--    Fix: add a separate permissive policy so drivers can always SELECT bids
--    they placed (matched by bidder_user_id OR company_id in their driver row).

-- ── 1. Exchange load board — also let active drivers view exchange posts ───────

DROP POLICY IF EXISTS jobs_exchange_select_policy ON public.jobs;

CREATE POLICY jobs_exchange_select_policy ON public.jobs
  FOR SELECT
  USING (
    exchange_visibility = 'exchange'
    AND status = 'posted'
    AND (
      -- company members (non-driver or owner-driver workspace)
      EXISTS (
        SELECT 1
        FROM public.company_memberships cm
        WHERE cm.user_id = auth.uid()
          AND cm.status <> 'suspended'
          AND cm.role_in_company IN ('owner', 'admin', 'dispatcher', 'member', 'viewer')
      )
      -- platform owners / brokers
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.role IN ('owner', 'broker')
      )
      -- drivers: any driver record for this auth user allows browsing the board
      OR EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.user_id = auth.uid()
          AND d.status NOT IN ('suspended', 'inactive', 'rejected')
      )
      -- standalone/self-registered drivers identified only by profile role
      -- (no row in the drivers table yet, e.g. self-signup via /register)
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND p.role = 'driver'
          AND p.status NOT IN ('blocked', 'suspended', 'inactive', 'pending')
      )
    )
  );

-- ── 2. Bid insertion — also allow driver accounts without a membership row ────

DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;

CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND company_id IS NOT NULL
    AND (
      -- standard path: caller has an active company membership
      (
        public.is_company_member(company_id)
        AND EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = job_bids.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
      )
      -- driver path: caller has a drivers row linked to the same company
      OR EXISTS (
        SELECT 1
        FROM public.drivers d
        WHERE d.user_id = auth.uid()
          AND d.company_id = job_bids.company_id
          AND d.status NOT IN ('suspended', 'inactive', 'rejected')
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_bids.job_id
        AND j.exchange_visibility IN ('exchange', 'direct')
        AND j.company_id <> job_bids.company_id
        AND j.awarded_carrier_company_id IS NULL
    )
  );

-- ── 3. Driver self-select on their own bids (safe fallback) ──────────────────

DROP POLICY IF EXISTS job_bids_driver_self_select ON public.job_bids;

CREATE POLICY job_bids_driver_self_select ON public.job_bids
  FOR SELECT
  USING (
    -- driver can always see bids they personally submitted
    bidder_user_id = auth.uid()
    -- OR bids placed on behalf of their company (company_id match in drivers table)
    OR EXISTS (
      SELECT 1
      FROM public.drivers d
      WHERE d.user_id = auth.uid()
        AND d.company_id = job_bids.company_id
    )
  );

NOTIFY pgrst, 'reload schema';
