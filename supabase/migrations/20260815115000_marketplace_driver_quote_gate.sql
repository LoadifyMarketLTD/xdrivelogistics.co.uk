-- Canonical Marketplace INSERT gate for driver-originated quotes.
-- Depends on 20260815114500_canonical_driver_vehicle_readiness.sql and on the
-- pre-award quote-safe helper introduced earlier in PR #357.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND (
      -- Named driver quote: same fail-closed owner/company-driver readiness.
      (
        bidder_driver_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.drivers d
          CROSS JOIN LATERAL public.driver_operational_eligibility(d.id) readiness
          WHERE d.id = job_bids.bidder_driver_id
            AND d.user_id = auth.uid()
            AND job_bids.company_id IS NOT DISTINCT FROM d.company_id
            AND readiness.eligible = true
        )
      )
      OR
      -- Distinct company-level commercial bid path: no driver is being claimed
      -- at quote time, therefore dispatcher allocation remains post-award.
      (
        bidder_driver_id IS NULL
        AND job_bids.company_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = job_bids.company_id
            AND cm.user_id = auth.uid()
            AND COALESCE(cm.status::text, '') = 'active'
        )
      )
    )
    AND public.can_quote_marketplace_job(job_bids.job_id, job_bids.company_id)
  );

COMMENT ON POLICY job_bids_exchange_insert ON public.job_bids IS
  'Named-driver quotes require canonical driver+vehicle readiness; company-level bids remain distinct and do not imply a driver allocation.';

COMMIT;
