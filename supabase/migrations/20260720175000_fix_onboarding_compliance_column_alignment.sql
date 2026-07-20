-- Align onboarding submission with the audited live column set.
-- This migration intentionally does not add compatibility/duplicate columns.

BEGIN;

DO $$
DECLARE
  v_missing text;
BEGIN
  WITH expected(table_name, column_name) AS (
    VALUES
      ('fleet_compliance_profiles', 'id'),
      ('fleet_compliance_profiles', 'onboarding_application_id'),
      ('fleet_compliance_profiles', 'user_id'),
      ('fleet_compliance_profiles', 'legal_company_name'),
      ('fleet_compliance_profiles', 'trading_name'),
      ('fleet_compliance_profiles', 'company_number'),
      ('fleet_compliance_profiles', 'vat_number'),
      ('fleet_compliance_profiles', 'registered_address'),
      ('fleet_compliance_profiles', 'trading_address'),
      ('fleet_compliance_profiles', 'contact_person'),
      ('fleet_compliance_profiles', 'compliance_contact'),
      ('fleet_compliance_profiles', 'transport_contact'),
      ('fleet_compliance_profiles', 'created_at'),
      ('fleet_compliance_profiles', 'updated_at'),
      ('onboarding_applications', 'id'),
      ('onboarding_applications', 'user_id'),
      ('onboarding_applications', 'company_id'),
      ('onboarding_applications', 'account_type'),
      ('onboarding_applications', 'workspace_mode'),
      ('onboarding_applications', 'owner_driver_workspace'),
      ('onboarding_applications', 'status'),
      ('onboarding_applications', 'created_at'),
      ('onboarding_applications', 'updated_at'),
      ('onboarding_applications', 'email'),
      ('onboarding_applications', 'token_hash'),
      ('onboarding_applications', 'token_expires_at'),
      ('onboarding_applications', 'token_last_sent_at'),
      ('onboarding_applications', 'token_activated_at'),
      ('onboarding_applications', 'last_activity_at'),
      ('onboarding_applications', 'current_step'),
      ('onboarding_applications', 'completion_percentage'),
      ('onboarding_applications', 'submitted_at'),
      ('onboarding_applications', 'reviewed_at'),
      ('onboarding_applications', 'reviewed_by'),
      ('onboarding_applications', 'review_notes'),
      ('onboarding_applications', 'payload'),
      ('owner_driver_compliance_profiles', 'id'),
      ('owner_driver_compliance_profiles', 'onboarding_application_id'),
      ('owner_driver_compliance_profiles', 'user_id'),
      ('owner_driver_compliance_profiles', 'full_name'),
      ('owner_driver_compliance_profiles', 'dob'),
      ('owner_driver_compliance_profiles', 'nationality'),
      ('owner_driver_compliance_profiles', 'address'),
      ('owner_driver_compliance_profiles', 'phone'),
      ('owner_driver_compliance_profiles', 'email'),
      ('owner_driver_compliance_profiles', 'right_to_work_status'),
      ('owner_driver_compliance_profiles', 'visa_type'),
      ('owner_driver_compliance_profiles', 'visa_expiry'),
      ('owner_driver_compliance_profiles', 'share_code'),
      ('owner_driver_compliance_profiles', 'settled_status'),
      ('owner_driver_compliance_profiles', 'pre_settled_status'),
      ('owner_driver_compliance_profiles', 'registration'),
      ('owner_driver_compliance_profiles', 'make'),
      ('owner_driver_compliance_profiles', 'model'),
      ('owner_driver_compliance_profiles', 'payload'),
      ('owner_driver_compliance_profiles', 'dimensions'),
      ('owner_driver_compliance_profiles', 'created_at'),
      ('owner_driver_compliance_profiles', 'updated_at')
  )
  SELECT string_agg(format('%I.%I', expected.table_name, expected.column_name), ', ' ORDER BY expected.table_name, expected.column_name)
  INTO v_missing
  FROM expected
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = expected.table_name
      AND c.column_name = expected.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Onboarding schema alignment failed. Missing columns: %', v_missing;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_onboarding_application(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_dob date;
  v_visa_expiry date;
  v_settled boolean;
  v_pre_settled boolean;
