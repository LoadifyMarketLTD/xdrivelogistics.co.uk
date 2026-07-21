-- Rebuild the registration/onboarding lifecycle around one rule:
-- authentication never provisions access; submit creates pending resources;
-- approval activates profile, company, membership and driver access atomically.

BEGIN;

-- Invited memberships must never satisfy tenant RLS.
CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND c.status::text = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(cid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_memberships cm
    JOIN public.companies c ON c.id = cm.company_id
    WHERE cm.company_id = cid
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role_in_company IN ('owner', 'admin')
      AND c.status::text = 'active'
  );
$$;

-- Repair rows created by the emergency login/onboarding shortcuts. Only rows
-- linked to a real onboarding application are touched; established accounts
-- without onboarding records are left unchanged.
UPDATE public.company_memberships cm
SET status = 'invited', updated_at = now()
FROM public.onboarding_applications a
WHERE a.company_id = cm.company_id
  AND a.user_id = cm.user_id
  AND a.account_type <> 'customer_shipper'
  AND a.status IN ('invited', 'draft', 'in_progress', 'request_changes', 'submitted', 'under_review', 'compliance_review', 'admin_approval')
  AND cm.status = 'active';

UPDATE public.profiles p
SET status = 'pending', updated_at = now()
FROM public.onboarding_applications a
WHERE a.user_id = p.user_id
  AND a.account_type <> 'customer_shipper'
  AND a.status IN ('invited', 'draft', 'in_progress', 'request_changes', 'submitted', 'under_review', 'compliance_review', 'admin_approval')
  AND COALESCE(p.status, 'active') NOT IN ('blocked', 'suspended', 'inactive', 'rejected');

UPDATE public.drivers d
SET app_access = false, updated_at = now()
FROM public.onboarding_applications a
WHERE a.user_id = d.user_id
  AND a.account_type = 'owner_driver'
  AND a.status <> 'approved';

-- A previous submit implementation could leave a review application linked to
-- an active company. Correct only those review rows, bypassing the governance
-- trigger inside this controlled migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.companies'::regclass
      AND tgname = 'trg_guard_company_status_update'
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.companies DISABLE TRIGGER trg_guard_company_status_update';
  END IF;

  UPDATE public.companies c
  SET status = 'pending_approval'
  FROM public.onboarding_applications a
  WHERE a.company_id = c.id
    AND a.account_type <> 'customer_shipper'
    AND a.status IN ('invited', 'draft', 'in_progress', 'request_changes', 'submitted', 'under_review', 'compliance_review', 'admin_approval')
    AND c.status::text = 'active';

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.companies'::regclass
      AND tgname = 'trg_guard_company_status_update'
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'ALTER TABLE public.companies ENABLE TRIGGER trg_guard_company_status_update';
  END IF;
END;
$$;

-- Backfill a missing profile once, from authoritative onboarding data. Login no
-- longer creates or guesses profiles.
INSERT INTO public.profiles (user_id, full_name, role, status, company_id, is_driver, created_at, updated_at)
SELECT
  a.user_id,
  COALESCE(NULLIF(trim(a.payload->>'full_name'), ''), NULLIF(trim(a.payload->>'contact_person'), ''), split_part(a.email, '@', 1)),
  CASE
    WHEN a.account_type = 'customer_shipper' THEN 'customer'
    WHEN a.account_type = 'broker_shipper' THEN 'broker'
    WHEN a.account_type = 'fleet_courier' THEN 'company_admin'
    WHEN a.account_type = 'owner_driver' THEN 'driver'
  END,
  CASE WHEN a.status = 'approved' THEN 'active' ELSE 'pending' END,
  a.company_id,
  a.account_type = 'owner_driver',
  now(),
  now()
FROM public.onboarding_applications a
LEFT JOIN public.profiles p ON p.user_id = a.user_id
WHERE p.user_id IS NULL
  AND a.account_type IN ('customer_shipper', 'broker_shipper', 'fleet_courier', 'owner_driver');

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
  v_profile_role text;
  v_company_type text;
  v_company_status text;
  v_membership_status public.membership_status;
  v_next_status text;
  v_doc_type text;
  v_driver_id uuid;
  v_dob date;
  v_visa_expiry date;
  v_settled boolean;
  v_pre_settled boolean;
  v_existing_company_status text;
