-- Unified onboarding contract and activation gate.
--
-- Canonical product identities:
--   customer_shipper, broker_shipper, fleet_courier, owner_driver, company_driver.
--
-- The existing database value `individual_driver` is retained only as the
-- persisted compatibility value for invitation-only Company Driver onboarding.
-- It must never create a separate company or activate before Platform Review.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- -----------------------------------------------------------------------------
-- 1. One document matrix for UI, upload validation and approval gating.
-- -----------------------------------------------------------------------------
DELETE FROM public.compliance_document_requirements
WHERE account_type IN (
  'broker_shipper',
  'fleet_courier',
  'owner_driver',
  'individual_driver'
);

INSERT INTO public.compliance_document_requirements
  (account_type, document_family, doc_type, required, active, notes)
VALUES
  ('broker_shipper', 'company', 'company_registration', true, true, 'Required business identity evidence.'),
  ('broker_shipper', 'company', 'public_liability', true, true, 'Required platform liability evidence.'),
  ('broker_shipper', 'company', 'vat_registration', false, true, 'Conditional: required only when VAT registered.'),

  ('fleet_courier', 'company', 'company_registration', true, true, 'Required business identity evidence.'),
  ('fleet_courier', 'company', 'public_liability', true, true, 'Required platform liability evidence.'),
  ('fleet_courier', 'company', 'goods_in_transit', true, true, 'Required before marketplace freight operations.'),
  ('fleet_courier', 'company', 'vehicle_insurance', true, true, 'Required vehicle or motor fleet insurance evidence.'),
  ('fleet_courier', 'company', 'operator_licence', false, true, 'Conditional: required where the vehicles or operation legally require it.'),
  ('fleet_courier', 'company', 'vat_registration', false, true, 'Conditional: required only when VAT registered.'),

  ('owner_driver', 'identity', 'driving_licence', true, true, 'Required verified driving identity.'),
  ('owner_driver', 'identity', 'proof_of_address', true, true, 'Required verified residential identity.'),
  ('owner_driver', 'identity', 'right_to_work', true, true, 'Required verified right-to-work evidence.'),
  ('owner_driver', 'identity', 'insurance', true, true, 'Required carrier or vehicle insurance evidence.'),
  ('owner_driver', 'identity', 'cpc', false, true, 'Conditional: required where Driver CPC applies.'),
  ('owner_driver', 'identity', 'visa_document', false, true, 'Conditional: required where the right-to-work route needs it.'),

  -- `individual_driver` is the stored compatibility value for Company Driver.
  ('individual_driver', 'identity', 'driving_licence', true, true, 'Required verified driving identity.'),
  ('individual_driver', 'identity', 'proof_of_address', true, true, 'Required verified residential identity.'),
  ('individual_driver', 'identity', 'right_to_work', true, true, 'Required verified right-to-work evidence.'),
  ('individual_driver', 'identity', 'cpc', false, true, 'Conditional: required where Driver CPC applies.'),
  ('individual_driver', 'identity', 'visa_document', false, true, 'Conditional: required where the right-to-work route needs it.')
