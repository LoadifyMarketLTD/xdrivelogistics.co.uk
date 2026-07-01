-- Migration 103: Secure email notification trigger wiring
-- Removes database-stored service role dependency from migration 088.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_notify_operational_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_ref text;
  _edge_url text;
BEGIN
  SELECT value INTO _project_ref
  FROM public.app_settings
  WHERE key = 'supabase_project_ref'
  LIMIT 1;

  IF _project_ref IS NULL OR _project_ref = '' THEN
    RETURN NEW;
  END IF;

  _edge_url := 'https://' || _project_ref || '.supabase.co/functions/v1/notify-operational-event';

  PERFORM extensions.http_post(
    url      := _edge_url,
    headers  := jsonb_build_object(
                  'Content-Type', 'application/json'
                ),
    body     := jsonb_build_object(
                  'event_id', NEW.id,
                  'event_type', NEW.event_type,
                  'record', row_to_json(NEW)
                )::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_event_insert ON public.notification_events;
CREATE TRIGGER on_notification_event_insert
  AFTER INSERT ON public.notification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_operational_event();

DELETE FROM public.app_settings
WHERE key = 'supabase_service_role_key';

COMMIT;
