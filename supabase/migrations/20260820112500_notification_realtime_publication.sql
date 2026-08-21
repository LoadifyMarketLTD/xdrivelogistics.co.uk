-- PreLive P1 closure: make the in-app notification Realtime dependency
-- reproducible from migrations instead of relying on dashboard-only state.
--
-- NotificationBell subscribes to postgres_changes on public.notification_events.
-- Recipient/company isolation is enforced by the existing RLS policy
-- notification_events_select_recipient_or_company_broadcast; this migration
-- changes publication membership only and does not broaden table privileges.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('public.notification_events') IS NULL THEN
    RAISE EXCEPTION 'notification_events table is required before Realtime publication can be reconciled.'
      USING ERRCODE = '42P01';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'Supabase Realtime publication supabase_realtime is missing; refusing to silently create a non-canonical publication.'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notification_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_events;
  END IF;
END
$$;

COMMIT;
