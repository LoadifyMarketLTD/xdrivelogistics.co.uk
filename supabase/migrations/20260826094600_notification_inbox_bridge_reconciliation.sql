BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('public.notification_events') IS NULL THEN
    RAISE EXCEPTION 'notification_events table is required.';
  END IF;
  IF to_regclass('public.notifications') IS NULL THEN
    RAISE EXCEPTION 'notifications table is required.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_notification_event_title(p_event_type text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT CASE p_event_type
    WHEN 'job_assigned' THEN 'Job assigned to you'
    WHEN 'bid_accepted' THEN 'Your bid was accepted'
    WHEN 'pod_uploaded' THEN 'POD uploaded — job delivered'
    WHEN 'tracking_eta_alert' THEN 'Traffic ETA alert'
    WHEN 'invoice_dispute' THEN 'Invoice dispute raised'
    WHEN 'invoice_created' THEN 'Invoice created'
    WHEN 'onboarding_invite' THEN 'Complete onboarding'
    WHEN 'onboarding_approved' THEN 'Onboarding approved'
    ELSE initcap(replace(COALESCE(p_event_type, 'notification'), '_', ' '))
  END
$$;

CREATE OR REPLACE FUNCTION public.fn_notification_event_body(p_event_type text, p_payload jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $$
  SELECT CASE p_event_type
    WHEN 'job_assigned' THEN COALESCE(NULLIF(trim(COALESCE(p_payload->>'pickup_location','')),'') || ' → ' || NULLIF(trim(COALESCE(p_payload->>'delivery_location','')),''), 'Check your jobs list for details.')
    WHEN 'tracking_eta_alert' THEN COALESCE(NULLIF(trim(COALESCE(p_payload->>'message','')),''), 'Traffic conditions may affect the planned delivery time.')
    WHEN 'pod_uploaded' THEN COALESCE(NULLIF(trim(COALESCE(p_payload->>'message','')),''), 'The delivery has been completed and POD is available.')
    ELSE COALESCE(NULLIF(trim(COALESCE(p_payload->>'message','')),''), 'Open XDrive for details.')
  END
$$;

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

DROP TRIGGER IF EXISTS trg_bridge_notification_event_to_inbox ON public.notification_events;
CREATE TRIGGER trg_bridge_notification_event_to_inbox
  AFTER INSERT ON public.notification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_bridge_notification_event_to_inbox();

-- Deliberately do not change notifications table grants or RLS policies here.
-- Production already has working recipient-scoped SELECT/UPDATE/DELETE policies
-- used by Android for load, mark-read and delete operations.

NOTIFY pgrst, 'reload schema';

COMMIT;
