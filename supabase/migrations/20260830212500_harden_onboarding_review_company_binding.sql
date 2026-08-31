BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- The canonical onboarding review path must never infer a company relationship
-- from companies.created_by. Approval may use only the company explicitly bound
-- to the onboarding application. This also makes approval idempotent for an
-- already-active company instead of attempting an invalid active -> active
-- governance transition.
CREATE OR REPLACE FUNCTION public.review_onboarding_application_atomic_authority_base_v1(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(onboarding_application_id uuid, status text, company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_status text;
  v_company_id uuid;
  v_company_status text;
  v_company_required boolean;
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

  -- Explicit application binding is authoritative. Do not fall back to the most
  -- recent company created by the user: that can turn historical provenance into
  -- a new authority grant.
  v_company_id := v_app.company_id;
  v_company_required := lower(trim(COALESCE(v_app.account_type::text, ''))) IN (
    'broker_shipper',
    'fleet_courier',
    'owner_driver',
    'individual_driver',
    'company_driver'
  );

  IF p_action = 'approve' AND v_company_required AND v_company_id IS NULL THEN
    RAISE EXCEPTION 'Company-bound onboarding requires an explicit canonical company binding before approval.'
      USING ERRCODE = '23514';
  END IF;

  IF p_action = 'approve' AND v_company_id IS NOT NULL THEN
    SELECT c.status::text
    INTO v_company_status
    FROM public.companies c
    WHERE c.id = v_company_id
    FOR UPDATE;

    IF v_company_status IS NULL THEN
      RAISE EXCEPTION 'Bound onboarding company does not exist.' USING ERRCODE = 'P0002';
    END IF;

    IF v_company_status IN ('rejected', 'suspended', 'inactive') THEN
      RAISE EXCEPTION 'Company governance status blocks onboarding approval: %', v_company_status
        USING ERRCODE = '23514';
    ELSIF v_company_status IN ('pending_approval', 'approved') THEN
      PERFORM public.set_company_status_governance(
        p_actor_user_id,
        v_company_id,
        'company_approved',
        'active',
        COALESCE(NULLIF(trim(p_notes), ''), 'Onboarding approved')
      );
    ELSIF v_company_status = 'active' THEN
      -- The company is already governed active. Re-validate current compliance
      -- without manufacturing an invalid active -> active status transition.
      PERFORM public.assert_company_compliance_ready(v_company_id);
    ELSE
      RAISE EXCEPTION 'Company governance status is not approvable: %', v_company_status
        USING ERRCODE = '23514';
    END IF;

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
      company_id = v_app.company_id,
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
  SELECT v_app.id, v_status, v_company_id;
END;
$$;

-- Internal implementation detail. Only the service-role outer review RPC is a
-- callable platform boundary.
REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic_authority_base_v1(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
