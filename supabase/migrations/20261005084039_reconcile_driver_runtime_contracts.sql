BEGIN;

-- Browser driver geolocation is a first-class location source used by /api/driver/location.
ALTER TABLE public.driver_locations
  DROP CONSTRAINT IF EXISTS driver_locations_source_check;

ALTER TABLE public.driver_locations
  ADD CONSTRAINT driver_locations_source_check
  CHECK (source IN ('driver_app', 'driver_web', 'telematics'));
ALTER TABLE public.driver_locations
  DROP CONSTRAINT IF EXISTS driver_locations_telematics_provenance_check;

ALTER TABLE public.driver_locations
  ADD CONSTRAINT driver_locations_telematics_provenance_check
  CHECK (
    (
      source = 'driver_app'
      AND source_provider IS NULL
      AND source_event_id IS NULL
    )
    OR (
      source = 'driver_web'
      AND source_provider = 'browser_geolocation'
      AND source_event_id IS NULL
      AND company_id IS NOT NULL
      AND job_id IS NOT NULL
    )
    OR (
      source = 'telematics'
      AND source_provider IS NOT NULL
      AND length(trim(source_provider)) BETWEEN 2 AND 64
      AND source_event_id IS NOT NULL
      AND length(trim(source_event_id)) BETWEEN 1 AND 160
      AND vehicle_id IS NOT NULL
      AND company_id IS NOT NULL
      AND job_id IS NOT NULL
    )
  );

-- Keep tracking history aligned with event types emitted by current driver/workspace APIs.
ALTER TABLE public.job_tracking_events
  DROP CONSTRAINT IF EXISTS job_tracking_events_event_type_check;

ALTER TABLE public.job_tracking_events
  ADD CONSTRAINT job_tracking_events_event_type_check
  CHECK (event_type::text = ANY (ARRAY[
    'created','awarded','allocated','driver_en_route','on_my_way_to_pickup',
    'arrived_pickup','on_site_pickup','collected','loaded','in_transit',
    'on_my_way_to_delivery','arrived_delivery','on_site_delivery','delivered',
    'completed','failed','cancelled','note','booking_offer_created',
    'booking_offer_declined','payment_obligation_acknowledged',
    'commercial_amendment_proposed','commercial_amendment_accepted',
    'commercial_amendment_rejected','commercial_amendment_cancelled',
    'execution_extra_approved','execution_extra_rejected',
    'driver_instruction_added','multi_drop_stop_arrived',
    'multi_drop_stop_completed','collection_handover'
  ]::text[]));

-- Booking acceptance for a driver offer intentionally moves a quoted job directly to accepted.
DO $$
DECLARE
  v_def text;
  v_old text := 'when ''quoted'' then array[''posted'', ''awarded'', ''allocated'', ''cancelled'', ''disputed'']';
  v_new text := 'when ''quoted'' then array[''posted'', ''awarded'', ''allocated'', ''accepted'', ''cancelled'', ''disputed'']';
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'fn_jobs_mvp_guardrails'
  LIMIT 1;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'fn_jobs_mvp_guardrails not found';
  END IF;

  IF position(v_new in lower(v_def)) = 0 THEN
    IF position(v_old in lower(v_def)) = 0 THEN
      RAISE EXCEPTION 'quoted transition guardrail shape is not recognised';
    END IF;
    v_def := replace(v_def, v_old, v_new);
    EXECUTE v_def;
  END IF;
END
$$;

COMMIT;
NOTIFY pgrst, 'reload schema';