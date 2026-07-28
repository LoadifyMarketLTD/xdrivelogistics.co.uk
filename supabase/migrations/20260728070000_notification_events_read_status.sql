-- Allow 'read' as a valid status on notification_events.
--
-- The mobile messages API (POST /api/driver/mobile/messages) marks individual
-- or all notification_events as read by setting status = 'read'. The existing
-- CHECK constraint only allows ('pending', 'sent', 'failed', 'skipped') and
-- must be extended to include 'read' for this to succeed.
--
-- The scrub trigger and retry-queue index are unaffected: they already filter
-- on specific status values and will continue to work correctly.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_status_check;

ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'read')) NOT VALID;

ALTER TABLE public.notification_events
  VALIDATE CONSTRAINT notification_events_status_check;

COMMIT;
