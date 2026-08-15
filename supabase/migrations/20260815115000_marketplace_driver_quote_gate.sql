-- Canonical Marketplace INSERT gate for driver-originated quotes.
-- Depends on 20260815114500_canonical_driver_vehicle_readiness.sql and on the
-- pre-award quote-safe helper introduced earlier in PR #357.
--
-- Direct authenticated inserts are a DRIVER path only. Fleet/Company commercial
-- bids use the canonical server route (`/api/marketplace/company`) and therefore
-- do not need a permissive client-side company-bid escape hatch.
--
-- Keep the detailed readiness resolver service-bound. Authenticated RLS callers
-- get only a boolean own-driver decision through the wrapper below, so the
-- policy cannot become a cross-driver readiness introspection surface.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.can_authenticated_driver_quote(
  p_driver_id uuid,
  p_job_id uuid,
  p_company_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ready boolean := false;
  v_driver_company_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_driver_id IS NULL OR p_job_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT d.company_id
  INTO v_driver_company_id
  FROM public.drivers d
  WHERE d.id = p_driver_id
    AND d.user_id = auth.uid();

  IF NOT FOUND OR v_driver_company_id IS DISTINCT FROM p_company_id THEN
    RETURN false;
  END IF;

  SELECT readiness.eligible
  INTO v_ready
  FROM public.driver_operational_eligibility(p_driver_id) readiness;

  RETURN COALESCE(v_ready, false)
    AND public.can_quote_marketplace_job(p_job_id, p_company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.can_authenticated_driver_quote(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_authenticated_driver_quote(uuid, uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_authenticated_driver_quote(uuid, uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  AS RESTRICTIVE
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

COMMENT ON FUNCTION public.can_authenticated_driver_quote(uuid, uuid, uuid) IS
  'Boolean RLS-safe quote gate for the authenticated user own named-driver identity; detailed readiness remains service-bound.';

COMMENT ON POLICY job_bids_exchange_insert ON public.job_bids IS
  'Restrictive direct-client gate: only the authenticated named driver may quote, and canonical driver+vehicle readiness must pass. Fleet/Company-level bidding uses the authorised server route.';

COMMIT;
