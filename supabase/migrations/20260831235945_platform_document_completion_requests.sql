BEGIN;

CREATE TABLE IF NOT EXISTS public.platform_document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_application_id uuid NOT NULL REFERENCES public.onboarding_applications(id) ON DELETE CASCADE,
  company_id uuid NULL REFERENCES public.companies(id) ON DELETE SET NULL,
  recipient_user_id uuid NOT NULL,
  recipient_email text NOT NULL,
  requested_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding','resolved','cancelled')),
  reason text NOT NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  reminder_count integer NOT NULL DEFAULT 0 CHECK (reminder_count >= 0),
  resolved_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_document_requests_application_status_idx
  ON public.platform_document_requests(onboarding_application_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS platform_document_requests_recipient_status_idx
  ON public.platform_document_requests(recipient_user_id, status, requested_at DESC);

ALTER TABLE public.platform_document_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_document_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_document_requests TO service_role;

CREATE OR REPLACE FUNCTION public.owner_request_onboarding_documents(
  p_actor_user_id uuid,
  p_application_id uuid,
  p_reason text,
  p_is_reminder boolean DEFAULT false
)
RETURNS TABLE(
  request_id uuid,
  recipient_user_id uuid,
  recipient_email text,
  missing_documents jsonb,
  notification_event_id uuid,
  reminder_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.onboarding_applications%ROWTYPE;
  v_reason text := NULLIF(trim(COALESCE(p_reason, '')), '');
  v_missing jsonb := '[]'::jsonb;
  v_request public.platform_document_requests%ROWTYPE;
  v_event_id uuid;
  v_existing_id uuid;
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Platform Owner actor is required.' USING ERRCODE = '23502';
  END IF;
  PERFORM public.assert_platform_owner_actor(p_actor_user_id);

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required when requesting onboarding documents.' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_application
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_application.user_id IS NULL OR NULLIF(trim(COALESCE(v_application.email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'The onboarding application has no canonical recipient user/email.' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT COALESCE(
    NULLIF(trim(to_jsonb(m)->>'doc_type'), ''),
    NULLIF(trim(to_jsonb(m)->>'required_doc_type'), ''),
    NULLIF(trim(to_jsonb(m)->>'document_type'), '')
  )) FILTER (WHERE COALESCE(
    NULLIF(trim(to_jsonb(m)->>'doc_type'), ''),
    NULLIF(trim(to_jsonb(m)->>'required_doc_type'), ''),
    NULLIF(trim(to_jsonb(m)->>'document_type'), '')
  ) IS NOT NULL), '[]'::jsonb)
  INTO v_missing
  FROM public.get_missing_onboarding_documents(p_application_id) AS m;

  IF jsonb_array_length(v_missing) = 0 THEN
    RAISE EXCEPTION 'No missing onboarding documents remain for this application.' USING ERRCODE = '23514';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.platform_document_requests
  WHERE onboarding_application_id = p_application_id
    AND status = 'outstanding'
  ORDER BY requested_at DESC
  LIMIT 1
  FOR UPDATE;

  IF p_is_reminder AND v_existing_id IS NULL THEN
    RAISE EXCEPTION 'No outstanding document request exists to remind.' USING ERRCODE = '23514';
  END IF;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.platform_document_requests (
      onboarding_application_id, company_id, recipient_user_id, recipient_email,
      requested_documents, reason, requested_by, requested_at, last_sent_at,
      reminder_count, metadata
    ) VALUES (
      p_application_id, v_application.company_id, v_application.user_id, trim(v_application.email),
      v_missing, v_reason, p_actor_user_id, now(), now(), 0,
      jsonb_build_object('channel_primary','email','onboarding_status',v_application.status)
    ) RETURNING * INTO v_request;
  ELSE
    UPDATE public.platform_document_requests
    SET requested_documents = v_missing,
        reason = v_reason,
        recipient_email = trim(v_application.email),
        last_sent_at = now(),
        reminder_count = reminder_count + CASE WHEN p_is_reminder THEN 1 ELSE 0 END,
        updated_at = now(),
        metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('onboarding_status',v_application.status)
    WHERE id = v_existing_id
    RETURNING * INTO v_request;
  END IF;

  INSERT INTO public.notification_events (
    event_type, entity_type, entity_id, company_id, recipient_user_id,
    idempotency_key, payload
  ) VALUES (
    CASE WHEN p_is_reminder THEN 'onboarding_documents_reminder' ELSE 'onboarding_documents_required' END,
    'onboarding_application', p_application_id, v_application.company_id, v_application.user_id,
    format('onboarding-documents:%s:%s:%s', v_request.id, v_request.reminder_count, extract(epoch from v_request.last_sent_at)::bigint),
    jsonb_build_object(
      'document_request_id', v_request.id,
      'onboarding_application_id', p_application_id,
      'recipient_user_id', v_application.user_id,
      'missing_documents', v_missing,
      'reason', v_reason,
      'onboarding_url', '/onboarding/resume',
      'email_required', true,
      'in_app_supplemental', true,
      'push_supplemental', true,
      'reminder_count', v_request.reminder_count
    )
  ) RETURNING id INTO v_event_id;

  INSERT INTO public.owner_audit_log (
    target_type, target_id, target_name, target_company_id, actor_user_id,
    action_type, old_status, new_status, reason, created_at
  ) VALUES (
    'onboarding_application', p_application_id,
    format('Onboarding application %s', p_application_id), v_application.company_id,
    p_actor_user_id,
    CASE WHEN p_is_reminder THEN 'onboarding_documents_reminder' ELSE 'onboarding_documents_requested' END,
    v_application.status::text, v_application.status::text,
    format('%s | documents=%s | recipient=%s', v_reason, v_missing::text, trim(v_application.email)),
    now()
  );

  RETURN QUERY SELECT v_request.id, v_request.recipient_user_id, v_request.recipient_email,
    v_request.requested_documents, v_event_id, v_request.reminder_count;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_request_onboarding_documents(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_request_onboarding_documents(uuid, uuid, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_completed_document_requests(p_application_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_missing_count integer := 0;
  v_updated integer := 0;
BEGIN
  SELECT count(*) INTO v_missing_count
  FROM public.get_missing_onboarding_documents(p_application_id);

  IF v_missing_count = 0 THEN
    UPDATE public.platform_document_requests
    SET status = 'resolved', resolved_at = COALESCE(resolved_at, now()), updated_at = now()
    WHERE onboarding_application_id = p_application_id AND status = 'outstanding';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;
  RETURN v_updated;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_completed_document_requests(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_completed_document_requests(uuid) TO service_role;

COMMIT;
