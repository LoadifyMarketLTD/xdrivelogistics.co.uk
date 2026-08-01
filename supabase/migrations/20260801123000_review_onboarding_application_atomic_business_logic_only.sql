BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

CREATE OR REPLACE FUNCTION public.review_onboarding_application_atomic(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (
  onboarding_application_id uuid,
  status text,
  company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_status text;
  v_company_id uuid;
  v_driver_id uuid;
  v_contact_phone text;
  v_contact_email text;
BEGIN
  IF p_action NOT IN ('approve', 'reject', 'request_changes') THEN
    RAISE EXCEPTION 'Invalid review action.' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
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
    FROM public.companies c
    WHERE c.created_by = v_app.user_id
    ORDER BY c.created_at DESC
    LIMIT 1;
  END IF;

  IF p_action = 'approve' AND v_company_id IS NOT NULL THEN
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
      invited_email,
      role_in_company,
      status,
      updated_at
    )
    VALUES (
      v_company_id,
      v_app.user_id,
      v_app.email,
      'owner',
      'active',
      now()
    )
    ON CONFLICT ON CONSTRAINT company_memberships_company_id_user_id_key
    DO UPDATE SET
      invited_email = EXCLUDED.invited_email,
      role_in_company = EXCLUDED.role_in_company,
      status = 'active',
      updated_at = now();
  END IF;

  UPDATE public.onboarding_applications
  SET status = v_status,
      reviewed_by = p_actor_user_id,
      reviewed_at = now(),
      review_notes = COALESCE(p_notes, review_notes),
      company_id = COALESCE(v_company_id, v_app.company_id),
      current_step = CASE
        WHEN v_status = 'approved' THEN 'workspace_unlocked'
        ELSE 'pending_review'
      END,
      completion_percentage = CASE
        WHEN v_status = 'approved' THEN 100
        ELSE completion_percentage
      END,
      last_activity_at = now()
  WHERE id = p_application_id;

  IF p_action = 'approve'
     AND v_app.account_type IN ('owner_driver', 'individual_driver')
  THEN
    v_contact_phone := NULLIF(trim(v_app.payload->>'phone'), '');
    v_contact_email := COALESCE(NULLIF(trim(v_app.payload->>'email'), ''), v_app.email);

    SELECT id
    INTO v_driver_id
    FROM public.drivers
    WHERE user_id = v_app.user_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_driver_id IS NULL THEN
      INSERT INTO public.drivers (
        company_id,
        user_id,
        name,
        full_name,
        display_name,
        phone,
        email,
        status,
        is_active,
        app_access,
        availability_status,
        driver_type,
        can_commercial_bid
      )
      VALUES (
        NULL,
        v_app.user_id,
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        v_contact_phone,
        v_contact_email,
        'active',
        true,
        true,
        'offline',
        'owner_driver',
        true
      )
      RETURNING id INTO v_driver_id;
    ELSE
      UPDATE public.drivers
      SET name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), name),
          full_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), full_name),
          display_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), display_name),
          phone = COALESCE(v_contact_phone, phone),
          email = COALESCE(v_contact_email, email),
          driver_type = CASE
            WHEN driver_type IN ('individual_driver', 'subcontractor') THEN 'owner_driver'
            ELSE COALESCE(driver_type, 'owner_driver')
          END,
          can_commercial_bid = true,
          updated_at = now()
      WHERE id = v_driver_id;
    END IF;
  END IF;

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
  SELECT
    v_app.id,
    v_status,
    COALESCE(v_company_id, v_app.company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
