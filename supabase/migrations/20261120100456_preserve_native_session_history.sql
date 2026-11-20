BEGIN;
CREATE TABLE IF NOT EXISTS public.driver_mobile_session_history (
 auth_session_id uuid PRIMARY KEY,
 installation_id uuid NOT NULL,
 user_id uuid NOT NULL,
 driver_id uuid NOT NULL,
 revoked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.driver_mobile_session_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.driver_mobile_session_history FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.driver_mobile_session_history TO service_role;
CREATE INDEX IF NOT EXISTS driver_mobile_session_history_driver_idx ON public.driver_mobile_session_history (driver_id, user_id);
CREATE OR REPLACE FUNCTION public.preserve_driver_mobile_session_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF OLD.auth_session_id IS DISTINCT FROM NEW.auth_session_id
 OR (OLD.enabled IS TRUE AND NEW.enabled IS FALSE)
 OR (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL) THEN
 INSERT INTO public.driver_mobile_session_history (auth_session_id,installation_id,user_id,driver_id,revoked_at)
 VALUES (OLD.auth_session_id,OLD.installation_id,OLD.user_id,OLD.driver_id,COALESCE(OLD.revoked_at,NEW.revoked_at,now()))
 ON CONFLICT (auth_session_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.preserve_driver_mobile_session_history() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS preserve_driver_mobile_session_history_trigger ON public.driver_mobile_device_sessions;
CREATE TRIGGER preserve_driver_mobile_session_history_trigger BEFORE UPDATE ON public.driver_mobile_device_sessions FOR EACH ROW EXECUTE FUNCTION public.preserve_driver_mobile_session_history();
INSERT INTO public.driver_mobile_session_history (auth_session_id,installation_id,user_id,driver_id,revoked_at)
SELECT auth_session_id,installation_id,user_id,driver_id,COALESCE(revoked_at,now())
FROM public.driver_mobile_device_sessions WHERE enabled IS FALSE OR revoked_at IS NOT NULL
ON CONFLICT (auth_session_id) DO NOTHING;
COMMIT;
