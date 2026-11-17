BEGIN;

ALTER TABLE public.job_stops
  ADD COLUMN IF NOT EXISTS en_route_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

ALTER TABLE public.job_stops
  DROP CONSTRAINT IF EXISTS job_stops_status_check;
ALTER TABLE public.job_stops
  ADD CONSTRAINT job_stops_status_check
  CHECK (status IN ('pending','en_route','arrived','completed','cancelled','skipped'));

ALTER TABLE public.job_stops
  DROP CONSTRAINT IF EXISTS job_stops_check1;
ALTER TABLE public.job_stops
  ADD CONSTRAINT job_stops_check1
  CHECK (completed_at IS NULL OR status IN ('completed','skipped'));

ALTER TABLE public.job_stops
  DROP CONSTRAINT IF EXISTS job_stops_en_route_at_check;
ALTER TABLE public.job_stops
  ADD CONSTRAINT job_stops_en_route_at_check
  CHECK (en_route_at IS NULL OR status IN ('en_route','arrived','completed','cancelled','skipped'));

ALTER TABLE public.job_stops
  DROP CONSTRAINT IF EXISTS job_stops_cancelled_at_check;
ALTER TABLE public.job_stops
  ADD CONSTRAINT job_stops_cancelled_at_check
  CHECK (cancelled_at IS NULL OR status = 'cancelled');

ALTER TABLE public.job_tracking_events
  DROP CONSTRAINT IF EXISTS job_tracking_events_event_type_check;
ALTER TABLE public.job_tracking_events
  ADD CONSTRAINT job_tracking_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'created','awarded','allocated','accepted','driver_en_route','on_my_way_to_pickup',
    'arrived_pickup','on_site_pickup','collected','loaded','in_transit','on_my_way_to_delivery',
    'arrived_delivery','on_site_delivery','delivered','completed','failed','cancelled','note',
    'booking_offer_created','booking_offer_declined','payment_obligation_acknowledged',
    'commercial_amendment_proposed','commercial_amendment_accepted','commercial_amendment_rejected',
    'commercial_amendment_cancelled','execution_extra_approved','execution_extra_rejected',
    'driver_instruction_added','multi_drop_stop_en_route','multi_drop_stop_arrived',
    'multi_drop_stop_completed','multi_drop_stop_cancelled','delivery_exception',
    'return_required','return_completed','cancellation_requested','collection_handover'
  ]));

COMMENT ON COLUMN public.job_stops.en_route_at IS
  'Server timestamp for the explicit driver On My Way action for this stop.';
COMMENT ON COLUMN public.job_stops.cancelled_at IS
  'Server timestamp for a stop cancelled on an authorised instruction; cancellation details remain in handover JSON.';

COMMIT;

NOTIFY pgrst, 'reload schema';
