-- Real-database PreLive P1 notification queue regression test.
-- Run only against a disposable/local/staging database after all migrations.
-- No provider call is made: the INSERT dispatcher trigger is disabled inside
-- this transaction and the transaction is always rolled back.

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(1);

CREATE OR REPLACE FUNCTION pg_temp.assert_true(p_condition boolean, p_message text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_condition IS DISTINCT FROM true THEN
    RAISE EXCEPTION '%', p_message;
  END IF;
END;
$$;

SELECT pg_temp.assert_true(
  NOT has_function_privilege(
    'authenticated',
    'public.claim_notification_events(uuid, integer)',
    'EXECUTE'
  ),
  'Authenticated role can execute the notification queue claim RPC.'
);

SELECT pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.claim_notification_events(uuid, integer)',
    'EXECUTE'
  ),
  'Service role cannot execute the notification queue claim RPC.'
);

SELECT pg_temp.assert_true(
  position(
    'jqxlauexhkonixtjvljw'
    in pg_get_functiondef('public.dispatch_due_notification_events()'::regprocedure)
  ) > 0,
  'Notification dispatcher is not pinned to the XDrive Supabase project ref.'
);

SELECT pg_temp.assert_true(
  position(
    'net.http_post'
    in pg_get_functiondef('public.dispatch_due_notification_events()'::regprocedure)
  ) > 0,
  'Notification dispatcher is not using the canonical pg_net HTTP API.'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ),
  'Canonical Supabase Realtime publication is missing.'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notification_events'
  ),
  'notification_events is not published through supabase_realtime.'
);

SELECT pg_temp.assert_true(
  COALESCE(
    (
      SELECT c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'notification_events'
    ),
    false
  ),
  'notification_events RLS is not enabled.'
);

SELECT pg_temp.assert_true(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_events'
      AND policyname = 'notification_events_select_recipient_or_company_broadcast'
      AND cmd = 'SELECT'
  ),
  'Notification recipient/company-broadcast isolation policy is missing.'
);

ALTER TABLE public.notification_events
  DISABLE TRIGGER on_notification_event_insert;

INSERT INTO public.notification_events (
  id,
  event_type,
  entity_type,
  entity_id,
  company_id,
  recipient_user_id,
  payload,
  status,
  attempt_count,
  next_attempt_at
)
VALUES (
  '22000000-0000-0000-0000-000000000001',
  'prelive_retry_probe',
  'prelive_probe',
  '22000000-0000-0000-0000-000000000002',
  NULL,
  NULL,
  '{}'::jsonb,
  'pending',
  0,
  now() - interval '1 minute'
);

DO $$
DECLARE
  v_claimed integer;
  v_lease_token uuid;
  v_lease_expires_at timestamptz;
BEGIN
  SELECT count(*)
  INTO v_claimed
  FROM public.claim_notification_events(
    '22000000-0000-0000-0000-000000000001',
    1
  );

  IF v_claimed <> 1 THEN
    RAISE EXCEPTION 'Expected first notification claim to return one row, got %.', v_claimed;
  END IF;

  SELECT lease_token, lease_expires_at
  INTO v_lease_token, v_lease_expires_at
  FROM public.notification_events
  WHERE id = '22000000-0000-0000-0000-000000000001';

  IF v_lease_token IS NULL OR v_lease_expires_at IS NULL OR v_lease_expires_at <= now() THEN
    RAISE EXCEPTION 'Notification claim did not persist a live expiring lease.';
  END IF;

  SELECT count(*)
  INTO v_claimed
  FROM public.claim_notification_events(
    '22000000-0000-0000-0000-000000000001',
    1
  );

  IF v_claimed <> 0 THEN
    RAISE EXCEPTION 'A live notification lease was claimed twice.';
  END IF;
END;
$$;

UPDATE public.notification_events
SET status = 'failed',
    lease_expires_at = now() - interval '1 minute',
    next_attempt_at = now() - interval '1 minute'
WHERE id = '22000000-0000-0000-0000-000000000001';

DO $$
DECLARE
  v_claimed integer;
BEGIN
  SELECT count(*)
  INTO v_claimed
  FROM public.claim_notification_events(
    '22000000-0000-0000-0000-000000000001',
    1
  );

  IF v_claimed <> 1 THEN
    RAISE EXCEPTION 'Expired notification lease was not recoverable; got % rows.', v_claimed;
  END IF;
END;
$$;

SELECT pass('Notification retry lease/recovery, Realtime publication/isolation and XDrive dispatcher DB contract passed.');
SELECT * FROM finish();
ROLLBACK;
