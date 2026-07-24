-- Individual drivers are people joining the driver network, not carrier
-- businesses. Their onboarding submission must never create a company,
-- company membership, owner-driver vehicle, or business workspace.

CREATE OR REPLACE FUNCTION public.submit_individual_driver_onboarding(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_doc_type text;
BEGIN
  SELECT *
  INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_app.account_type <> 'individual_driver' THEN
    RAISE EXCEPTION 'Application is not an individual-driver onboarding.' USING ERRCODE = '23514';
  END IF;

  IF v_app.status NOT IN ('draft', 'in_progress', 'request_changes', 'submitted', 'under_review') THEN
    RAISE EXCEPTION 'Onboarding application cannot be submitted from status %.', v_app.status
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), full_name),
      phone = COALESCE(NULLIF(trim(v_app.payload->>'phone'), ''), phone),
      role = 'driver',
      status = 'active',
      is_driver = true,
      updated_at = now()
  WHERE user_id = v_app.user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (
      user_id,
      full_name,
      phone,
      role,
      status,
      company_id,
      is_driver,
      created_at,
      updated_at
    )
    VALUES (
      v_app.user_id,
      COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
      NULLIF(trim(v_app.payload->>'phone'), ''),
      'driver',
      'active',
      NULL,
      true,
      now(),
      now()
    );
  END IF;

  FOREACH v_doc_type IN ARRAY ARRAY[
    'driving_licence',
    'proof_of_address',
    'right_to_work',
    'visa_document'
  ] LOOP
    INSERT INTO public.driver_identity_documents (
      onboarding_application_id,
      doc_type,
      upload_status,
      verification_status
    )
    VALUES (v_app.id, v_doc_type, 'missing', 'unverified')
    ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE public.onboarding_applications
  SET status = 'submitted',
      company_id = NULL,
      current_step = 'pending_review',
      completion_percentage = 100,
      submitted_at = COALESCE(submitted_at, now()),
      last_activity_at = now()
  WHERE id = v_app.id;

  RETURN v_app.id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_individual_driver_onboarding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_individual_driver_onboarding(uuid) TO service_role;
