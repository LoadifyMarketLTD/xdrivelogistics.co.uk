BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

DO $preflight$
BEGIN
  IF to_regclass('public.notification_events') IS NULL THEN
    RAISE EXCEPTION 'public.notification_events must exist before applying Platform Owner notification retry governance.' USING ERRCODE = '23514';
  END IF;

  IF to_regclass('public.owner_audit_log') IS NULL THEN
    RAISE EXCEPTION 'public.owner_audit_log must exist before applying Platform Owner notification retry governance.' USING ERRCODE = '23514';
  END IF;

  IF to_regprocedure('public.assert_platform_owner_actor(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.assert_platform_owner_actor(uuid) must exist before applying Platform Owner notification retry governance.' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notification_events'
      AND column_name IN ('status','processed_at','attempt_count','last_attempt_at','next_attempt_at','last_error','lease_token','lease_expires_at')
    GROUP BY table_schema, table_name
    HAVING count(*) = 8
  ) THEN
    RAISE EXCEPTION 'notification_events retry durability and lease columns are required.' USING ERRCODE = '23514';
  END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public.owner_retry_notification_event(
  p_actor_user_id uuid,
  p_notification_id uuid,
  p_reason text
)
RETURNS TABLE (
  notification_id uuid,
  status text,
  attempt_count integer,
  next_attempt_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_event record;
  v_next_attempt_at timestamptz := clock_timestamp();
BEGIN
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  IF p_notification_id IS NULL THEN
    RAISE EXCEPTION 'notification_id is required.' USING ERRCODE = '23502';
  END IF;

  IF char_length(v_reason) < 5 THEN
    RAISE EXCEPTION 'A notification retry reason of at least 5 characters is required.' USING ERRCODE = '23514';
  END IF;

  SELECT
    ne.id,
    ne.event_type,
    ne.entity_type,
    ne.entity_id,
    ne.company_id,
    ne.status::text AS status,
    ne.attempt_count,
    ne.last_attempt_at,
    ne.lease_token,
    ne.lease_expires_at
  INTO v_event
  FROM public.notification_events ne
  WHERE ne.id = p_notification_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification event not found.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(COALESCE(v_event.status, '')) NOT IN ('failed', 'skipped') THEN
    RAISE EXCEPTION 'Notification cannot be retried from status %.', COALESCE(v_event.status, 'unknown') USING ERRCODE = '23514';
  END IF;

  UPDATE public.notification_events ne
  SET status = 'pending',
      processed_at = NULL,
      last_error = NULL,
      next_attempt_at = v_next_attempt_at,
      lease_token = NULL,
      lease_expires_at = NULL
  WHERE ne.id = p_notification_id;

  INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_id,
    target_name,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    metadata,
    created_at
  )
  VALUES (
    p_actor_user_id,
    'notification_event',
    p_notification_id,
    format('%s notification %s', COALESCE(v_event.event_type, 'platform'), p_notification_id),
    v_event.company_id,
    'notification_retry_queued',
    v_event.status,
    'pending',
    v_reason,
    jsonb_build_object(
      'notification_id', p_notification_id,
      'event_type', v_event.event_type,
      'entity_type', v_event.entity_type,
      'entity_id', v_event.entity_id,
      'attempt_count_before_retry', v_event.attempt_count,
      'last_attempt_at_before_retry', v_event.last_attempt_at,
      'lease_token_cleared', v_event.lease_token IS NOT NULL,
      'lease_expires_at_before_retry', v_event.lease_expires_at
    ),
    clock_timestamp()
  );

  RETURN QUERY
  SELECT p_notification_id, 'pending'::text, COALESCE(v_event.attempt_count, 0), v_next_attempt_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_retry_notification_event(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_retry_notification_event(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.owner_retry_notification_event(uuid, uuid, text)
IS 'Atomically requeues one failed/skipped notification event, clears any stale lease, preserves attempt history, and records the Platform Owner action.';

COMMIT;

NOTIFY pgrst, 'reload schema';
