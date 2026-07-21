-- The POD notification trigger predates delivery_photos becoming a PostgreSQL
-- text[] column. jsonb_array_length(text[]) fails after a successful delivery
-- transition, rolling the entire transaction back. Count the native array with
-- cardinality while preserving the notification payload contract.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_notify_pod_uploaded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text <> 'delivered'
     OR OLD.status::text = 'delivered'
  THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_events
    (event_type, entity_type, entity_id, company_id, recipient_user_id, payload)
  VALUES (
    'pod_uploaded',
    'job',
    NEW.id,
    NEW.company_id,
    NULL,
    jsonb_build_object(
      'job_id', NEW.id,
      'company_id', NEW.company_id,
      'driver_id', NEW.assigned_driver_id,
      'pickup_location', NEW.pickup_location,
      'delivery_location', NEW.delivery_location,
      'has_collection_photo', NEW.collection_photo_url IS NOT NULL,
      'delivery_photo_count', COALESCE(cardinality(NEW.delivery_photos), 0)
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_notify_pod_uploaded() IS
  'Queues POD notifications after delivery and counts jobs.delivery_photos as a native text array.';

NOTIFY pgrst, 'reload schema';

COMMIT;
