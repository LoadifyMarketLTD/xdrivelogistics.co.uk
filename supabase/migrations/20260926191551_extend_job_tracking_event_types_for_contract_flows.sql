BEGIN;

ALTER TABLE public.job_tracking_events
  DROP CONSTRAINT IF EXISTS job_tracking_events_event_type_check;

ALTER TABLE public.job_tracking_events
  ADD CONSTRAINT job_tracking_events_event_type_check
  CHECK (event_type::text = ANY (ARRAY[
    'created',
    'awarded',
    'allocated',
    'driver_en_route',
    'on_my_way_to_pickup',
    'arrived_pickup',
    'on_site_pickup',
    'collected',
    'loaded',
    'in_transit',
    'on_my_way_to_delivery',
    'arrived_delivery',
    'on_site_delivery',
    'delivered',
    'completed',
    'failed',
    'cancelled',
    'note',
    'booking_offer_created',
    'booking_offer_declined',
    'payment_obligation_acknowledged',
    'commercial_amendment_proposed',
    'commercial_amendment_accepted',
    'commercial_amendment_rejected',
    'commercial_amendment_cancelled',
    'execution_extra_approved',
    'execution_extra_rejected'
  ]::text[]));

COMMIT;
NOTIFY pgrst, 'reload schema';
