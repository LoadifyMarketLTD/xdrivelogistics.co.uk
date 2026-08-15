-- Canonical Marketplace INSERT gate for driver-originated quotes.
-- Depends on 20260815114500_canonical_driver_vehicle_readiness.sql and on the
-- pre-award quote-safe helper introduced earlier in PR #357.
--
-- Direct authenticated inserts are a DRIVER path only. Fleet/Company commercial
-- bids use the canonical server route (`/api/marketplace/company`) and therefore
-- do not need a permissive client-side company-bid escape hatch.
--
-- This policy is RESTRICTIVE so legacy permissive INSERT policies cannot bypass
-- driver readiness when a browser/mobile authenticated client writes job_bids.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND bidder_driver_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.drivers d
      CROSS JOIN LATERAL public.driver_operational_eligibility(d.id) readiness
      WHERE d.id = job_bids.bidder_driver_id
        AND d.user_id = auth.uid()
        AND job_bids.company_id IS NOT DISTINCT FROM d.company_id
        AND readiness.eligible = true
    )
    AND public.can_quote_marketplace_job(job_bids.job_id, job_bids.company_id)
  );

COMMENT ON POLICY job_bids_exchange_insert ON public.job_bids IS
  'Restrictive direct-client gate: only the authenticated named driver may quote, and canonical driver+vehicle readiness must pass. Fleet/Company-level bidding uses the authorised server route.';

COMMIT;
