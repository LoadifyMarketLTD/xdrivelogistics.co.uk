-- Individual-driver approval must not require or create a company workspace.

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
  v_full_name text;
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
  IF v_company_id IS NULL AND v_app.account_type <> 'individual_driver' THEN
    SELECT c.id
    INTO v_company_id
    FROM public.companies c
    WHERE c.created_by = v_app.user_id
    ORDER BY c.created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF p_action = 'approve' AND v_app.account_type <> 'individual_driver' AND v_company_id IS NULL THEN
    RAISE EXCEPTION 'Cannot approve onboarding without a linked company.' USING ERRCODE = '23514';
  END IF;

  IF p_action = 'approve' THEN
    IF v_app.account_type = 'individual_driver' THEN
      v_full_name := COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1));
      v_contact_phone := NULLIF(trim(v_app.payload->>'phone'), '');
      v_contact_email := COALESCE(NULLIF(trim(v_app.payload->>'email'), ''), v_app.email);

      UPDATE public.profiles
      SET full_name = COALESCE(v_full_name, full_name),
          phone = COALESCE(v_contact_phone, phone),
          role = 'driver',
          status = 'active',
          is_driver = true,
          company_id = NULL,
          updated_at = now()
      WHERE user_id = v_app.user_id;

      SELECT d.id
      INTO v_driver_id
      FROM public.drivers d
      WHERE d.user_id = v_app.user_id
      ORDER BY d.created_at DESC
      LIMIT 1
      FOR UPDATE;

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
          created_at,
          updated_at
        )
        VALUES (
          NULL,
          v_app.user_id,
          v_full_name,
          v_full_name,
          v_full_name,
          v_contact_phone,
          v_contact_email,
          'active',
          true,
          true,
          'offline',
          now(),
          now()
        );
      ELSE
        UPDATE public.drivers
        SET company_id = NULL,
            name = COALESCE(v_full_name, name),
            full_name = COALESCE(v_full_name, full_name),
            display_name = COALESCE(v_full_name, display_name),
            phone = COALESCE(v_contact_phone, phone),
            email = COALESCE(v_contact_email, email),
            status = 'active',
            is_active = true,
            app_access = true,
            updated_at = now()
        WHERE id = v_driver_id;
      END IF;
    ELSE
      PERFORM public.set_company_status_governance(
        p_actor_user_id,
        v_company_id,
        'company_approved',
        'active',
        COALESCE(NULLIF(trim(p_notes), ''), 'Onboarding approved')
      );

      INSERT INTO public.company_memberships (company_id, user_id, invited_email, role_in_company, status, updated_at)
      VALUES (v_company_id, v_app.user_id, v_app.email, 'owner', 'active', now())
      ON CONFLICT (company_id, user_id)
      DO UPDATE SET invited_email = EXCLUDED.invited_email,
                    role_in_company = EXCLUDED.role_in_company,
                    status = 'active',
                    updated_at = now();
    END IF;
  END IF;

  UPDATE public.onboarding_applications
  SET status = v_status,
      company_id = CASE
        WHEN v_app.account_type = 'individual_driver' THEN NULL
        ELSE COALESCE(company_id, v_company_id)
      END,
      reviewed_at = now(),
      reviewed_by = p_actor_user_id,
      review_notes = p_notes,
      current_step = CASE WHEN v_status = 'approved' THEN 'workspace_unlocked' ELSE 'pending_review' END,
      completion_percentage = CASE WHEN v_status = 'approved' THEN 100 ELSE completion_percentage END,
      last_activity_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.notification_events (event_type, entity_type, entity_id, company_id, recipient_user_id, payload)
  VALUES (
    CASE WHEN v_status = 'approved' THEN 'onboarding_approved' ELSE 'onboarding_review_updated' END,
    'onboarding_application',
    p_application_id,
    CASE WHEN v_app.account_type = 'individual_driver' THEN NULL ELSE v_company_id END,
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
    p_application_id,
    v_status,
    CASE WHEN v_app.account_type = 'individual_driver' THEN NULL::uuid ELSE v_company_id END;
END;
$$;

REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) TO service_role;
