-- DRIFT-003: notification_events.recipient_user_id integrity contract.
-- Keep notifications when users are deleted, but clear the recipient pointer.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_events_recipient_user_id_fkey'
      AND conrelid = 'public.notification_events'::regclass
  ) THEN
    ALTER TABLE public.notification_events
      ADD CONSTRAINT notification_events_recipient_user_id_fkey
      FOREIGN KEY (recipient_user_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.notification_events
  VALIDATE CONSTRAINT notification_events_recipient_user_id_fkey;
