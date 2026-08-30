BEGIN;

-- P0-10 final hosted runtime proof. All fixture state is generated under
-- @example.test and rolled back before the migration commits.
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_company_id uuid;
  v_application_id uuid;
  v_missing text[];
  v_owner_rejected boolean := false;
  v_fleet_rejected boolean := false;
  v_fixture_email text;
BEGIN
  v_fixture_email := 'p010-final-' || replace(v_user_id::text, '-', '') || '@example.test';

  BEGIN
    INSERT INTO auth.users (
      id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    )
    VALUES (
      v_user_id,
      'authenticated',
      'authenticated',
      v_fixture_email,
      '{}'::jsonb,
      jsonb_build_object('full_name', 'Visual Audit P0-10 Final Fixture'),
      now(),
      now()
    );

    INSERT INTO public.companies (name, created_by, status, company_type)
    VALUES (
      'Visual Audit P0-10 Final ' || left(v_user_id::text, 8),
      v_user_id,
      'pending_approval',
      'standard'
    )
    RETURNING id INTO v_company_id;

    -- Owner Driver: no company-family documents are required, but identity
    -- requirements remain authoritative for company activation.
    BEGIN
      INSERT INTO public.onboarding_applications (
        user_id, company_id, account_type, status, email,
        current_step, completion_percentage, payload, risk_status
      )
      VALUES (
        v_user_id,
        v_company_id,
        'owner_driver',
        'draft',
        v_fixture_email,
        'identity_details',
        10,
        jsonb_build_object('canonical_account_type', 'owner_driver'),
        'clear'
      )
      RETURNING id INTO v_application_id;

      SELECT COALESCE(array_agg(m.doc_type ORDER BY m.doc_type), ARRAY[]::text[])
      INTO v_missing
      FROM public.get_missing_onboarding_documents(v_application_id) m;

      IF v_missing IS DISTINCT FROM ARRAY['driving_licence','proof_of_address','right_to_work']::text[] THEN
        RAISE EXCEPTION 'Owner Driver initial missing set is not canonical: %', v_missing;
      END IF;

      BEGIN
        PERFORM public.assert_company_compliance_ready(v_company_id);
      EXCEPTION
        WHEN SQLSTATE '23514' THEN
          v_owner_rejected := true;
      END;

      IF NOT v_owner_rejected THEN
        RAISE EXCEPTION 'Owner Driver company activation bypassed missing identity compliance.';
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.company_documents d
        WHERE d.onboarding_application_id = v_application_id
      ) THEN
        RAISE EXCEPTION 'Owner Driver proof unexpectedly created company documents.';
      END IF;

      -- Driving Licence satisfies Proof of Address under current Owner Driver
      -- policy; Right to Work remains independently required.
      INSERT INTO public.driver_identity_documents (
        onboarding_application_id, doc_type, file_path,
        upload_status, verification_status, expiry_date
      )
      VALUES
        (v_application_id, 'driving_licence', 'p010/licence.pdf', 'uploaded', 'verified', current_date + 365),
        (v_application_id, 'right_to_work', 'p010/right-to-work.pdf', 'uploaded', 'verified', current_date + 365);

      SELECT COALESCE(array_agg(m.doc_type ORDER BY m.doc_type), ARRAY[]::text[])
      INTO v_missing
      FROM public.get_missing_onboarding_documents(v_application_id) m;

      IF COALESCE(array_length(v_missing, 1), 0) <> 0 THEN
        RAISE EXCEPTION 'Owner Driver remains blocked after canonical identity evidence: %', v_missing;
      END IF;

      PERFORM public.assert_company_compliance_ready(v_company_id);

      RAISE EXCEPTION 'rollback final owner driver compliance probe' USING ERRCODE = 'P0001';
    EXCEPTION
      WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'rollback final owner driver compliance probe' THEN
          RAISE;
        END IF;
    END;

    IF EXISTS (SELECT 1 FROM public.onboarding_applications WHERE id = v_application_id) THEN
      RAISE EXCEPTION 'Final Owner Driver probe did not roll back cleanly.';
    END IF;

    -- Fleet: company-family evidence is mandatory and must also fail closed until
    -- all four canonical requirements are approved/current.
    v_application_id := NULL;
    v_fleet_rejected := false;
    BEGIN
      INSERT INTO public.onboarding_applications (
        user_id, company_id, account_type, status, email,
        current_step, completion_percentage, payload, risk_status
      )
      VALUES (
        v_user_id,
        v_company_id,
        'fleet_courier',
        'draft',
        v_fixture_email,
        'company_details',
        10,
        jsonb_build_object('canonical_account_type', 'fleet_courier'),
        'clear'
      )
      RETURNING id INTO v_application_id;

      BEGIN
        PERFORM public.assert_company_compliance_ready(v_company_id);
      EXCEPTION
        WHEN SQLSTATE '23514' THEN
          v_fleet_rejected := true;
      END;

      IF NOT v_fleet_rejected THEN
        RAISE EXCEPTION 'Fleet company activation bypassed missing company compliance.';
      END IF;

      INSERT INTO public.company_documents (
        company_id, onboarding_application_id, doc_type, file_path, status, expiry_date
      )
      VALUES
        (v_company_id, v_application_id, 'company_registration', 'p010/company-registration.pdf', 'approved', NULL),
        (v_company_id, v_application_id, 'goods_in_transit', 'p010/goods-in-transit.pdf', 'approved', current_date + 365),
        (v_company_id, v_application_id, 'public_liability', 'p010/public-liability.pdf', 'approved', current_date + 365),
        (v_company_id, v_application_id, 'vehicle_insurance', 'p010/vehicle-insurance.pdf', 'approved', current_date + 365);

      SELECT COALESCE(array_agg(m.doc_type ORDER BY m.doc_type), ARRAY[]::text[])
      INTO v_missing
      FROM public.get_missing_onboarding_documents(v_application_id) m;

      IF COALESCE(array_length(v_missing, 1), 0) <> 0 THEN
        RAISE EXCEPTION 'Fleet remains blocked after all canonical company evidence: %', v_missing;
      END IF;

      PERFORM public.assert_company_compliance_ready(v_company_id);

      RAISE EXCEPTION 'rollback final fleet company compliance probe' USING ERRCODE = 'P0001';
    EXCEPTION
      WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'rollback final fleet company compliance probe' THEN
          RAISE;
        END IF;
    END;

    IF EXISTS (SELECT 1 FROM public.onboarding_applications WHERE id = v_application_id) THEN
      RAISE EXCEPTION 'Final Fleet probe did not roll back cleanly.';
    END IF;

    RAISE EXCEPTION 'rollback final synthetic company compliance fixture' USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'rollback final synthetic company compliance fixture' THEN
        RAISE;
      END IF;
  END;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id OR email = v_fixture_email) THEN
    RAISE EXCEPTION 'Final synthetic auth fixture did not roll back cleanly.';
  END IF;

  IF v_company_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.companies WHERE id = v_company_id) THEN
    RAISE EXCEPTION 'Final synthetic company fixture did not roll back cleanly.';
  END IF;
END;
$$;

COMMIT;
