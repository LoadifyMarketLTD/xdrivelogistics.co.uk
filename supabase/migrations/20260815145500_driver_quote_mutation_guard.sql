-- Canonical driver-originated quote mutation guard.
-- All Web/Mobile transports converge here, including legacy direct job_bids inserts.
-- The server helper remains an early UX check, but this trigger is authoritative
-- for attribution, readiness and global quote-rate limits.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.fn_guard_driver_quote_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_ready boolean := false;
  v_vehicle_id uuid;
  v_blockers text[];
  v_actor uuid := auth.uid();
  v_max_bids integer := 25;
  v_min_interval integer := 5;
  v_open_bid_count integer := 0;
  v_recent_bid_count integer := 0;
BEGIN
  -- Company/Fleet-level commercial bids intentionally remain a separate
  -- authorised server path and do not carry bidder_driver_id.
  IF NEW.bidder_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers d
  WHERE d.id = NEW.bidder_driver_id;

  IF NOT FOUND OR v_driver.user_id IS NULL OR v_driver.company_id IS NULL THEN
    RAISE EXCEPTION 'Driver quote attribution is invalid.' USING ERRCODE = '23514';
  END IF;

  -- Reject explicit conflicting attribution, but allow legacy callers that did
  -- not project company/user context to be normalized from the canonical
  -- driver identity below.
  IF (NEW.bidder_user_id IS NOT NULL AND NEW.bidder_user_id IS DISTINCT FROM v_driver.user_id)
     OR (NEW.company_id IS NOT NULL AND NEW.company_id IS DISTINCT FROM v_driver.company_id) THEN
    RAISE EXCEPTION 'Driver quote attribution does not match the canonical driver identity.' USING ERRCODE = '23514';
  END IF;

  -- Authenticated direct clients may only quote as themselves. service_role
  -- server consumers have no auth.uid() and are still constrained by the
  -- canonical driver/user/company identity above.
  IF v_actor IS NOT NULL AND v_actor IS DISTINCT FROM v_driver.user_id THEN
    RAISE EXCEPTION 'A driver may only submit a quote for their own identity.' USING ERRCODE = '42501';
  END IF;

  -- Normalize identity before readiness / Marketplace checks. RLS WITH CHECK
  -- observes this final row, so old Web/Mobile transports cannot create a
  -- different quote representation.
  NEW.bidder_user_id := v_driver.user_id;
  NEW.company_id := v_driver.company_id;

  SELECT readiness.eligible, readiness.vehicle_id, readiness.blockers
  INTO v_ready, v_vehicle_id, v_blockers
  FROM public.driver_operational_eligibility(v_driver.id) readiness;

  IF COALESCE(v_ready, false) <> true THEN
    RAISE EXCEPTION 'Driver and vehicle are not operationally eligible: %', array_to_string(COALESCE(v_blockers, ARRAY[]::text[]), ', ')
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.can_quote_marketplace_job(NEW.job_id, NEW.company_id) THEN
    RAISE EXCEPTION 'This job is not available to this driver for quotation.' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(NEW.amount, NEW.bid_price_gbp, 0) <= 0
     OR COALESCE(NEW.amount, NEW.bid_price_gbp, 0) > 1000000 THEN
    RAISE EXCEPTION 'Enter a valid quote amount.' USING ERRCODE = '23514';
  END IF;

  IF length(COALESCE(NEW.message, '')) > 1000 THEN
    RAISE EXCEPTION 'Quote message is too long.' USING ERRCODE = '23514';
  END IF;

  NEW.amount := COALESCE(NEW.amount, NEW.bid_price_gbp);
  NEW.bid_price_gbp := COALESCE(NEW.bid_price_gbp, NEW.amount);
  NEW.currency := COALESCE(NULLIF(NEW.currency, ''), 'GBP');
  NEW.status := 'submitted';

  -- No second active quote by the same named driver for the same job.
  IF EXISTS (
    SELECT 1
    FROM public.job_bids existing
    WHERE existing.job_id = NEW.job_id
      AND existing.bidder_driver_id = v_driver.id
      AND lower(COALESCE(existing.status::text, '')) IN ('submitted', 'pending', 'accepted')
  ) THEN
    RAISE EXCEPTION 'You already have an active quote for this job.' USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(NULLIF(value, '')::integer, 25)
  INTO v_max_bids
  FROM public.platform_settings
  WHERE key = 'max_bids_per_job';
  v_max_bids := COALESCE(v_max_bids, 25);

  IF v_max_bids > 0 THEN
    SELECT count(*) INTO v_open_bid_count
    FROM public.job_bids existing
    WHERE existing.job_id = NEW.job_id
      AND lower(COALESCE(existing.status::text, '')) IN ('submitted', 'pending', 'accepted');

    IF v_open_bid_count >= v_max_bids THEN
      RAISE EXCEPTION 'This job has reached the maximum number of bids (%).', v_max_bids USING ERRCODE = '54000';
    END IF;
  END IF;

  SELECT COALESCE(NULLIF(value, '')::integer, 5)
  INTO v_min_interval
  FROM public.platform_settings
  WHERE key = 'min_bid_interval_minutes';
  v_min_interval := COALESCE(v_min_interval, 5);

  IF v_min_interval > 0 THEN
    SELECT count(*) INTO v_recent_bid_count
    FROM public.job_bids existing
    WHERE existing.bidder_driver_id = v_driver.id
      AND existing.created_at >= now() - make_interval(mins => v_min_interval);

    IF v_recent_bid_count > 0 THEN
      RAISE EXCEPTION 'Please wait % minute(s) before submitting another quote.', v_min_interval USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_driver_quote_mutation ON public.job_bids;
CREATE TRIGGER trg_guard_driver_quote_mutation
BEFORE INSERT ON public.job_bids
FOR EACH ROW
WHEN (NEW.bidder_driver_id IS NOT NULL)
EXECUTE FUNCTION public.fn_guard_driver_quote_mutation();

REVOKE ALL ON FUNCTION public.fn_guard_driver_quote_mutation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_guard_driver_quote_mutation() TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_guard_driver_quote_mutation() IS
  'Authoritative driver quote mutation contract: canonical named-driver attribution, operational readiness, marketplace visibility, duplicate protection and global bid-rate limits.';

NOTIFY pgrst, 'reload schema';
COMMIT;
