-- PreLive P1 remediation: durable, duplicate-safe notification retries.
--
-- The insert trigger and the retry cron may invoke the Edge Function at the
-- same time. A DB lease is therefore the single claim authority: workers claim
-- due events under FOR UPDATE SKIP LOCKED, process only rows carrying their
-- lease token, and release the lease on completion/failure. Crashed workers are
-- recoverable after the lease expires.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE EXTENSION IF NOT EXISTS pg_net;

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS notification_events_claimable_idx
  ON public.notification_events(status, next_attempt_at, lease_expires_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE OR REPLACE FUNCTION public.claim_notification_events(
  p_event_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS SETOF public.notification_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := greatest(1, least(COALESCE(p_limit, 50), 100));
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT ne.id
    FROM public.notification_events ne
    WHERE ne.status IN ('pending', 'failed')
      AND (p_event_id IS NULL OR ne.id = p_event_id)
      AND (ne.next_attempt_at IS NULL OR ne.next_attempt_at <= now())
      AND (ne.lease_expires_at IS NULL OR ne.lease_expires_at <= now())
    ORDER BY ne.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.notification_events ne
  SET lease_token = gen_random_uuid(),
      lease_expires_at = now() + interval '10 minutes'
  FROM candidates c
  WHERE ne.id = c.id
  RETURNING ne.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_events(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_events(uuid, integer)
  TO service_role;

COMMENT ON FUNCTION public.claim_notification_events(uuid, integer) IS
  'Service-role notification queue claim with row locking and expiring leases. Prevents duplicate sends when insert-trigger and retry workers overlap.';

-- Replace the historical transport definition with the canonical pg_net API.
-- Configuration failures remain retryable instead of becoming terminal skips.
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
  v_edge_url text;
BEGIN
  SELECT value INTO v_project_ref
  FROM public.app_settings
  WHERE key = 'supabase_project_ref'
  LIMIT 1;

  SELECT value INTO v_service_role_key
  FROM public.app_settings
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;

  IF NULLIF(btrim(COALESCE(v_project_ref, '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(v_service_role_key, '')), '') IS NULL THEN
    UPDATE public.notification_events
    SET status = 'failed',
        processed_at = NULL,
        next_attempt_at = now() + interval '2 minutes',
        last_error = 'Notification transport configuration is incomplete.'
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  IF btrim(v_project_ref) <> v_expected_project_ref THEN
    UPDATE public.notification_events
    SET status = 'failed',
        processed_at = NULL,
        next_attempt_at = now() + interval '2 minutes',
        last_error = 'Notification transport blocked: Supabase project ref is not XDrive.'
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  v_edge_url := 'https://' || v_expected_project_ref || '.supabase.co/functions/v1/notify-operational-event';

  PERFORM net.http_post(
    url := v_edge_url,
    body := jsonb_build_object(
      'event_id', NEW.id,
      'event_type', NEW.event_type
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  UPDATE public.notification_events
  SET status = 'failed',
      processed_at = NULL,
      next_attempt_at = now() + interval '2 minutes',
      last_error = left(SQLERRM, 2000)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_event_insert ON public.notification_events;
CREATE TRIGGER on_notification_event_insert
AFTER INSERT ON public.notification_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_operational_event();

-- Periodic retry dispatcher.
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
  v_edge_url text;
BEGIN
  SELECT value INTO v_project_ref
  FROM public.app_settings
  WHERE key = 'supabase_project_ref'
  LIMIT 1;

  SELECT value INTO v_service_role_key
  FROM public.app_settings
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;

  IF NULLIF(btrim(COALESCE(v_project_ref, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Notification retry dispatcher is missing app_settings.supabase_project_ref.';
  END IF;

  IF btrim(v_project_ref) <> v_expected_project_ref THEN
    RAISE EXCEPTION 'Notification retry dispatcher blocked: Supabase project ref is not XDrive.';
  END IF;

  IF NULLIF(btrim(COALESCE(v_service_role_key, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Notification retry dispatcher is missing app_settings.supabase_service_role_key.';
  END IF;

  v_edge_url := 'https://' || v_expected_project_ref || '.supabase.co/functions/v1/notify-operational-event';

  PERFORM net.http_post(
    url := v_edge_url,
    body := jsonb_build_object(
      'retry_due', true,
      'requested_at', now()
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    timeout_milliseconds := 5000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_due_notification_events()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_due_notification_events()
  TO service_role;

COMMENT ON FUNCTION public.dispatch_due_notification_events() IS
  'Invokes the XDrive notify-operational-event endpoint only when app_settings.supabase_project_ref exactly matches jqxlauexhkonixtjvljw; due failed/pending rows are then claimed and retried.';

-- Supabase Cron is the hosted scheduling authority. Scheduling the same named
-- job is idempotent: the existing job is overwritten with this canonical
-- schedule/command rather than duplicated.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'xdrive-notification-retry-dispatch',
  '* * * * *',
  $cron$SELECT public.dispatch_due_notification_events();$cron$
);

NOTIFY pgrst, 'reload schema';
COMMIT;
