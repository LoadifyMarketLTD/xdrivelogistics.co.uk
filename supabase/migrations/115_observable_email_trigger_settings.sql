-- DRIFT-002: make email trigger configuration failures observable without
-- committing secrets. If app_settings is missing or pg_net fails, the event is
-- marked skipped/failed instead of staying silently pending forever.

CREATE OR REPLACE FUNCTION public.trigger_notify_operational_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_ref text;
  _service_role_key text;
  _edge_url text;
BEGIN
  SELECT value INTO _project_ref
  FROM public.app_settings
  WHERE key = 'supabase_project_ref'
  LIMIT 1;

  IF _project_ref IS NULL OR _project_ref = '' THEN
    UPDATE public.notification_events
    SET status = 'skipped',
        processed_at = now(),
        payload = COALESCE(payload, '{}'::jsonb)
          || jsonb_build_object('external_delivery_skipped_reason', 'missing_app_settings.supabase_project_ref')
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT value INTO _service_role_key
  FROM public.app_settings
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;

  IF _service_role_key IS NULL OR _service_role_key = '' THEN
    UPDATE public.notification_events
    SET status = 'skipped',
        processed_at = now(),
        payload = COALESCE(payload, '{}'::jsonb)
          || jsonb_build_object('external_delivery_skipped_reason', 'missing_app_settings.supabase_service_role_key')
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  _edge_url := 'https://' || _project_ref || '.supabase.co/functions/v1/notify-operational-event';

  PERFORM extensions.http_post(
    url      := _edge_url,
    headers  := jsonb_build_object(
                  'Content-Type',  'application/json',
                  'Authorization', 'Bearer ' || _service_role_key
                ),
    body     := jsonb_build_object('event_id', NEW.id, 'event_type', NEW.event_type)::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.notification_events
  SET status = 'failed',
      processed_at = now(),
      payload = COALESCE(payload, '{}'::jsonb)
        || jsonb_build_object('external_delivery_error', SQLERRM)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_event_insert ON public.notification_events;
CREATE TRIGGER on_notification_event_insert
  AFTER INSERT ON public.notification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_operational_event();

COMMENT ON TABLE public.app_settings IS
  'Service-role-only runtime settings. Required keys for email trigger: supabase_project_ref and supabase_service_role_key. Do not store these in application code.';
