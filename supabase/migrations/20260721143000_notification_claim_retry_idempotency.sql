BEGIN;

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_status_check;

ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped', 'dead_letter')) NOT VALID;

ALTER TABLE public.notification_events
  VALIDATE CONSTRAINT notification_events_status_check;

CREATE INDEX IF NOT EXISTS notification_events_processing_recovery_idx
  ON public.notification_events (processing_started_at, created_at)
  WHERE status = 'processing';

CREATE OR REPLACE FUNCTION public.claim_notification_events(
  p_limit integer DEFAULT 50,
  p_event_id uuid DEFAULT NULL
)
RETURNS SETOF public.notification_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 50);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.notification_events AS exhausted
  SET status = 'dead_letter',
      processed_at = COALESCE(exhausted.processed_at, now()),
      processing_started_at = NULL,
      next_attempt_at = NULL,
      last_error = COALESCE(exhausted.last_error, 'Maximum notification attempts exhausted.')
  WHERE exhausted.attempt_count >= 5
    AND (
      exhausted.status IN ('pending', 'failed')
      OR (
        exhausted.status = 'processing'
        AND exhausted.processing_started_at <= now() - interval '10 minutes'
      )
    )
    AND (p_event_id IS NULL OR exhausted.id = p_event_id);

  RETURN QUERY
  WITH candidates AS (
    SELECT queued.id
    FROM public.notification_events AS queued
    WHERE (p_event_id IS NULL OR queued.id = p_event_id)
      AND queued.attempt_count < 5
      AND (
        (
          queued.status IN ('pending', 'failed')
          AND (queued.next_attempt_at IS NULL OR queued.next_attempt_at <= now())
        )
        OR (
          queued.status = 'processing'
          AND queued.processing_started_at <= now() - interval '10 minutes'
        )
      )
    ORDER BY queued.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE public.notification_events AS claimed
  SET status = 'processing',
      processing_started_at = now(),
      last_attempt_at = now(),
      attempt_count = claimed.attempt_count + 1,
      next_attempt_at = NULL,
      last_error = NULL
  FROM candidates
  WHERE claimed.id = candidates.id
  RETURNING claimed.*;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_notification_event(
  p_event_id uuid,
  p_success boolean,
  p_provider_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS public.notification_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event public.notification_events%ROWTYPE;
  v_dead_letter boolean;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_event
  FROM public.notification_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification event not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_event.status <> 'processing' THEN
    RAISE EXCEPTION 'Notification event % is not processing (status: %).', p_event_id, v_event.status
      USING ERRCODE = '23514';
  END IF;

  v_dead_letter := NOT COALESCE(p_success, false) AND v_event.attempt_count >= 5;

  UPDATE public.notification_events
  SET status = CASE
        WHEN COALESCE(p_success, false) THEN 'sent'
        WHEN v_dead_letter THEN 'dead_letter'
        ELSE 'failed'
      END,
      processed_at = CASE
        WHEN COALESCE(p_success, false) OR v_dead_letter THEN now()
        ELSE NULL
      END,
      processing_started_at = NULL,
      provider_message_id = CASE
        WHEN COALESCE(p_success, false) THEN NULLIF(trim(COALESCE(p_provider_message_id, '')), '')
        ELSE provider_message_id
      END,
      last_error = CASE
        WHEN COALESCE(p_success, false) THEN NULL
        ELSE LEFT(COALESCE(NULLIF(trim(COALESCE(p_error, '')), ''), 'Notification provider or handler failed.'), 2000)
      END,
      next_attempt_at = CASE
        WHEN COALESCE(p_success, false) OR v_dead_letter THEN NULL
        WHEN v_event.attempt_count = 1 THEN now() + interval '1 minute'
        WHEN v_event.attempt_count = 2 THEN now() + interval '5 minutes'
        WHEN v_event.attempt_count = 3 THEN now() + interval '15 minutes'
        ELSE now() + interval '1 hour'
      END
  WHERE id = p_event_id
  RETURNING * INTO v_event;

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_events(integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_notification_event(uuid, boolean, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_events(integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_event(uuid, boolean, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_notification_event(p_event_id uuid DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net, pg_temp
AS $$
DECLARE
  v_project_url text;
  v_webhook_secret text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret
  INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'xdrive_notification_project_url'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT decrypted_secret
  INTO v_webhook_secret
  FROM vault.decrypted_secrets
  WHERE name = 'xdrive_notification_webhook_secret'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NULLIF(trim(COALESCE(v_project_url, '')), '') IS NULL
     OR NULLIF(trim(COALESCE(v_webhook_secret, '')), '') IS NULL THEN
    IF p_event_id IS NOT NULL THEN
      UPDATE public.notification_events
      SET status = CASE WHEN status = 'pending' THEN 'failed' ELSE status END,
          next_attempt_at = CASE WHEN status = 'pending' THEN now() + interval '5 minutes' ELSE next_attempt_at END,
          last_error = 'Notification dispatch Vault configuration is incomplete.'
      WHERE id = p_event_id
        AND status IN ('pending', 'failed');
    END IF;
    RETURN NULL;
  END IF;

  v_request_id := net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/notify-operational-event',
    body := CASE
      WHEN p_event_id IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object('event_id', p_event_id)
    END,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-xdrive-webhook-secret', v_webhook_secret
    ),
    timeout_milliseconds := 10000
  );

  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  IF p_event_id IS NOT NULL THEN
    UPDATE public.notification_events
    SET status = CASE WHEN status = 'pending' THEN 'failed' ELSE status END,
        next_attempt_at = CASE WHEN status = 'pending' THEN now() + interval '5 minutes' ELSE next_attempt_at END,
        last_error = LEFT('Notification dispatch failed: ' || SQLERRM, 2000)
    WHERE id = p_event_id
      AND status IN ('pending', 'failed');
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_notification_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_notification_event(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_notify_operational_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.dispatch_notification_event(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_event_insert ON public.notification_events;
CREATE TRIGGER on_notification_event_insert
AFTER INSERT ON public.notification_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_notify_operational_event();

DO $$
DECLARE
  v_existing_job bigint;
BEGIN
  IF to_regnamespace('cron') IS NULL THEN
    RETURN;
  END IF;

  SELECT jobid
  INTO v_existing_job
  FROM cron.job
  WHERE jobname = 'xdrive-notification-retry-dispatch'
  LIMIT 1;

  IF v_existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job);
  END IF;

  PERFORM cron.schedule(
    'xdrive-notification-retry-dispatch',
    '* * * * *',
    'SELECT public.dispatch_notification_event(NULL);'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Notification retry cron was not installed: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.claim_notification_events(integer, uuid) IS
  'Atomically claims due notification events with SKIP LOCKED and recovers stale workers.';
COMMENT ON FUNCTION public.complete_notification_event(uuid, boolean, text, text) IS
  'Completes a claimed notification event with retry backoff or dead-letter handling.';
COMMENT ON FUNCTION public.dispatch_notification_event(uuid) IS
  'Invokes the notification Edge Function using Vault-managed project URL and webhook secret.';

NOTIFY pgrst, 'reload schema';

COMMIT;
