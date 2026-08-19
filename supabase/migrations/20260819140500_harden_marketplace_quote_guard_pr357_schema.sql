-- PR #357-compatible Marketplace quote mutation hardening.
--
-- Purpose:
-- - preserve the PR #357 bidder schema and visual/product baseline;
-- - close the trigger bypass where an authenticated insert arrives without
--   bidder_driver_id before the canonical autofill/attribution path runs;
-- - apply a DB-level guard to trusted server company/Fleet quotes as well as
--   named-driver quotes;
-- - remain compatible with live XDrive legacy bidder_company_id/bidder_id
--   columns without requiring those columns on clean PR #357 replay.
--
-- This is forward-only and intentionally replaces only the quote guard
-- function/trigger. It does not alter tables, UI, lifecycle or award semantics.

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
  v_candidate_count integer := 0;
  v_max_bids integer := 25;
  v_min_interval integer := 5;
  v_open_bid_count integer := 0;
  v_recent_bid_count integer := 0;
  v_row jsonb;
  v_legacy_company_id uuid;
  v_legacy_driver_id uuid;
BEGIN
  v_row := to_jsonb(NEW);

  -- Trusted company/Fleet quote path. Server/service-role calls have no
  -- auth.uid() and intentionally do not carry a named execution driver.
  IF NEW.bidder_driver_id IS NULL AND v_actor IS NULL THEN
    IF NEW.company_id IS NULL OR NEW.bidder_user_id IS NULL THEN
      RAISE EXCEPTION 'Company quote attribution is incomplete.' USING ERRCODE = '23514';
    END IF;

    -- Live XDrive still has the historical bidder_company_id/bidder_id columns.
    -- Clean PR #357 replay does not. Read/write them through the trigger row's
    -- JSON representation so the same guard preserves live compatibility without
    -- introducing a physical-column dependency into fresh history.
    IF v_row ? 'bidder_company_id' THEN
      v_legacy_company_id := NULLIF(v_row ->> 'bidder_company_id', '')::uuid;
      IF v_legacy_company_id IS NOT NULL
         AND v_legacy_company_id IS DISTINCT FROM NEW.company_id THEN
        RAISE EXCEPTION 'Company quote attribution is inconsistent.' USING ERRCODE = '23514';
      END IF;

      NEW := jsonb_populate_record(
        NEW,
        jsonb_build_object('bidder_company_id', NEW.company_id)
      );
    END IF;

    IF v_row ? 'bidder_id' THEN
      NEW := jsonb_populate_record(
        NEW,
        jsonb_build_object('bidder_id', NULL)
      );
    END IF;

    IF NOT public.can_quote_marketplace_job(NEW.job_id, NEW.company_id) THEN
      RAISE EXCEPTION 'This job is not available to this company for quotation.' USING ERRCODE = '42501';
    END IF;

    IF COALESCE(NEW.amount, NEW.bid_price_gbp, 0) <= 0
       OR COALESCE(NEW.amount, NEW.bid_price_gbp, 0) > 1000000 THEN
      RAISE EXCEPTION 'Enter a valid quote amount.' USING ERRCODE = '23514';
    END IF;

    IF length(COALESCE(NEW.message, '')) > 2000 THEN
      RAISE EXCEPTION 'Quote message is too long.' USING ERRCODE = '23514';
    END IF;

    NEW.amount := COALESCE(NEW.amount, NEW.bid_price_gbp);
    NEW.bid_price_gbp := COALESCE(NEW.bid_price_gbp, NEW.amount);
    NEW.currency := COALESCE(NULLIF(NEW.currency, ''), 'GBP');
    NEW.status := 'submitted';

    IF EXISTS (
      SELECT 1
      FROM public.job_bids existing
      WHERE existing.job_id = NEW.job_id
        AND existing.company_id = NEW.company_id
        AND lower(COALESCE(existing.status::text, '')) IN ('submitted', 'accepted')
    ) THEN
      RAISE EXCEPTION 'Your company already has an active quote for this job.' USING ERRCODE = '23505';
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
      WHERE existing.company_id = NEW.company_id
        AND existing.created_at >= now() - make_interval(mins => v_min_interval);

      IF v_recent_bid_count > 0 THEN
        RAISE EXCEPTION 'Please wait % minute(s) before submitting another company quote.', v_min_interval USING ERRCODE = '55000';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- Authenticated legacy/direct callers can arrive before bidder_driver_id is
  -- populated. Resolve only an unambiguous active driver belonging to the
  -- authenticated user; anything ambiguous fails closed.
  IF NEW.bidder_driver_id IS NULL THEN
    SELECT count(*)
    INTO v_candidate_count
    FROM public.drivers d
    WHERE d.user_id = v_actor
      AND (NEW.company_id IS NULL OR d.company_id = NEW.company_id)
      AND lower(COALESCE(d.status::text, 'inactive')) = 'active'
      AND COALESCE(d.is_active, true) = true;

    IF v_candidate_count <> 1 THEN
      RAISE EXCEPTION 'Authenticated quote requires exactly one active own driver identity.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_driver
    FROM public.drivers d
    WHERE d.user_id = v_actor
      AND (NEW.company_id IS NULL OR d.company_id = NEW.company_id)
      AND lower(COALESCE(d.status::text, 'inactive')) = 'active'
      AND COALESCE(d.is_active, true) = true
    ORDER BY d.id
    LIMIT 1;

    NEW.bidder_driver_id := v_driver.id;
  ELSE
    SELECT * INTO v_driver
    FROM public.drivers d
    WHERE d.id = NEW.bidder_driver_id;
  END IF;

  IF NOT FOUND OR v_driver.user_id IS NULL OR v_driver.company_id IS NULL THEN
    RAISE EXCEPTION 'Driver quote attribution is invalid.' USING ERRCODE = '23514';
  END IF;

  -- Preserve legacy live attribution checks when those fields exist, while
  -- keeping clean PR #357 replay free of direct references to absent columns.
  v_row := to_jsonb(NEW);
  v_legacy_company_id := CASE
    WHEN v_row ? 'bidder_company_id' THEN NULLIF(v_row ->> 'bidder_company_id', '')::uuid
    ELSE NULL
  END;
  v_legacy_driver_id := CASE
    WHEN v_row ? 'bidder_id' THEN NULLIF(v_row ->> 'bidder_id', '')::uuid
    ELSE NULL
  END;

  IF (NEW.bidder_user_id IS NOT NULL AND NEW.bidder_user_id IS DISTINCT FROM v_driver.user_id)
     OR (NEW.company_id IS NOT NULL AND NEW.company_id IS DISTINCT FROM v_driver.company_id)
     OR (v_legacy_company_id IS NOT NULL AND v_legacy_company_id IS DISTINCT FROM v_driver.company_id)
     OR (v_legacy_driver_id IS NOT NULL AND v_legacy_driver_id IS DISTINCT FROM v_driver.id) THEN
    RAISE EXCEPTION 'Driver quote attribution does not match the canonical driver identity.' USING ERRCODE = '23514';
  END IF;

  IF v_actor IS NOT NULL AND v_actor IS DISTINCT FROM v_driver.user_id THEN
    RAISE EXCEPTION 'A driver may only submit a quote for their own identity.' USING ERRCODE = '42501';
  END IF;

  NEW.bidder_user_id := v_driver.user_id;
  NEW.company_id := v_driver.company_id;
  NEW.bidder_driver_id := v_driver.id;

  IF v_row ? 'bidder_company_id' THEN
    NEW := jsonb_populate_record(
      NEW,
      jsonb_build_object('bidder_company_id', v_driver.company_id)
    );
  END IF;

  IF v_row ? 'bidder_id' THEN
    NEW := jsonb_populate_record(
      NEW,
      jsonb_build_object('bidder_id', v_driver.id)
    );
  END IF;

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

  NEW.amount := COALESCE(NEW.amount, NEW.bid_price_gbp);
  NEW.bid_price_gbp := COALESCE(NEW.bid_price_gbp, NEW.amount);
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
  'PR357-compatible non-bypassable Marketplace quote guard: trusted server company bids and authenticated own-driver bids enforce attribution, visibility, duplicate protection and global rate limits; legacy live bidder attribution fields are preserved adaptively when present.';

NOTIFY pgrst, 'reload schema';
COMMIT;