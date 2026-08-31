BEGIN;

-- Keep one canonical notification_events queue. Only the two document-remediation
-- event types are routed to their focused worker; all existing events continue
-- through notify-operational-event unchanged.
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
  _function_name text;
BEGIN
  SELECT value INTO _project_ref
  FROM public.app_settings
  WHERE key = 'supabase_project_ref'
  LIMIT 1;

  IF _project_ref IS NULL OR _project_ref = '' THEN
    RETURN NEW;
  END IF;

  _function_name := CASE
    WHEN NEW.event_type IN ('onboarding_documents_required', 'onboarding_documents_reminder')
      THEN 'notify-document-request'
    ELSE 'notify-operational-event'
  END;

  _edge_url := 'https://' || _project_ref || '.supabase.co/functions/v1/' || _function_name;

  SELECT value INTO _service_role_key
  FROM public.app_settings
  WHERE key = 'supabase_service_role_key'
  LIMIT 1;

  IF _service_role_key IS NULL OR _service_role_key = '' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := _edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_role_key
    ),
    body := jsonb_build_object('event_id', NEW.id, 'event_type', NEW.event_type)::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notification transport must never roll back the durable request/event row.
  RETURN NEW;
END;
$$;

COMMIT;
