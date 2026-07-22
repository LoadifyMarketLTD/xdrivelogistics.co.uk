-- Remove single-use onboarding links and raw tokens from notification payloads
-- after a terminal delivery result. Failed/pending events retain the link only
-- while an authenticated retry remains possible.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE OR REPLACE FUNCTION public.scrub_notification_event_secrets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IN ('sent', 'skipped')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.payload := coalesce(NEW.payload, '{}'::jsonb)
      - 'onboarding_url'
      - 'token'
      - 'raw_token'
      - 'onboarding_token';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scrub_notification_event_secrets ON public.notification_events;
CREATE TRIGGER trg_scrub_notification_event_secrets
BEFORE UPDATE OF status ON public.notification_events
FOR EACH ROW
EXECUTE FUNCTION public.scrub_notification_event_secrets();

UPDATE public.notification_events
SET payload = coalesce(payload, '{}'::jsonb)
  - 'onboarding_url'
  - 'token'
  - 'raw_token'
  - 'onboarding_token'
WHERE status IN ('sent', 'skipped')
  AND payload ?| ARRAY['onboarding_url', 'token', 'raw_token', 'onboarding_token'];

REVOKE ALL ON FUNCTION public.scrub_notification_event_secrets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scrub_notification_event_secrets() TO service_role;

COMMIT;
