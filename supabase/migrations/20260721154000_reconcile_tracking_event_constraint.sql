BEGIN;

ALTER TABLE public.job_tracking_events
  DROP CONSTRAINT IF EXISTS job_tracking_events_event_type_check;

ALTER TABLE public.job_tracking_events
  ADD CONSTRAINT job_tracking_events_event_type_check
  CHECK (
    event_type IN (
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
      'status_change',
      'on_my_way_to_pickup',
      'on_site_pickup',
      'loaded',
      'on_my_way_to_delivery',
      'on_site_delivery'
    )
  ) NOT VALID;

ALTER TABLE public.job_tracking_events
  VALIDATE CONSTRAINT job_tracking_events_event_type_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'tracking_event_type'
      AND e.enumlabel = 'status_change'
  ) THEN
    RAISE EXCEPTION 'tracking_event_type.status_change is missing after reconciliation.';
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
