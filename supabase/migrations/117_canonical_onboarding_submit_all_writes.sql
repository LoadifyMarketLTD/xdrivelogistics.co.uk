-- Final canonical onboarding submit path: all submit-time writes for customer,
-- broker, fleet, and owner-driver are performed in one database transaction.

CREATE OR REPLACE FUNCTION public.submit_onboarding_application(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_company_id uuid;
  v_company_name text;
  v_contact_email text;
  v_contact_phone text;
  v_address text;
  v_role text;
  v_next_status text;
  v_doc_type text;
  v_driver_id uuid;
BEGIN
  SELECT *
  INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_app.status NOT IN ('draft', 'in_progress', 'request_changes', 'submitted', 'under_review') THEN
    RAISE EXCEPTION 'Onboarding application cannot be submitted from status %.', v_app.status
      USING ERRCODE = '23514';
  END IF;

  v_company_name := COALESCE(
    NULLIF(trim(v_app.payload->>'company_name'), ''),
    NULLIF(trim(v_app.payload->>'legal_company_name'), ''),
    NULLIF(trim(v_app.payload->>'trading_name'), ''),
    NULLIF(trim(v_app.payload->>'full_name'), ''),
    split_part(v_app.email, '@', 1) || ' workspace'
  );
  v_contact_email := COALESCE(NULLIF(trim(v_app.payload->>'contact_email'), ''), NULLIF(trim(v_app.payload->>'email'), ''), v_app.email);
  v_contact_phone := COALESCE(NULLIF(trim(v_app.payload->>'contact_phone'), ''), NULLIF(trim(v_app.payload->>'phone'), ''), NULL);
  v_address := COALESCE(
    NULLIF(trim(v_app.payload->>'billing_address'), ''),
    NULLIF(trim(v_app.payload->>'registered_address'), ''),
    NULLIF(trim(v_app.payload->>'address'), ''),
    NULL
  );

  SELECT id
  INTO v_company_id
  FROM public.companies
  WHERE created_by = v_app.user_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (
      name,
      email,
      phone,
      address_line1,
      company_number,
      vat_number,
      status,
      company_type,
      created_by
    )
    VALUES (
      v_company_name,
      v_contact_email,
      v_contact_phone,
      v_address,
      NULLIF(trim(v_app.payload->>'company_number'), ''),
      NULLIF(trim(v_app.payload->>'vat_number'), ''),
      CASE WHEN v_app.account_type = 'customer_shipper' THEN 'active' ELSE 'pending_approval' END,
      CASE
        WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
        WHEN v_app.account_type = 'broker_shipper' THEN 'broker'
        WHEN v_app.account_type = 'fleet_courier' THEN 'carrier'
        WHEN v_app.account_type = 'owner_driver' THEN 'owner_driver'
        ELSE 'standard'
      END,
      v_app.user_id
    )
    RETURNING id INTO v_company_id;
  ELSE
    UPDATE public.companies
    SET name = v_company_name,
        email = v_contact_email,
        phone = v_contact_phone,
        address_line1 = v_address,
        company_number = COALESCE(NULLIF(trim(v_app.payload->>'company_number'), ''), company_number),
        vat_number = COALESCE(NULLIF(trim(v_app.payload->>'vat_number'), ''), vat_number)
    WHERE id = v_company_id;
  END IF;

  v_role := CASE WHEN v_app.account_type = 'customer_shipper' THEN 'admin' ELSE 'owner' END;

  INSERT INTO public.company_memberships (company_id, user_id, invited_email, role_in_company, status, updated_at)
  VALUES (v_company_id, v_app.user_id, v_contact_email, v_role, 'active', now())
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET invited_email = EXCLUDED.invited_email,
                role_in_company = EXCLUDED.role_in_company,
                status = 'active',
                updated_at = now();

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), NULLIF(trim(v_app.payload->>'contact_person'), ''), full_name),
      phone = COALESCE(v_contact_phone, phone),
      company_id = v_company_id,
      role = CASE
        WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
        WHEN v_app.account_type = 'owner_driver' THEN 'driver'
        ELSE role
      END,
      status = CASE WHEN v_app.account_type IN ('customer_shipper', 'owner_driver') THEN 'active' ELSE status END,
      is_driver = CASE WHEN v_app.account_type = 'owner_driver' THEN true ELSE is_driver END,
      updated_at = now()
  WHERE user_id = v_app.user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (user_id, full_name, phone, role, status, company_id, is_driver, created_at, updated_at)
    VALUES (
      v_app.user_id,
      COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), NULLIF(trim(v_app.payload->>'contact_person'), ''), split_part(v_app.email, '@', 1)),
      v_contact_phone,
      CASE WHEN v_app.account_type = 'owner_driver' THEN 'driver' WHEN v_app.account_type = 'customer_shipper' THEN 'customer' ELSE 'company_admin' END,
      'active',
      v_company_id,
      v_app.account_type = 'owner_driver',
      now(),
      now()
    );
  END IF;

  IF v_app.account_type = 'fleet_courier' THEN
    INSERT INTO public.fleet_compliance_profiles (
      onboarding_application_id, user_id, legal_company_name, trading_name, company_number, vat_number,
      registered_address, trading_address, contact_person, compliance_contact, transport_contact
    )
    VALUES (
      v_app.id, v_app.user_id, v_app.payload->>'legal_company_name', v_app.payload->>'trading_name',
      v_app.payload->>'company_number', v_app.payload->>'vat_number', v_app.payload->>'registered_address',
      v_app.payload->>'trading_address', v_app.payload->>'contact_person', v_app.payload->>'compliance_contact',
      v_app.payload->>'transport_contact'
    )
    ON CONFLICT (onboarding_application_id)
    DO UPDATE SET legal_company_name = EXCLUDED.legal_company_name,
                  trading_name = EXCLUDED.trading_name,
                  company_number = EXCLUDED.company_number,
                  vat_number = EXCLUDED.vat_number,
                  registered_address = EXCLUDED.registered_address,
                  trading_address = EXCLUDED.trading_address,
                  contact_person = EXCLUDED.contact_person,
                  compliance_contact = EXCLUDED.compliance_contact,
                  transport_contact = EXCLUDED.transport_contact,
                  updated_at = now();

    FOREACH v_doc_type IN ARRAY ARRAY['operator_licence','public_liability','goods_in_transit','motor_fleet_insurance','company_registration','vat_registration'] LOOP
      INSERT INTO public.company_documents (company_id, onboarding_application_id, doc_type, status)
      VALUES (v_company_id, v_app.id, v_doc_type, 'pending')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  IF v_app.account_type = 'owner_driver' THEN
    INSERT INTO public.owner_driver_compliance_profiles (
      onboarding_application_id, user_id, full_name, dob, nationality, address, phone, email,
      right_to_work_status, visa_type, visa_expiry, share_code, settled_status, pre_settled_status,
      registration, make, model, payload, dimensions
    )
    VALUES (
      v_app.id, v_app.user_id, v_app.payload->>'full_name', NULLIF(v_app.payload->>'dob', '')::date,
      v_app.payload->>'nationality', v_app.payload->>'address', v_app.payload->>'phone', v_app.payload->>'email',
      v_app.payload->>'right_to_work_status', NULLIF(v_app.payload->>'visa_type', ''), NULLIF(v_app.payload->>'visa_expiry', '')::date,
      NULLIF(v_app.payload->>'share_code', ''), COALESCE((v_app.payload->>'settled_status')::boolean, false),
      COALESCE((v_app.payload->>'pre_settled_status')::boolean, false), v_app.payload->>'registration',
      v_app.payload->>'make', v_app.payload->>'model', v_app.payload->>'payload', v_app.payload->>'dimensions'
    )
    ON CONFLICT (onboarding_application_id)
    DO UPDATE SET full_name = EXCLUDED.full_name,
                  dob = EXCLUDED.dob,
                  nationality = EXCLUDED.nationality,
                  address = EXCLUDED.address,
                  phone = EXCLUDED.phone,
                  email = EXCLUDED.email,
                  right_to_work_status = EXCLUDED.right_to_work_status,
                  visa_type = EXCLUDED.visa_type,
                  visa_expiry = EXCLUDED.visa_expiry,
                  share_code = EXCLUDED.share_code,
                  settled_status = EXCLUDED.settled_status,
                  pre_settled_status = EXCLUDED.pre_settled_status,
                  registration = EXCLUDED.registration,
                  make = EXCLUDED.make,
                  model = EXCLUDED.model,
                  payload = EXCLUDED.payload,
                  dimensions = EXCLUDED.dimensions,
                  updated_at = now();

    SELECT id INTO v_driver_id
    FROM public.drivers
    WHERE user_id = v_app.user_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_driver_id IS NULL THEN
      INSERT INTO public.drivers (
        company_id, user_id, display_name, phone, email, status, app_access, dob, nationality,
        residential_address, right_to_work_status, visa_type, visa_expiry, share_code,
        settled_status, pre_settled_status
      )
      VALUES (
        v_company_id, v_app.user_id, v_app.payload->>'full_name', v_app.payload->>'phone', v_app.payload->>'email',
        'active', true, NULLIF(v_app.payload->>'dob', '')::date, v_app.payload->>'nationality', v_app.payload->>'address',
        v_app.payload->>'right_to_work_status', NULLIF(v_app.payload->>'visa_type', ''), NULLIF(v_app.payload->>'visa_expiry', '')::date,
        NULLIF(v_app.payload->>'share_code', ''), COALESCE((v_app.payload->>'settled_status')::boolean, false),
        COALESCE((v_app.payload->>'pre_settled_status')::boolean, false)
      );
    ELSE
      UPDATE public.drivers
      SET company_id = v_company_id,
          display_name = v_app.payload->>'full_name',
          phone = v_app.payload->>'phone',
          email = v_app.payload->>'email',
          status = 'active',
          app_access = true,
          dob = NULLIF(v_app.payload->>'dob', '')::date,
          nationality = v_app.payload->>'nationality',
          residential_address = v_app.payload->>'address',
          right_to_work_status = v_app.payload->>'right_to_work_status',
          visa_type = NULLIF(v_app.payload->>'visa_type', ''),
          visa_expiry = NULLIF(v_app.payload->>'visa_expiry', '')::date,
          share_code = NULLIF(v_app.payload->>'share_code', ''),
          settled_status = COALESCE((v_app.payload->>'settled_status')::boolean, false),
          pre_settled_status = COALESCE((v_app.payload->>'pre_settled_status')::boolean, false),
          updated_at = now()
      WHERE id = v_driver_id;
    END IF;

    UPDATE public.owner_driver_vehicles
    SET registration = v_app.payload->>'registration',
        make = v_app.payload->>'make',
        model = v_app.payload->>'model',
        payload = v_app.payload->>'payload',
        dimensions = v_app.payload->>'dimensions',
        updated_at = now()
    WHERE onboarding_application_id = v_app.id;

    IF NOT FOUND THEN
      INSERT INTO public.owner_driver_vehicles (onboarding_application_id, registration, make, model, payload, dimensions)
      VALUES (v_app.id, v_app.payload->>'registration', v_app.payload->>'make', v_app.payload->>'model', v_app.payload->>'payload', v_app.payload->>'dimensions');
    END IF;

    FOREACH v_doc_type IN ARRAY ARRAY['driving_licence','cpc','proof_of_address','right_to_work','visa_document','insurance'] LOOP
      INSERT INTO public.driver_identity_documents (onboarding_application_id, doc_type, upload_status, verification_status)
      VALUES (v_app.id, v_doc_type, 'missing', 'unverified')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  v_next_status := CASE
    WHEN v_app.account_type = 'customer_shipper' THEN 'approved'
    WHEN v_app.account_type = 'broker_shipper' THEN 'under_review'
    ELSE 'submitted'
  END;

  UPDATE public.onboarding_applications
  SET status = v_next_status,
      company_id = v_company_id,
      current_step = CASE WHEN v_next_status = 'approved' THEN 'workspace_unlocked' ELSE 'pending_review' END,
      completion_percentage = 100,
      submitted_at = COALESCE(submitted_at, now()),
      last_activity_at = now()
  WHERE id = v_app.id;

  RETURN v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO service_role;