BEGIN
  SELECT *
  INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF auth.role() <> 'service_role' AND v_app.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden onboarding application.' USING ERRCODE = '42501';
  END IF;

  IF v_app.status NOT IN ('draft', 'in_progress', 'request_changes', 'submitted', 'under_review') THEN
    RAISE EXCEPTION 'Onboarding application cannot be submitted from status %.', v_app.status
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_dob := NULLIF(trim(v_app.payload->>'dob'), '')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Invalid owner-driver date of birth.' USING ERRCODE = '22007';
  END;

  BEGIN
    v_visa_expiry := NULLIF(trim(v_app.payload->>'visa_expiry'), '')::date;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RAISE EXCEPTION 'Invalid owner-driver visa expiry.' USING ERRCODE = '22007';
  END;

  v_settled := lower(COALESCE(v_app.payload->>'settled_status', 'false')) IN ('true', '1', 'yes');
  v_pre_settled := lower(COALESCE(v_app.payload->>'pre_settled_status', 'false')) IN ('true', '1', 'yes');

  v_company_name := COALESCE(
    NULLIF(trim(v_app.payload->>'company_name'), ''),
    NULLIF(trim(v_app.payload->>'legal_company_name'), ''),
    NULLIF(trim(v_app.payload->>'trading_name'), ''),
    NULLIF(trim(v_app.payload->>'full_name'), ''),
    split_part(v_app.email, '@', 1) || ' workspace'
  );
  v_contact_email := COALESCE(
    NULLIF(trim(v_app.payload->>'contact_email'), ''),
    NULLIF(trim(v_app.payload->>'email'), ''),
    v_app.email
  );
  v_contact_phone := COALESCE(
    NULLIF(trim(v_app.payload->>'contact_phone'), ''),
    NULLIF(trim(v_app.payload->>'phone'), ''),
    NULL
  );
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

  INSERT INTO public.company_memberships (company_id, user_id, role_in_company, status, updated_at)
  VALUES (v_company_id, v_app.user_id, v_role, 'active', now())
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET role_in_company = EXCLUDED.role_in_company,
                status = 'active',
                updated_at = now();

  UPDATE public.profiles
  SET full_name = COALESCE(
        NULLIF(trim(v_app.payload->>'full_name'), ''),
        NULLIF(trim(v_app.payload->>'contact_person'), ''),
        full_name
      ),
      phone = COALESCE(v_contact_phone, phone),
      company_id = v_company_id,
      role = CASE
        WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
        WHEN v_app.account_type = 'owner_driver' THEN 'driver'
        ELSE role
      END,
      status = CASE WHEN v_app.account_type = 'customer_shipper' THEN 'active' ELSE status END,
      is_driver = CASE WHEN v_app.account_type = 'owner_driver' THEN true ELSE is_driver END,
      updated_at = now()
  WHERE user_id = v_app.user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (
      user_id, full_name, phone, role, status, company_id, is_driver, created_at, updated_at
    )
    VALUES (
      v_app.user_id,
      COALESCE(
        NULLIF(trim(v_app.payload->>'full_name'), ''),
        NULLIF(trim(v_app.payload->>'contact_person'), ''),
        split_part(v_app.email, '@', 1)
      ),
      v_contact_phone,
      CASE
        WHEN v_app.account_type = 'owner_driver' THEN 'driver'
        WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
        ELSE 'company_admin'
      END,
      CASE WHEN v_app.account_type = 'customer_shipper' THEN 'active' ELSE 'pending' END,
      v_company_id,
      v_app.account_type = 'owner_driver',
      now(),
      now()
    );
  END IF;

  IF v_app.account_type = 'fleet_courier' THEN
    INSERT INTO public.fleet_compliance_profiles (
      onboarding_application_id,
      user_id,
      legal_company_name,
      trading_name,
      company_number,
      vat_number,
      registered_address,
      trading_address,
      contact_person,
      compliance_contact,
      transport_contact
    )
    VALUES (
      v_app.id,
      v_app.user_id,
      COALESCE(NULLIF(trim(v_app.payload->>'legal_company_name'), ''), v_company_name),
      NULLIF(trim(v_app.payload->>'trading_name'), ''),
      NULLIF(trim(v_app.payload->>'company_number'), ''),
      NULLIF(trim(v_app.payload->>'vat_number'), ''),
      NULLIF(trim(v_app.payload->>'registered_address'), ''),
      NULLIF(trim(v_app.payload->>'trading_address'), ''),
      NULLIF(trim(v_app.payload->>'contact_person'), ''),
      NULLIF(trim(v_app.payload->>'compliance_contact'), ''),
      NULLIF(trim(v_app.payload->>'transport_contact'), '')
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

    FOREACH v_doc_type IN ARRAY ARRAY[
      'operator_licence',
      'public_liability',
      'goods_in_transit',
      'vehicle_insurance',
      'motor_fleet_insurance',
      'vat_registration',
      'company_registration'
    ] LOOP
      INSERT INTO public.company_documents (company_id, onboarding_application_id, doc_type, status)
      VALUES (v_company_id, v_app.id, v_doc_type, 'pending')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  IF v_app.account_type = 'owner_driver' THEN
    INSERT INTO public.owner_driver_compliance_profiles (
      onboarding_application_id,
      user_id,
      full_name,
      dob,
      nationality,
      address,
      phone,
      email,
      right_to_work_status,
      visa_type,
      visa_expiry,
      share_code,
      settled_status,
      pre_settled_status,
      registration,
      make,
      model,
      payload,
      dimensions
    )
    VALUES (
      v_app.id,
      v_app.user_id,
      COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
      v_dob,
      NULLIF(trim(v_app.payload->>'nationality'), ''),
      NULLIF(trim(v_app.payload->>'address'), ''),
      NULLIF(trim(v_app.payload->>'phone'), ''),
      COALESCE(NULLIF(trim(v_app.payload->>'email'), ''), v_app.email),
      NULLIF(trim(v_app.payload->>'right_to_work_status'), ''),
      NULLIF(trim(v_app.payload->>'visa_type'), ''),
      v_visa_expiry,
      NULLIF(trim(v_app.payload->>'share_code'), ''),
      v_settled,
      v_pre_settled,
      NULLIF(trim(v_app.payload->>'registration'), ''),
      NULLIF(trim(v_app.payload->>'make'), ''),
      NULLIF(trim(v_app.payload->>'model'), ''),
      NULLIF(trim(v_app.payload->>'payload'), ''),
      NULLIF(trim(v_app.payload->>'dimensions'), '')
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

    SELECT id
    INTO v_driver_id
    FROM public.drivers
    WHERE user_id = v_app.user_id
      AND company_id = v_company_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_driver_id IS NULL THEN
      INSERT INTO public.drivers (
        company_id,
        user_id,
        display_name,
        phone,
        email,
        status,
        availability_status,
        app_access,
        dob,
        nationality,
        residential_address,
        visa_type,
        share_code,
        settled_status,
        pre_settled_status
      )
      VALUES (
        v_company_id,
        v_app.user_id,
        COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), split_part(v_app.email, '@', 1)),
        v_contact_phone,
        v_contact_email,
        'active',
        'offline',
        false,
        v_dob,
        NULLIF(trim(v_app.payload->>'nationality'), ''),
        NULLIF(trim(v_app.payload->>'address'), ''),
        NULLIF(trim(v_app.payload->>'visa_type'), ''),
        NULLIF(trim(v_app.payload->>'share_code'), ''),
        v_settled,
        v_pre_settled
      )
      RETURNING id INTO v_driver_id;
    ELSE
      UPDATE public.drivers
      SET display_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), display_name),
          phone = COALESCE(v_contact_phone, phone),
          email = COALESCE(v_contact_email, email),
          dob = v_dob,
          nationality = NULLIF(trim(v_app.payload->>'nationality'), ''),
          residential_address = NULLIF(trim(v_app.payload->>'address'), ''),
          visa_type = NULLIF(trim(v_app.payload->>'visa_type'), ''),
          share_code = NULLIF(trim(v_app.payload->>'share_code'), ''),
          settled_status = v_settled,
          pre_settled_status = v_pre_settled,
          updated_at = now()
      WHERE id = v_driver_id;
    END IF;

    UPDATE public.owner_driver_vehicles
    SET registration = NULLIF(trim(v_app.payload->>'registration'), ''),
        make = NULLIF(trim(v_app.payload->>'make'), ''),
        model = NULLIF(trim(v_app.payload->>'model'), ''),
        payload = NULLIF(trim(v_app.payload->>'payload'), ''),
        dimensions = NULLIF(trim(v_app.payload->>'dimensions'), ''),
        updated_at = now()
    WHERE onboarding_application_id = v_app.id;

    IF NOT FOUND THEN
      INSERT INTO public.owner_driver_vehicles (
        onboarding_application_id, registration, make, model, payload, dimensions
      )
      VALUES (
        v_app.id,
        NULLIF(trim(v_app.payload->>'registration'), ''),
        NULLIF(trim(v_app.payload->>'make'), ''),
        NULLIF(trim(v_app.payload->>'model'), ''),
        NULLIF(trim(v_app.payload->>'payload'), ''),
        NULLIF(trim(v_app.payload->>'dimensions'), '')
      );
    END IF;

    FOREACH v_doc_type IN ARRAY ARRAY[
      'driving_licence',
      'cpc',
      'proof_of_address',
      'right_to_work',
      'visa_document',
      'insurance'
    ] LOOP
      INSERT INTO public.driver_identity_documents (
        onboarding_application_id, doc_type, upload_status, verification_status
      )
      VALUES (v_app.id, v_doc_type, 'missing', 'unverified')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  v_next_status := CASE
    WHEN v_app.account_type = 'customer_shipper' THEN 'approved'
    ELSE 'under_review'
  END;

  UPDATE public.onboarding_applications
  SET status = v_next_status,
      company_id = v_company_id,
      workspace_mode = CASE
        WHEN v_app.account_type = 'owner_driver' THEN 'owner_driver'
        WHEN v_app.account_type = 'fleet_courier' THEN 'fleet'
        WHEN v_app.account_type = 'broker_shipper' THEN 'broker'
        WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
        ELSE workspace_mode
      END,
      owner_driver_workspace = v_app.account_type = 'owner_driver',
      current_step = CASE WHEN v_next_status = 'approved' THEN 'workspace_unlocked' ELSE 'pending_review' END,
      completion_percentage = 100,
      submitted_at = COALESCE(submitted_at, now()),
      last_activity_at = now(),
      updated_at = now()
  WHERE id = v_app.id;

  RETURN v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO authenticated, service_role;

COMMIT;
