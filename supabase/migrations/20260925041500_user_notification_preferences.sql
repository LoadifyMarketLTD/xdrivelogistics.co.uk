BEGIN;

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_class text NOT NULL CHECK (event_class IN ('operational','marketplace','finance','account')),
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_class)
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_notification_preferences TO authenticated;

DROP POLICY IF EXISTS user_notification_preferences_own ON public.user_notification_preferences;
CREATE POLICY user_notification_preferences_own ON public.user_notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.fn_notification_event_class(p_event_type text)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY INVOKER AS $$
  SELECT CASE
    WHEN p_event_type IN ('load_alert','bid_accepted','bid_rejected','carrier_invited','carrier_accepted','carrier_rejected') THEN 'marketplace'
    WHEN p_event_type IN ('invoice_created','invoice_dispute','invoice_disputed','invoice_paid','payment_received') THEN 'finance'
    WHEN p_event_type LIKE 'onboarding_%' OR p_event_type IN ('membership_invite','membership_changed') THEN 'account'
    ELSE 'operational'
  END;
$$;

CREATE OR REPLACE FUNCTION public.fn_notification_channel_enabled(
  p_user_id uuid,
  p_event_type text,
  p_channel text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_notification_preferences%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN RETURN true; END IF;
  SELECT * INTO v_row
  FROM public.user_notification_preferences
  WHERE user_id = p_user_id
    AND event_class = public.fn_notification_event_class(p_event_type);
  IF NOT FOUND THEN RETURN true; END IF;
  IF p_channel = 'in_app' THEN RETURN v_row.in_app_enabled; END IF;
  IF p_channel = 'email' THEN RETURN v_row.email_enabled; END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notification_channel_enabled(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notification_channel_enabled(uuid,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_bridge_notification_event_to_inbox()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.recipient_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.fn_notification_channel_enabled(NEW.recipient_user_id, NEW.event_type, 'in_app') = false THEN
    RETURN NEW;
  END IF;

  IF NEW.event_type = 'load_alert'
     AND COALESCE((NEW.payload->>'in_app_enabled')::boolean, true) = false THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    id, company_id, user_id, title, body, type, created_at
  ) VALUES (
    NEW.id,
    NEW.company_id,
    NEW.recipient_user_id,
    public.fn_notification_event_title(NEW.event_type),
    public.fn_notification_event_body(NEW.event_type, NEW.payload),
    NEW.event_type,
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_bridge_notification_event_to_inbox() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.user_notification_preferences IS
  'Per-user notification preferences for canonical XDrive in-app and email event classes. Load Alert push remains managed by its dedicated alert preferences.';

NOTIFY pgrst, 'reload schema';

COMMIT;