BEGIN
  SELECT * INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF auth.role() <> 'service_role' AND v_app.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Forbidden onboarding application.' USING ERRCODE = '42501';
  END IF;

  IF v_app.account_type NOT IN ('customer_shipper', 'broker_shipper', 'fleet_courier', 'owner_driver') THEN
    RAISE EXCEPTION 'Unsupported onboarding account type: %', v_app.account_type USING ERRCODE = '23514';
  END IF;

  IF v_app.status NOT IN ('draft', 'in_progress', 'request_changes', 'submitted', 'under_review') THEN
    RAISE EXCEPTION 'Onboarding application cannot be submitted from status %.', v_app.status USING ERRCODE = '23514';
  END IF;

  BEGIN
    v_dob := NULLIF(trim(v_app.payload->>'date_of_birth'), '')::date;
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
  v_contact_email := COALESCE(NULLIF(trim(v_app.payload->>'contact_email'), ''), v_app.email);
  v_contact_phone := NULLIF(trim(v_app.payload->>'contact_phone'), '');
  v_address := COALESCE(
    NULLIF(trim(v_app.payload->>'billing_address'), ''),
    NULLIF(trim(v_app.payload->>'registered_address'), ''),
    NULLIF(trim(v_app.payload->>'address'), '')
  );

  v_profile_role := CASE
    WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
    WHEN v_app.account_type = 'broker_shipper' THEN 'broker'
    WHEN v_app.account_type = 'fleet_courier' THEN 'company_admin'
    ELSE 'driver'
  END;
  v_company_type := CASE
    WHEN v_app.account_type = 'customer_shipper' THEN 'customer'
    WHEN v_app.account_type = 'broker_shipper' THEN 'broker'
    WHEN v_app.account_type = 'fleet_courier' THEN 'carrier'
    ELSE 'owner_driver'
  END;
  v_company_status := CASE WHEN v_app.account_type = 'customer_shipper' THEN 'active' ELSE 'pending_approval' END;
  v_membership_status := CASE WHEN v_app.account_type = 'customer_shipper' THEN 'active'::public.membership_status ELSE 'invited'::public.membership_status END;
  v_next_status := CASE WHEN v_app.account_type = 'customer_shipper' THEN 'approved' ELSE 'under_review' END;

  v_company_id := v_app.company_id;
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE created_by = v_app.user_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (
      name, email, phone, address_line1, company_number, vat_number, status, company_type, created_by
    ) VALUES (
      v_company_name,
      v_contact_email,
      v_contact_phone,
      v_address,
      NULLIF(trim(v_app.payload->>'company_number'), ''),
      NULLIF(trim(v_app.payload->>'vat_number'), ''),
      v_company_status,
      v_company_type,
      v_app.user_id
    ) RETURNING id INTO v_company_id;
  ELSE
    SELECT status::text INTO v_existing_company_status
    FROM public.companies WHERE id = v_company_id FOR UPDATE;

    UPDATE public.companies
    SET name = v_company_name,
        email = v_contact_email,
        phone = v_contact_phone,
        address_line1 = v_address,
        company_number = COALESCE(NULLIF(trim(v_app.payload->>'company_number'), ''), company_number),
        vat_number = COALESCE(NULLIF(trim(v_app.payload->>'vat_number'), ''), vat_number),
        company_type = v_company_type
    WHERE id = v_company_id;

    IF v_existing_company_status = 'rejected' AND v_company_status = 'pending_approval' THEN
      PERFORM public.set_company_status_governance(
        v_app.user_id, v_company_id, 'onboarding_resubmitted', 'pending_approval', 'Onboarding resubmitted'
      );
    ELSIF v_existing_company_status = 'pending_approval' AND v_company_status = 'active' THEN
      PERFORM public.set_company_status_governance(
        v_app.user_id, v_company_id, 'customer_onboarding_completed', 'active', 'Customer onboarding completed'
      );
    END IF;
  END IF;

  INSERT INTO public.company_memberships (
    company_id, user_id, invited_email, role_in_company, status, updated_at
  ) VALUES (
    v_company_id, v_app.user_id, v_contact_email, 'owner', v_membership_status, now()
  )
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET invited_email = EXCLUDED.invited_email,
                role_in_company = EXCLUDED.role_in_company,
                status = EXCLUDED.status,
                updated_at = now();

  INSERT INTO public.profiles (
    user_id, full_name, phone, role, status, company_id, is_driver, created_at, updated_at
  ) VALUES (
    v_app.user_id,
    COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), NULLIF(trim(v_app.payload->>'contact_person'), ''), split_part(v_app.email, '@', 1)),
    v_contact_phone,
    v_profile_role,
    CASE WHEN v_next_status = 'approved' THEN 'active' ELSE 'pending' END,
    v_company_id,
    v_app.account_type = 'owner_driver',
    now(),
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
                phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
                role = EXCLUDED.role,
                status = CASE
                  WHEN public.profiles.status IN ('blocked', 'suspended', 'inactive') THEN public.profiles.status
                  ELSE EXCLUDED.status
                END,
                company_id = EXCLUDED.company_id,
                is_driver = EXCLUDED.is_driver,
                updated_at = now();

  IF v_app.account_type = 'fleet_courier' THEN
    INSERT INTO public.fleet_compliance_profiles (
      onboarding_application_id, user_id, legal_company_name, trading_name, company_number, vat_number,
      registered_address, trading_address, contact_person, compliance_contact, transport_contact
    ) VALUES (
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

    FOREACH v_doc_type IN ARRAY ARRAY[
      'operator_licence','public_liability','goods_in_transit','vehicle_insurance',
      'motor_fleet_insurance','vat_registration','company_registration'
    ] LOOP
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
    ) VALUES (
      v_app.id,
      v_app.user_id,
      v_app.payload->>'full_name',
      v_dob,
      NULLIF(trim(v_app.payload->>'nationality'), ''),
      v_app.payload->>'address',
      v_contact_phone,
      v_contact_email,
      v_app.payload->>'right_to_work_status',
      NULLIF(trim(v_app.payload->>'visa_type'), ''),
      v_visa_expiry,
      NULLIF(trim(v_app.payload->>'share_code'), ''),
      v_settled,
      v_pre_settled,
      v_app.payload->>'registration',
      v_app.payload->>'make',
      v_app.payload->>'model',
      v_app.payload->>'payload',
      v_app.payload->>'dimensions'
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
    WHERE user_id = v_app.user_id AND company_id = v_company_id
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;

    IF v_driver_id IS NULL THEN
      INSERT INTO public.drivers (
        company_id, user_id, display_name, phone, email, status, availability_status,
        app_access, dob, nationality, residential_address, visa_type, share_code,
        settled_status, pre_settled_status
      ) VALUES (
        v_company_id, v_app.user_id, v_app.payload->>'full_name', v_contact_phone, v_contact_email,
        'active', 'offline', false, v_dob, NULLIF(trim(v_app.payload->>'nationality'), ''),
        v_app.payload->>'address', NULLIF(trim(v_app.payload->>'visa_type'), ''),
        NULLIF(trim(v_app.payload->>'share_code'), ''), v_settled, v_pre_settled
      ) RETURNING id INTO v_driver_id;
    ELSE
      UPDATE public.drivers
      SET display_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), display_name),
          phone = COALESCE(v_contact_phone, phone),
          email = COALESCE(v_contact_email, email),
          app_access = false,
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

    INSERT INTO public.owner_driver_vehicles (
      onboarding_application_id, registration, make, model, payload, dimensions
    ) VALUES (
      v_app.id, v_app.payload->>'registration', v_app.payload->>'make',
      v_app.payload->>'model', v_app.payload->>'payload', v_app.payload->>'dimensions'
    )
    ON CONFLICT (onboarding_application_id)
    DO UPDATE SET registration = EXCLUDED.registration,
                  make = EXCLUDED.make,
                  model = EXCLUDED.model,
                  payload = EXCLUDED.payload,
                  dimensions = EXCLUDED.dimensions,
                  updated_at = now();

    FOREACH v_doc_type IN ARRAY ARRAY[
      'driving_licence','cpc','proof_of_address','right_to_work','visa_document','insurance'
    ] LOOP
      INSERT INTO public.driver_identity_documents (
        onboarding_application_id, doc_type, upload_status, verification_status
      ) VALUES (v_app.id, v_doc_type, 'missing', 'unverified')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.onboarding_applications
  SET status = v_next_status,
      company_id = v_company_id,
      workspace_mode = CASE
        WHEN account_type = 'owner_driver' THEN 'owner_driver'
        WHEN account_type = 'fleet_courier' THEN 'company'
        WHEN account_type = 'broker_shipper' THEN 'broker'
        ELSE 'customer'
      END,
      owner_driver_workspace = account_type = 'owner_driver',
      current_step = CASE WHEN v_next_status = 'approved' THEN 'workspace_unlocked' ELSE 'pending_review' END,
      completion_percentage = 100,
      submitted_at = COALESCE(submitted_at, now()),
      last_activity_at = now(),
      updated_at = now()
  WHERE id = v_app.id;

  RETURN v_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_onboarding_application_atomic(
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
  v_profile_role text;
BEGIN
  IF p_action NOT IN ('approve', 'reject', 'request_changes') THEN
    RAISE EXCEPTION 'Invalid review action.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_app
  FROM public.onboarding_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_app.status = 'approved' AND p_action = 'approve' THEN
    RETURN QUERY SELECT v_app.id, v_app.status, v_app.company_id;
    RETURN;
  END IF;

  IF v_app.account_type = 'customer_shipper' THEN
    RAISE EXCEPTION 'Customer onboarding is approved at submission.' USING ERRCODE = '23514';
  END IF;

  v_company_id := v_app.company_id;
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE created_by = v_app.user_id
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Cannot review onboarding without a linked company.' USING ERRCODE = '23514';
  END IF;

  SELECT status::text INTO v_company_status
  FROM public.companies WHERE id = v_company_id FOR UPDATE;

  v_status := CASE p_action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    ELSE 'request_changes'
  END;
  v_profile_role := CASE
    WHEN v_app.account_type = 'broker_shipper' THEN 'broker'
    WHEN v_app.account_type = 'fleet_courier' THEN 'company_admin'
    ELSE 'driver'
  END;

  IF p_action = 'approve' AND v_company_status <> 'active' THEN
    PERFORM public.set_company_status_governance(
      p_actor_user_id, v_company_id, 'company_approved', 'active',
      COALESCE(NULLIF(trim(p_notes), ''), 'Onboarding approved')
    );
  ELSIF p_action = 'reject' AND v_company_status <> 'rejected' THEN
    PERFORM public.set_company_status_governance(
      p_actor_user_id, v_company_id, 'company_rejected', 'rejected',
      COALESCE(NULLIF(trim(p_notes), ''), 'Onboarding rejected')
    );
  ELSIF p_action = 'request_changes' AND v_company_status = 'rejected' THEN
    PERFORM public.set_company_status_governance(
      p_actor_user_id, v_company_id, 'onboarding_changes_requested', 'pending_approval',
      COALESCE(NULLIF(trim(p_notes), ''), 'Changes requested')
    );
  END IF;

  INSERT INTO public.company_memberships (
    company_id, user_id, invited_email, role_in_company, status, updated_at
  ) VALUES (
    v_company_id,
    v_app.user_id,
    v_app.email,
    'owner',
    CASE
      WHEN p_action = 'approve' THEN 'active'::public.membership_status
      WHEN p_action = 'reject' THEN 'suspended'::public.membership_status
      ELSE 'invited'::public.membership_status
    END,
    now()
  )
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET role_in_company = EXCLUDED.role_in_company,
                status = EXCLUDED.status,
                updated_at = now();

  INSERT INTO public.profiles (user_id, role, status, company_id, is_driver, created_at, updated_at)
  VALUES (
    v_app.user_id,
    v_profile_role,
    CASE WHEN p_action = 'approve' THEN 'active' WHEN p_action = 'reject' THEN 'rejected' ELSE 'pending' END,
    v_company_id,
    v_app.account_type = 'owner_driver',
    now(),
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET role = EXCLUDED.role,
                status = EXCLUDED.status,
                company_id = EXCLUDED.company_id,
                is_driver = EXCLUDED.is_driver,
                updated_at = now();

  IF v_app.account_type = 'owner_driver' THEN
    UPDATE public.drivers
    SET app_access = p_action = 'approve',
        updated_at = now()
    WHERE user_id = v_app.user_id
      AND company_id = v_company_id;
  END IF;

  UPDATE public.onboarding_applications
  SET status = v_status,
      company_id = v_company_id,
      reviewed_at = now(),
      reviewed_by = p_actor_user_id,
      review_notes = p_notes,
      current_step = CASE
        WHEN v_status = 'approved' THEN 'workspace_unlocked'
        WHEN v_status = 'request_changes' THEN 'changes_requested'
        ELSE 'review_complete'
      END,
      completion_percentage = CASE WHEN v_status = 'approved' THEN 100 ELSE completion_percentage END,
      last_activity_at = now(),
      updated_at = now()
  WHERE id = p_application_id;

  INSERT INTO public.notification_events (
    event_type, entity_type, entity_id, company_id, recipient_user_id, payload
  ) VALUES (
    CASE WHEN v_status = 'approved' THEN 'onboarding_approved' ELSE 'onboarding_review_updated' END,
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

  RETURN QUERY SELECT p_application_id, v_status, v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_onboarding_application(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_application(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_onboarding_application_atomic(uuid, uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
