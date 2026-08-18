-- PR #357 launch-contract reconciliation against the read-only XDrive live schema audit.
--
-- This is a final-state compatibility repair, not a feature expansion. It closes
-- legacy objects that conflict with the already owner-approved v3.1 contracts:
--   * Fleet Company bids may exist without a named execution driver;
--   * driver quotes are attributed and gated by one non-bypassable mutation guard;
--   * legacy broad jobs SELECT policies must not bypass canonical job privacy;
--   * tracking-event validation must accept the audit events already used by
--     canonical award/allocation functions and already present in tracking_event_type.
--
-- No production rows are backfilled or rewritten here.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- bidder_id is the legacy driver identity column. A Fleet Company commercial bid
-- intentionally has no named driver, and the FK itself already uses ON DELETE
-- SET NULL, so NOT NULL is contradictory to both the FK and the v3.1 contract.
ALTER TABLE public.job_bids
  ALTER COLUMN bidder_id DROP NOT NULL;

-- The legacy autofill trigger derives the latest membership/driver from
-- auth.uid(). It conflicts with service-role canonical mutations and can fill a
-- driver only after an earlier guard has been skipped. Canonical attribution is
-- owned by fn_guard_driver_quote_mutation below.
DROP TRIGGER IF EXISTS trg_job_bids_autofill ON public.job_bids;

-- Remove legacy permissive INSERT paths. Authenticated driver inserts use only
-- job_bids_exchange_insert; Fleet Company quotes are server/service-role writes.
DROP POLICY IF EXISTS job_bids_insert_authenticated ON public.job_bids;
DROP POLICY IF EXISTS bids_insert ON public.job_bids;
DROP POLICY IF EXISTS bids_insert_bidder ON public.job_bids;
DROP POLICY IF EXISTS job_bids_insert ON public.job_bids;

-- The live check was narrower than the existing tracking_event_type enum and
-- even rejected events emitted by the pre-existing atomic allocation RPC. Align
-- the text column with the established audit/operational vocabulary. This only
-- widens accepted future audit events; it does not rewrite historical rows.
ALTER TABLE public.job_tracking_events
  DROP CONSTRAINT IF EXISTS job_tracking_events_event_type_check;

ALTER TABLE public.job_tracking_events
  ADD CONSTRAINT job_tracking_events_event_type_check
  CHECK (
    event_type::text IN (
      'created',
      'allocated',
      'awarded',
      'driver_en_route',
      'arrived_pickup',
      'collected',
      'in_transit',
      'arrived_delivery',
      'delivered',
      'failed',
      'cancelled',
      'note',
      'on_my_way_to_pickup',
      'on_site_pickup',
      'loaded',
      'on_my_way_to_delivery',
      'on_site_delivery'
    )
  ) NOT VALID;

