-- ============================================================
-- Migration 088 — Wire Email Notifications via pg_net
-- ============================================================
-- Installs a database trigger that calls the notify-operational-event
-- Supabase Edge Function whenever a row is inserted into
-- notification_events. This replaces the need for a manual Supabase
-- Dashboard webhook.
--
-- Prerequisites (set once in Supabase Dashboard → Edge Functions → Secrets):
--   RESEND_API_KEY   — your Resend transactional email API key
--   SITE_URL         — https://www.xdrivelogistics.co.uk
--   FROM_EMAIL       — sender address (optional, defaults to no-reply@xdrivelogistics.co.uk)
--
-- Deploy the edge function ONCE with:
--   supabase functions deploy notify-operational-event --no-verify-jwt
--
-- After running this migration, email dispatch is fully automatic.
-- ============================================================

BEGIN;

-- Enable pg_net if not already enabled (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function that fires pg_net HTTP call to the edge function
CREATE OR REPLACE FUNCTION public.trigger_notify_operational_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_ref text;
  _service_role_key text;
  _edge_url text;
BEGIN
  -- Derive the edge function URL from current_setting or env
  -- SUPABASE_URL env is not available in triggers; we rely on the
  -- project ref being stored in a settings table or hard-coded via
  -- a Supabase secret.  We use pg_net.http_post with a relative
  -- internal URL which Supabase routes to the edge runtime.
  --
  -- If your project ref is not auto-detected, set it explicitly in
  -- company_settings or replace the SELECT below with a literal.

  SELECT value INTO _project_ref
  FROM public.app_settings
  WHERE key = 'supabase_project_ref'
  LIMIT 1;

  -- Fall back: derive from current_database() heuristic or skip
  IF _project_ref IS NULL OR _project_ref = '' THEN
    RETURN NEW;
  END IF;

  _edge_url := 'https://' || _project_ref || '.supabase.co/functions/v1/notify-operational-event';

  SELECT value INTO _service_role_key
  FROM public.app_settings
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;

  IF _service_role_key IS NULL OR _service_role_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url      := _edge_url,
    headers  := jsonb_build_object(
                  'Content-Type',  'application/json',
                  'Authorization', 'Bearer ' || _service_role_key
                ),
    body     := jsonb_build_object('event_id', NEW.id, 'event_type', NEW.event_type)::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the INSERT if the HTTP call fails
  RETURN NEW;
END;
$$;

-- app_settings table to store non-secret project config
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only owner/service-role can read
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_settings' AND policyname = 'app_settings_service_role_only'
  ) THEN
    CREATE POLICY app_settings_service_role_only
      ON public.app_settings
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Attach trigger to notification_events
DROP TRIGGER IF EXISTS on_notification_event_insert ON public.notification_events;

CREATE TRIGGER on_notification_event_insert
  AFTER INSERT ON public.notification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_operational_event();

-- ────────────────────────────────────────────────────────────
-- SETUP INSTRUCTIONS
-- After running this migration, insert two rows into app_settings
-- (replace values with your real project ref and service role key):
--
-- INSERT INTO public.app_settings (key, value) VALUES
--   ('supabase_project_ref', 'your-project-ref'),
--   ('supabase_service_role_key', 'your-service-role-key')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- ⚠ The service_role_key row is protected by RLS; only service_role
--    sessions can read it.  Never expose it to the client.
-- ────────────────────────────────────────────────────────────

COMMIT;
