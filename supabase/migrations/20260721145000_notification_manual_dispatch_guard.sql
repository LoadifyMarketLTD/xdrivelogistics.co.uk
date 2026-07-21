BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_notify_operational_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- notification_events has no client INSERT policy. Service-side validation and
  -- controlled replay tooling may opt out of the immediate pg_net request and
  -- invoke the same authenticated Edge Function explicitly.
  IF NEW.status = 'pending'
     AND lower(COALESCE(NEW.payload->>'manual_dispatch', 'false')) <> 'true' THEN
    PERFORM public.dispatch_notification_event(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_event_insert ON public.notification_events;
CREATE TRIGGER on_notification_event_insert
AFTER INSERT ON public.notification_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_operational_event();

COMMENT ON FUNCTION public.trigger_notify_operational_event() IS
  'Dispatches new pending notifications unless a service-created event explicitly requests manual dispatch.';

NOTIFY pgrst, 'reload schema';

COMMIT;