ALTER TABLE public.job_tracking_events
  VALIDATE CONSTRAINT job_tracking_events_event_type_check;

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
  -- Fleet Company commercial quotes have no promised execution driver. They are
  -- accepted only through the authenticated server route (service role bypasses
  -- RLS), but legacy compatibility columns still need truthful company identity.
  IF NEW.bidder_driver_id IS NULL THEN
    IF NEW.company_id IS NULL OR NEW.bidder_user_id IS NULL THEN
      RAISE EXCEPTION 'Company quote attribution is incomplete.' USING ERRCODE = '23514';
    END IF;
    IF NEW.bidder_company_id IS NOT NULL
       AND NEW.bidder_company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Company quote attribution is inconsistent.' USING ERRCODE = '23514';
    END IF;
    NEW.bidder_company_id := NEW.company_id;
    RETURN NEW;
  END IF;

  SELECT * INTO v_driver
  FROM public.drivers d
  WHERE d.id = NEW.bidder_driver_id;

  IF NOT FOUND OR v_driver.user_id IS NULL OR v_driver.company_id IS NULL THEN
    RAISE EXCEPTION 'Driver quote attribution is invalid.' USING ERRCODE = '23514';
  END IF;

  IF (NEW.bidder_user_id IS NOT NULL AND NEW.bidder_user_id IS DISTINCT FROM v_driver.user_id)
     OR (NEW.company_id IS NOT NULL AND NEW.company_id IS DISTINCT FROM v_driver.company_id)
     OR (NEW.bidder_company_id IS NOT NULL AND NEW.bidder_company_id IS DISTINCT FROM v_driver.company_id)
     OR (NEW.bidder_id IS NOT NULL AND NEW.bidder_id IS DISTINCT FROM v_driver.id) THEN
    RAISE EXCEPTION 'Driver quote attribution does not match the canonical driver identity.' USING ERRCODE = '23514';
  END IF;

  -- Authenticated direct clients may quote only as themselves. service_role has
  -- no auth.uid(); those server writes are still bound to the canonical driver
  -- user/company identity below.
  IF v_actor IS NOT NULL AND v_actor IS DISTINCT FROM v_driver.user_id THEN
    RAISE EXCEPTION 'A driver may only submit a quote for their own identity.' USING ERRCODE = '42501';
  END IF;

  -- Normalise every legacy and canonical attribution field before RLS WITH CHECK
  -- evaluates the final row.
  NEW.bidder_id := v_driver.id;
  NEW.bidder_driver_id := v_driver.id;
  NEW.bidder_user_id := v_driver.user_id;
  NEW.company_id := v_driver.company_id;
  NEW.bidder_company_id := v_driver.company_id;

  SELECT readiness.eligible, readiness.vehicle_id, readiness.blockers
  INTO v_ready, v_vehicle_id, v_blockers
  FROM public.driver_operational_eligibility(v_driver.id) readiness;

  IF COALESCE(v_ready, false) <> true THEN
    RAISE EXCEPTION 'Driver and vehicle are not operationally eligible: %',
      array_to_string(COALESCE(v_blockers, ARRAY[]::text[]), ', ')
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

  NEW.amount := COALESCE(NULLIF(NEW.amount, 0), NULLIF(NEW.bid_price_gbp, 0));
  NEW.bid_price_gbp := COALESCE(NULLIF(NEW.bid_price_gbp, 0), NEW.amount);
  NEW.currency := COALESCE(NULLIF(NEW.currency, ''), 'GBP');
  NEW.status := 'submitted';

  IF EXISTS (
    SELECT 1
    FROM public.job_bids existing
    WHERE existing.job_id = NEW.job_id
      AND existing.bidder_driver_id = v_driver.id
      AND lower(COALESCE(existing.status::text, '')) IN ('submitted', 'accepted')
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
      AND lower(COALESCE(existing.status::text, '')) IN ('submitted', 'accepted');

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
EXECUTE FUNCTION public.fn_guard_driver_quote_mutation();

REVOKE ALL ON FUNCTION public.fn_guard_driver_quote_mutation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_guard_driver_quote_mutation() TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_guard_driver_quote_mutation() IS
  'Authoritative quote mutation boundary: Fleet Company quotes retain company-only attribution; named-driver quotes are normalized to canonical driver/user/company identity and must pass operational readiness, marketplace visibility, duplicate and rate limits.';

-- These legacy permissive SELECT policies are incompatible with the canonical
-- server-projected Marketplace boundary / assigned-driver access model. The
-- restrictive pre-award privacy guard remains authoritative for posted/quoted
-- Marketplace rows; post-award driver access is provided by the scoped policies.
DROP POLICY IF EXISTS drivers_select_all_jobs ON public.jobs;
DROP POLICY IF EXISTS jobs_select_exchange_posted ON public.jobs;
DROP POLICY IF EXISTS jobs_exchange_select_policy ON public.jobs;
DROP POLICY IF EXISTS jobs_direct_invite_select ON public.jobs;

NOTIFY pgrst, 'reload schema';
COMMIT;
