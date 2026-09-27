-- Full-audit hardening: pin the search_path for the immutable notification
-- classifier so it cannot inherit a caller-controlled path.
BEGIN;

ALTER FUNCTION public.fn_notification_event_class(text)
  SET search_path = pg_catalog, public;

COMMIT;

NOTIFY pgrst, 'reload schema';
