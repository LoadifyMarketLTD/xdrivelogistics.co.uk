-- XDrive CRM: atomic manual prospect follow-up workflow.
-- ISOLATED STAGING ONLY. Not applied to Production.
-- No outbound email, dialling, scheduled dispatch or cross-tenant data transfer.

CREATE OR REPLACE FUNCTION public.crm_record_prospect_action(
  p_organisation_id uuid,
  p_contact_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_channel text,
  p_note text,
  p_follow_up_action text DEFAULT 'preserve',
  p_next_follow_up_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org public.crm_prospect_organisations%ROWTYPE;
  v_event_id uuid;
  v_new_status text;
  v_new_follow_up timestamptz;
BEGIN
  IF p_actor_id IS NULL OR p_organisation_id IS NULL
    OR p_event_type NOT IN (
      'research_completed', 'qualified', 'call_attempted', 'meeting_scheduled',
      'reply_received', 'onboarding_started', 'disqualified', 'note'
    )
    OR p_channel NOT IN ('email', 'phone', 'other')
    OR p_follow_up_action NOT IN ('preserve','schedule','clear')
    OR length(btrim(coalesce(p_note,''))) NOT BETWEEN 10 AND 2000
  THEN RAISE EXCEPTION 'Invalid CRM prospect action' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_org FROM public.crm_prospect_organisations
    WHERE id = p_organisation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prospect missing' USING ERRCODE = '23503'; END IF;
  IF v_org.status IN ('converted', 'disqualified') THEN
    RAISE EXCEPTION 'Closed prospect workflow cannot be modified'
      USING ERRCODE = '23514';
  END IF;

  IF p_contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.crm_prospect_contacts
    WHERE id = p_contact_id AND organisation_id = p_organisation_id
  ) THEN
    RAISE EXCEPTION 'Contact is not owned by this prospect' USING ERRCODE = '23503';
  END IF;

  IF p_event_type = 'disqualified' AND p_follow_up_action = 'schedule' THEN
    RAISE EXCEPTION 'Disqualified prospects cannot have future outreach tasks'
      USING ERRCODE = '23514';
  END IF;

  IF p_follow_up_action = 'schedule' THEN
    IF p_next_follow_up_at IS NULL OR p_next_follow_up_at <= now()
      OR p_next_follow_up_at > (now() + INTERVAL '3 years')
    THEN
      RAISE EXCEPTION 'Follow-up must be in the future and within three years'
        USING ERRCODE = '23514';
    END IF;
    v_new_follow_up := p_next_follow_up_at;
  ELSIF p_follow_up_action = 'clear' OR p_event_type = 'disqualified' THEN
    v_new_follow_up := NULL;
  ELSE
    v_new_follow_up := v_org.next_follow_up_at;
  END IF;

  v_new_status := CASE p_event_type
    WHEN 'research_completed' THEN
      CASE WHEN v_org.status = 'discovered' THEN 'researching' ELSE v_org.status END
    WHEN 'qualified' THEN 'qualified'
    -- A call attempt alone is not proof that a business was contacted.
    WHEN 'call_attempted' THEN v_org.status
    WHEN 'reply_received' THEN 'replied'
    WHEN 'onboarding_started' THEN 'onboarding'
    WHEN 'disqualified' THEN 'disqualified'
    ELSE v_org.status
  END;

  INSERT INTO public.crm_prospect_events(
    organisation_id, contact_id, actor_user_id, channel, event_type, note
  ) VALUES (
    p_organisation_id, p_contact_id, p_actor_id, p_channel, p_event_type, btrim(p_note)
  ) RETURNING id INTO v_event_id;

  UPDATE public.crm_prospect_organisations SET
    status = v_new_status,
    next_follow_up_at = v_new_follow_up,
    last_contacted_at = CASE
      WHEN p_event_type = 'reply_received' THEN now()
      ELSE last_contacted_at
    END,
    updated_at = now(),
    last_actor_id = p_actor_id,
    last_change_note = 'Manual CRM activity: ' || p_event_type
  WHERE id = p_organisation_id;

  RETURN jsonb_build_object(
    'organisation_id', p_organisation_id,
    'activity_id', v_event_id,
    'status', v_new_status,
    'next_follow_up_at', v_new_follow_up,
    'messages_sent', 0,
    'manual_entry', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_record_prospect_action(
  uuid, uuid, uuid, text, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_record_prospect_action(
  uuid, uuid, uuid, text, text, text, text, timestamptz
) TO service_role;
