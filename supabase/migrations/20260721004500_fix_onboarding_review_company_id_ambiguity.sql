-- Repair the deployed super-admin onboarding review function. Its TABLE return
-- column named company_id is also a PL/pgSQL output variable, so the unqualified
-- company_id reference in the UPDATE expression is ambiguous at runtime.

BEGIN;

CREATE OR REPLACE FUNCTION public.review_onboarding_application_atomic(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_notes text DEFAULT NULL::text
)
RETURNS TABLE (
  onboarding_application_id uuid,
  status text,
  company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_status text;
  v_company_id uuid;
BEGIN
  IF p_action NOT IN ('approve', 'reject', 'request_changes') THEN
    RAISE EXCEPTION 'Invalid review action.' USING ERRCODE = '22023';
  END IF;

  SELECT oa.*
  INTO v_app
  FROM public.onboarding_applications AS oa
  WHERE oa.id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  v_status := CASE p_action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    ELSE 'request_changes'
  END;

  v_company_id := v_app.company_id;
  IF v_company_id IS NULL THEN
    SELECT c.id
    INTO v_company_id
    FROM public.companies AS c
    WHERE c.created_by = v_app.user_id
    ORDER BY c.created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF p_action = 'approve' AND v_company_id IS NULL THEN
    RAISE EXCEPTION 'Cannot approve onboarding without a linked company.' USING ERRCODE = '23514';
  END IF;

  IF p_action = 'approve' THEN
    PERFORM public.set_company_status_governance(
      p_actor_user_id,
      v_company_id,
      'company_approved',
      'active',
      COALESCE(NULLIF(trim(p_notes), ''), 'Onboarding approved')
    );

    INSERT INTO public.company_memberships (
      company_id,
      user_id,
      role_in_company,
      status,
      updated_at
    )
    VALUES (
      v_company_id,
      v_app.user_id,
      'owner'::public.company_role,
      'active',
      now()
    )
    ON CONFLICT (company_id, user_id)
    DO UPDATE SET
      role_in_company = EXCLUDED.role_in_company,
      status = 'active',
      updated_at = now();
  END IF;

  UPDATE public.onboarding_applications AS oa
  SET
    status = v_status,
    company_id = COALESCE(oa.company_id, v_company_id),
    reviewed_at = now(),
    reviewed_by = p_actor_user_id,
    review_notes = p_notes,
    current_step = CASE
      WHEN v_status = 'approved' THEN 'workspace_unlocked'
      ELSE 'pending_review'
    END,
    completion_percentage = CASE
      WHEN v_status = 'approved' THEN 100
      ELSE oa.completion_percentage
    END,
    last_activity_at = now()
  WHERE oa.id = p_application_id;

  INSERT INTO public.notification_events (
    event_type,
    entity_type,
    entity_id,
    company_id,
    recipient_user_id,
    payload
  )
  VALUES (
    CASE
      WHEN v_status = 'approved' THEN 'onboarding_approved'
      ELSE 'onboarding_review_updated'
    END,
    'onboarding_application',
    p_application_id,
    v_company_id,
    v_app.user_id,
    jsonb_build_object(
      'onboarding_application_id', p_application_id,
      'action', p_action,
      'status', v_status,
      'notes', p_notes
    )
  );

  RETURN QUERY
  SELECT p_application_id, v_status, v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text)
  TO service_role;

COMMIT;
