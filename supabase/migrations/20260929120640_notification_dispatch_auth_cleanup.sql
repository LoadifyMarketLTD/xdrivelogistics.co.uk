BEGIN;

CREATE OR REPLACE FUNCTION public.trigger_notify_operational_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_project_ref constant text := 'jqxlauexhkonixtjvljw';
  v_project_ref text;
  v_service_role_key text;
  v_webhook_secret text;
  v_edge_url text;
BEGIN
  SELECT value INTO v_project_ref FROM public.app_settings WHERE key = 'supabase_project_ref' LIMIT 1;
  SELECT value INTO v_service_role_key FROM public.app_settings WHERE key = 'supabase_service_role_key' LIMIT 1;
  SELECT value INTO v_webhook_secret FROM public.app_settings WHERE key = 'xdrive_notification_webhook_secret' LIMIT 1;

  IF btrim(COALESCE(v_project_ref, '')) <> v_expected_project_ref
     OR NULLIF(btrim(COALESCE(v_service_role_key, '')), '') IS NULL
     OR length(btrim(COALESCE(v_webhook_secret, ''))) < 32 THEN
    UPDATE public.notification_events
    SET status = 'failed', processed_at = NULL,
        next_attempt_at = now() + interval '2 minutes',
        last_error = 'Notification transport configuration is incomplete.'
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  v_edge_url := 'https://' || v_expected_project_ref || '.supabase.co/functions/v1/notify-operational-event';
  PERFORM net.http_post(
    url := v_edge_url,
    body := jsonb_build_object('event_id', NEW.id, 'event_type', NEW.event_type),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key,
      'x-xdrive-webhook-secret', v_webhook_secret
    ),
    timeout_milliseconds := 5000
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.notification_events
  SET status = 'failed', processed_at = NULL,
      next_attempt_at = now() + interval '2 minutes',
      last_error = left(SQLERRM, 2000)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.dispatch_due_notification_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expected_project_ref constant text := 'jqxlauexhkonixtjvljw';
  v_project_ref text;
  v_service_role_key text;
  v_webhook_secret text;
  v_edge_url text;
BEGIN
  SELECT value INTO v_project_ref FROM public.app_settings WHERE key = 'supabase_project_ref' LIMIT 1;
  SELECT value INTO v_service_role_key FROM public.app_settings WHERE key = 'supabase_service_role_key' LIMIT 1;
  SELECT value INTO v_webhook_secret FROM public.app_settings WHERE key = 'xdrive_notification_webhook_secret' LIMIT 1;

  IF btrim(COALESCE(v_project_ref, '')) <> v_expected_project_ref THEN
    RAISE EXCEPTION 'Notification retry dispatcher blocked: Supabase project ref is not XDrive.';
  END IF;
  IF NULLIF(btrim(COALESCE(v_service_role_key, '')), '') IS NULL
     OR length(btrim(COALESCE(v_webhook_secret, ''))) < 32 THEN
    RAISE EXCEPTION 'Notification retry dispatcher configuration is incomplete.';
  END IF;

  v_edge_url := 'https://' || v_expected_project_ref || '.supabase.co/functions/v1/notify-operational-event';
  PERFORM net.http_post(
    url := v_edge_url,
    body := jsonb_build_object('retry_due', true, 'requested_at', now()),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key,
      'x-xdrive-webhook-secret', v_webhook_secret
    ),
    timeout_milliseconds := 5000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_due_notification_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_due_notification_events() TO service_role;

DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'xdrive-notification-retry-worker' LIMIT 1;
  IF v_jobid IS NOT NULL THEN PERFORM cron.unschedule(v_jobid); END IF;
END;
$$;

SELECT cron.schedule(
  'xdrive-notification-retry-dispatch',
  '* * * * *',
  $cron$SELECT public.dispatch_due_notification_events();$cron$
);

COMMENT ON FUNCTION public.dispatch_due_notification_events() IS
  'Canonical XDrive notification retry dispatcher; authenticates with the private webhook secret and retires the duplicate legacy cron.';

NOTIFY pgrst, 'reload schema';
COMMIT;