ON CONFLICT (account_type, document_family, doc_type)
DO UPDATE SET
  required = EXCLUDED.required,
  active = EXCLUDED.active,
  notes = EXCLUDED.notes,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 2. Helpers used by every activation path.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.identity_registry_allows_driver_access(
  p_user_id uuid,
  p_company_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_identity_registry identity
    WHERE identity.user_id = p_user_id
      AND identity.company_id = p_company_id
      AND identity.identity_mode IN ('company_driver', 'owner_driver')
      AND identity.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.ensure_company_driver_onboarding(
  p_user_id uuid,
  p_company_id uuid,
  p_display_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing public.onboarding_applications%ROWTYPE;
  v_email text;
  v_application_id uuid;
BEGIN
  SELECT *
  INTO v_existing
  FROM public.onboarding_applications application
  WHERE application.user_id = p_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.account_type NOT IN ('individual_driver', 'owner_driver') THEN
      RAISE EXCEPTION
        'Identity conflict: this user already has % onboarding and cannot be invited as a Company Driver.',
        v_existing.account_type
        USING ERRCODE = '23505';
    END IF;

    IF v_existing.company_id IS NULL THEN
      RAISE EXCEPTION
        'Identity conflict: an unlinked historical driver application requires Platform Owner review before company assignment.'
        USING ERRCODE = '23505';
    END IF;

    IF v_existing.company_id <> p_company_id THEN
      RAISE EXCEPTION
        'Identity conflict: this user is already linked to another company.'
        USING ERRCODE = '23505';
    END IF;

    RETURN v_existing.id;
  END IF;

  SELECT user_record.email
  INTO v_email
  FROM auth.users user_record
  WHERE user_record.id = p_user_id;

  INSERT INTO public.onboarding_applications (
    user_id,
    email,
    account_type,
    status,
    current_step,
    completion_percentage,
    company_id,
    payload,
    last_activity_at
  )
  VALUES (
    p_user_id,
    COALESCE(v_email, 'unknown@xdrive.local'),
    'individual_driver',
    'invited',
    'identity_details',
    5,
    p_company_id,
    jsonb_strip_nulls(jsonb_build_object(
      'canonical_account_type', 'company_driver',
      'invited_by_company_id', p_company_id,
      'full_name', p_display_name,
      'phone', p_phone,
      'email', v_email
    )),
    now()
  )
  RETURNING id INTO v_application_id;

  RETURN v_application_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Fail closed whenever a driver profile is created or reassigned.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_driver_profile_identity_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_identity public.platform_identity_registry%ROWTYPE;
BEGIN
  IF NEW.role IS DISTINCT FROM 'driver' OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_identity
  FROM public.platform_identity_registry identity
  WHERE identity.user_id = NEW.user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_identity.status = 'active'
       AND v_identity.company_id = NEW.company_id
       AND v_identity.identity_mode IN ('company_driver', 'owner_driver')
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Identity conflict: the verified identity cannot be activated for this company or role.'
      USING ERRCODE = '23505';
  END IF;

  PERFORM public.ensure_company_driver_onboarding(
    NEW.user_id,
    NEW.company_id,
    NEW.full_name,
    NEW.phone
  );

  NEW.status := 'pending_verification';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_driver_identity_gate ON public.profiles;
CREATE TRIGGER trg_profiles_driver_identity_gate
  BEFORE INSERT OR UPDATE OF role, company_id, status
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_driver_profile_identity_gate();

CREATE OR REPLACE FUNCTION public.enforce_driver_record_identity_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_identity public.platform_identity_registry%ROWTYPE;
BEGIN
  IF NEW.user_id IS NULL OR NEW.company_id IS NULL THEN
    NEW.status := 'pending_verification';
    NEW.app_access := false;
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_identity
  FROM public.platform_identity_registry identity
  WHERE identity.user_id = NEW.user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_identity.status = 'active'
       AND v_identity.company_id = NEW.company_id
       AND v_identity.identity_mode IN ('company_driver', 'owner_driver')
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'Identity conflict: the verified identity cannot be assigned to this company.'
      USING ERRCODE = '23505';
  END IF;

  PERFORM public.ensure_company_driver_onboarding(
    NEW.user_id,
    NEW.company_id,
    NEW.display_name,
    NEW.phone
  );

  NEW.status := 'pending_verification';
  NEW.app_access := false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_drivers_identity_gate ON public.drivers;
CREATE TRIGGER trg_drivers_identity_gate
  BEFORE INSERT OR UPDATE OF user_id, company_id, status, app_access
  ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_driver_record_identity_gate();

CREATE OR REPLACE FUNCTION public.enforce_driver_membership_identity_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_role text;
BEGIN
  IF NEW.user_id IS NULL OR NEW.status::text <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT profile.role
  INTO v_profile_role
  FROM public.profiles profile
  WHERE profile.user_id = NEW.user_id;

  IF v_profile_role = 'driver'
     AND NOT public.identity_registry_allows_driver_access(NEW.user_id, NEW.company_id)
  THEN
    NEW.status := 'invited';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_memberships_driver_identity_gate
  ON public.company_memberships;
CREATE TRIGGER trg_company_memberships_driver_identity_gate
  BEFORE INSERT OR UPDATE OF user_id, company_id, status
  ON public.company_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_driver_membership_identity_gate();

-- -----------------------------------------------------------------------------
-- 4. Company Driver submission preserves the fleet relationship and never
--    grants access. Approval is the only activation event.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_individual_driver_onboarding(p_application_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app public.onboarding_applications%ROWTYPE;
  v_doc_type text;
BEGIN
  SELECT *
  INTO v_app
  FROM public.onboarding_applications application
  WHERE application.id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Onboarding application not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_app.account_type <> 'individual_driver' THEN
    RAISE EXCEPTION 'Application is not a Company Driver onboarding.' USING ERRCODE = '23514';
  END IF;

  IF v_app.status NOT IN ('invited', 'draft', 'in_progress', 'request_changes', 'submitted', 'under_review') THEN
    RAISE EXCEPTION 'Company Driver onboarding cannot be submitted from status %.', v_app.status
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(trim(v_app.payload->>'full_name'), ''), full_name),
      phone = COALESCE(NULLIF(trim(v_app.payload->>'phone'), ''), phone),
      role = 'driver',
      status = 'pending_verification',
      company_id = COALESCE(v_app.company_id, company_id),
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
      'pending_verification',
      v_app.company_id,
      true,
      now(),
      now()
    );
  END IF;

  FOREACH v_doc_type IN ARRAY ARRAY[
    'driving_licence',
    'proof_of_address',
    'right_to_work',
    'cpc',
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
  SET status = 'under_review',
      current_step = 'pending_review',
      completion_percentage = 100,
      payload = jsonb_set(
        COALESCE(payload, '{}'::jsonb),
        '{canonical_account_type}',
        '"company_driver"'::jsonb,
        true
      ),
      submitted_at = COALESCE(submitted_at, now()),
      last_activity_at = now()
  WHERE id = v_app.id;

  RETURN v_app.id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Approval is the single activation event for every verified identity.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_approved_onboarding_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_identity_mode text;
  v_existing public.platform_identity_registry%ROWTYPE;
  v_normalized_name text;
BEGIN
  IF NEW.status <> 'approved' OR COALESCE(OLD.status, '') = 'approved' THEN
    RETURN NEW;
  END IF;

  v_identity_mode := CASE
    WHEN NEW.account_type = 'individual_driver' THEN 'company_driver'
    WHEN NEW.account_type = 'owner_driver' THEN 'owner_driver'
    WHEN NEW.account_type IN ('fleet_courier', 'broker_shipper') THEN 'company_owner'
    ELSE 'company_user'
  END;

  IF v_identity_mode IN ('company_driver', 'owner_driver') AND NEW.company_id IS NULL THEN
    RAISE EXCEPTION
      'Cannot activate % identity without one linked company.', v_identity_mode
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.platform_identity_registry identity
  WHERE identity.user_id = NEW.user_id
  FOR UPDATE;

  IF FOUND AND (
    v_existing.identity_mode <> v_identity_mode
    OR v_existing.company_id IS DISTINCT FROM NEW.company_id
  ) THEN
    RAISE EXCEPTION
      'Identity conflict: approval would replace another company or identity mode.'
      USING ERRCODE = '23505';
  END IF;

  v_normalized_name := lower(trim(COALESCE(
    NULLIF(NEW.payload->>'full_name', ''),
    NULLIF(NEW.payload->>'contact_person', ''),
    split_part(NEW.email, '@', 1)
  )));

  INSERT INTO public.platform_identity_registry (
    user_id,
    company_id,
    identity_mode,
    legal_name_normalized,
    status,
    verified_at,
    verified_by,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.company_id,
    v_identity_mode,
    v_normalized_name,
    'active',
    now(),
    NEW.risk_reviewed_by,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    company_id = EXCLUDED.company_id,
    identity_mode = EXCLUDED.identity_mode,
    legal_name_normalized = EXCLUDED.legal_name_normalized,
    status = 'active',
    verified_at = now(),
    verified_by = EXCLUDED.verified_by,
    updated_at = now();

  UPDATE public.profiles
  SET status = 'active',
      company_id = COALESCE(NEW.company_id, company_id),
      updated_at = now()
  WHERE user_id = NEW.user_id;

  IF v_identity_mode IN ('company_driver', 'owner_driver') THEN
    UPDATE public.drivers
    SET status = 'active',
        app_access = true,
        company_id = NEW.company_id,
        updated_at = now()
    WHERE user_id = NEW.user_id;

    UPDATE public.company_memberships
    SET status = 'active',
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND company_id = NEW.company_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activate_approved_onboarding_identity
  ON public.onboarding_applications;
CREATE TRIGGER trg_activate_approved_onboarding_identity
  AFTER UPDATE OF status
  ON public.onboarding_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.activate_approved_onboarding_identity();

REVOKE ALL ON FUNCTION public.identity_registry_allows_driver_access(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_company_driver_onboarding(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_individual_driver_onboarding(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.identity_registry_allows_driver_access(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_company_driver_onboarding(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_individual_driver_onboarding(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
