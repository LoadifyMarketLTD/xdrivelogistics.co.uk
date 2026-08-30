BEGIN;

-- P0-10 hosted runtime proof. Create one fully synthetic auth/company fixture
-- inside a rollback-only subtransaction. No real or third-party private account
-- is used or mutated. Nested probes also roll themselves back independently.
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_company_id uuid;
  v_document_id uuid;
  v_document_type text;
  v_application_id uuid;
  v_missing text[];
  v_fleet_rejected boolean := false;
  v_fixture_email text;
BEGIN
  v_fixture_email := 'p010-' || replace(v_user_id::text, '-', '') || '@example.test';

  BEGIN
    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      'authenticated',
      'authenticated',
      v_fixture_email,
      '{}'::jsonb,
      jsonb_build_object('full_name', 'Visual Audit P0-10 Fixture'),
      now(),
      now()
    );

    INSERT INTO public.companies (
      name,
      created_by,
      status,
      company_type
    )
    VALUES (
      'Visual Audit P0-10 Company ' || left(v_user_id::text, 8),
      v_user_id,
      'pending_approval',
      'standard'
    )
    RETURNING id INTO v_company_id;

    -- Legacy fleet insurance naming must be canonicalized at the table boundary.
    BEGIN
      INSERT INTO public.company_documents (
        company_id,
        onboarding_application_id,
        doc_type,
        status
      )
      VALUES (
        v_company_id,
        NULL,
        'motor_fleet_insurance',
        'pending'
      )
      RETURNING id, doc_type INTO v_document_id, v_document_type;

      IF v_document_type <> 'vehicle_insurance' THEN
        RAISE EXCEPTION 'Legacy fleet insurance alias was not normalized: %', v_document_type;
      END IF;

      RAISE EXCEPTION 'rollback company document alias probe' USING ERRCODE = 'P0001';
    EXCEPTION
      WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'rollback company document alias probe' THEN
          RAISE;
        END IF;
    END;

    IF EXISTS (SELECT 1 FROM public.company_documents WHERE id = v_document_id) THEN
      RAISE EXCEPTION 'Company document alias probe did not roll back cleanly.';
    END IF;

    -- Owner Driver has no required company-document family. Company activation
    -- readiness must not invent corporate documents. Identity approval remains
    -- separately enforced by the onboarding approval trigger.
    BEGIN
      INSERT INTO public.onboarding_applications (
        user_id,
        company_id,
        account_type,
        status,
        email,
        current_step,
        completion_percentage,
        payload,
        risk_status
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
        RAISE EXCEPTION 'Owner Driver missing-document set is not canonical: %', v_missing;
      END IF;

      PERFORM public.assert_company_compliance_ready(v_company_id);

      RAISE EXCEPTION 'rollback owner driver company readiness probe' USING ERRCODE = 'P0001';
    EXCEPTION
      WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'rollback owner driver company readiness probe' THEN
          RAISE;
        END IF;
    END;

    IF EXISTS (SELECT 1 FROM public.onboarding_applications WHERE id = v_application_id) THEN
      RAISE EXCEPTION 'Owner Driver company readiness probe did not roll back cleanly.';
    END IF;

    -- Fleet activation remains fail-closed until all required company evidence
    -- is approved/current. The canonical missing set uses vehicle_insurance.
    v_application_id := NULL;
    v_fleet_rejected := false;
    BEGIN
      INSERT INTO public.onboarding_applications (
        user_id,
        company_id,
        account_type,
        status,
        email,
        current_step,
        completion_percentage,
        payload,
        risk_status
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

      SELECT COALESCE(array_agg(m.doc_type ORDER BY m.doc_type), ARRAY[]::text[])
      INTO v_missing
      FROM public.get_missing_onboarding_documents(v_application_id) m;

      IF v_missing IS DISTINCT FROM ARRAY['company_registration','goods_in_transit','public_liability','vehicle_insurance']::text[] THEN
        RAISE EXCEPTION 'Fleet missing-document set is not canonical: %', v_missing;
      END IF;

      BEGIN
        PERFORM public.assert_company_compliance_ready(v_company_id);
      EXCEPTION
        WHEN SQLSTATE '23514' THEN
          v_fleet_rejected := true;
      END;

      IF NOT v_fleet_rejected THEN
        RAISE EXCEPTION 'Fleet company readiness did not fail closed with required company documents missing.';
      END IF;

      RAISE EXCEPTION 'rollback fleet company readiness probe' USING ERRCODE = 'P0001';
    EXCEPTION
      WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'rollback fleet company readiness probe' THEN
          RAISE;
        END IF;
    END;

    IF EXISTS (SELECT 1 FROM public.onboarding_applications WHERE id = v_application_id) THEN
      RAISE EXCEPTION 'Fleet company readiness probe did not roll back cleanly.';
    END IF;

    RAISE EXCEPTION 'rollback synthetic company compliance fixture' USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'rollback synthetic company compliance fixture' THEN
        RAISE;
      END IF;
  END;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id OR email = v_fixture_email) THEN
    RAISE EXCEPTION 'Synthetic auth fixture did not roll back cleanly.';
  END IF;

  IF v_company_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.companies WHERE id = v_company_id) THEN
    RAISE EXCEPTION 'Synthetic company fixture did not roll back cleanly.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.company_documents
    WHERE lower(btrim(doc_type)) = 'motor_fleet_insurance'
  ) THEN
    RAISE EXCEPTION 'Production still contains the obsolete motor_fleet_insurance document type.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.compliance_document_requirements
    WHERE account_type = 'owner_driver'
      AND document_family = 'identity'
      AND doc_type = 'insurance'
      AND required = true
      AND active = true
  ) THEN
    RAISE EXCEPTION 'Personal / Driver Insurance is still a mandatory Owner Driver requirement.';
  END IF;
END;
$$;

COMMIT;
