BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- Platform Owner notification retry is a governance action. The queue mutation
-- and owner audit record must commit or roll back together.
DO $preflight$
BEGIN
  IF to_regclass('public.notification_events') IS NULL THEN
    RAISE EXCEPTION 'public.notification_events must exist before applying Platform Owner notification retry.'
      USING ERRCODE = '23514';
  END IF;

  IF to_regclass('public.owner_audit_log') IS NULL THEN
    RAISE EXCEPTION 'public.owner_audit_log must exist before applying Platform Owner notification retry.'
      USING ERRCODE = '23514';
  END IF;

  IF to_regprocedure('public.assert_platform_owner_actor(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.assert_platform_owner_actor(uuid) must exist before applying Platform Owner notification retry.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notification_events'
      AND column_name IN ('attempt_count', 'last_error', 'next_attempt_at')
    GROUP BY table_schema, table_name
    HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'notification_events durability columns are required before applying Platform Owner notification retry.'
      USING ERRCODE = '23514';
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
    RAISE EXCEPTION 'A notification retry reason of at least 5 characters is required.'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    event_row.id,
    event_row.event_type,
    event_row.entity_type,
    event_row.entity_id,
    event_row.company_id,
    event_row.status::text AS status,
    event_row.attempt_count
  INTO v_event
  FROM public.notification_events AS event_row
  WHERE event_row.id = p_notification_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification event not found.' USING ERRCODE = 'P0002';
  END IF;

  IF lower(COALESCE(v_event.status, '')) NOT IN ('failed', 'skipped') THEN
    RAISE EXCEPTION 'Notification cannot be retried from status %.', COALESCE(v_event.status, 'unknown')
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.notification_events AS event_row
  SET
    status = 'pending',
    processed_at = NULL,
    last_error = NULL,
    next_attempt_at = v_next_attempt_at
  WHERE event_row.id = p_notification_id;

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
      'attempt_count_before_retry', v_event.attempt_count
    ),
    clock_timestamp()
  );

  RETURN QUERY
  SELECT
    p_notification_id,
    'pending'::text,
    COALESCE(v_event.attempt_count, 0),
    v_next_attempt_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_retry_notification_event(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owner_retry_notification_event(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.owner_retry_notification_event(uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.owner_retry_notification_event(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.owner_retry_notification_event(uuid, uuid, text)
IS 'Atomically queues one failed/skipped notification event for retry and records the Platform Owner action in owner_audit_log.';

COMMIT;

NOTIFY pgrst, 'reload schema';
