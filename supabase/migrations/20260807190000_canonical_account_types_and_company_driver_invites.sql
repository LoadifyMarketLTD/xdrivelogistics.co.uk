-- Canonical account-type contract.
--
-- Public registration/storage values:
--   customer_shipper | transport_broker | fleet_operator | owner_driver
-- Invitation-only storage value:
--   company_driver
--
-- Historical aliases are migrated once and must not be written again.
-- Owner Operator intentionally persists as owner_driver.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- -----------------------------------------------------------------------------
-- 1. Normalise existing onboarding records before tightening the constraint.
-- -----------------------------------------------------------------------------
UPDATE public.onboarding_applications
SET account_type = CASE lower(trim(account_type))
  WHEN 'broker_shipper' THEN 'transport_broker'
  WHEN 'freight_broker' THEN 'transport_broker'
  WHEN 'broker' THEN 'transport_broker'
  WHEN 'fleet_courier' THEN 'fleet_operator'
  WHEN 'company_admin' THEN 'fleet_operator'
  WHEN 'individual_driver' THEN 'company_driver'
  WHEN 'owner_operator' THEN 'owner_driver'
  WHEN 'owner-operator' THEN 'owner_driver'
  WHEN 'owner-driver' THEN 'owner_driver'
  ELSE lower(trim(account_type))
END,
payload = CASE
  WHEN lower(trim(account_type)) IN ('individual_driver', 'company_driver') THEN
    jsonb_set(COALESCE(payload, '{}'::jsonb), '{canonical_account_type}', '"company_driver"'::jsonb, true)
  WHEN lower(trim(account_type)) IN ('owner_operator', 'owner-operator', 'owner-driver', 'owner_driver') THEN
    jsonb_set(COALESCE(payload, '{}'::jsonb), '{canonical_account_type}', '"owner_driver"'::jsonb, true)
  WHEN lower(trim(account_type)) IN ('broker_shipper', 'freight_broker', 'broker', 'transport_broker') THEN
    jsonb_set(COALESCE(payload, '{}'::jsonb), '{canonical_account_type}', '"transport_broker"'::jsonb, true)
  WHEN lower(trim(account_type)) IN ('fleet_courier', 'company_admin', 'fleet_operator') THEN
    jsonb_set(COALESCE(payload, '{}'::jsonb), '{canonical_account_type}', '"fleet_operator"'::jsonb, true)
  ELSE payload
END,
updated_at = now()
WHERE account_type IS NOT NULL;

-- Drop only CHECK constraints on onboarding_applications that reference account_type.
DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'onboarding_applications'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%account_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.onboarding_applications DROP CONSTRAINT %I', constraint_record.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.onboarding_applications
  ADD CONSTRAINT onboarding_applications_account_type_canonical_check
  CHECK (account_type IN (
    'customer_shipper',
    'transport_broker',
    'fleet_operator',
    'owner_driver',
    'company_driver'
  ));

-- -----------------------------------------------------------------------------
-- 2. Rebuild compliance requirements with canonical account types only.
-- -----------------------------------------------------------------------------
DELETE FROM public.compliance_document_requirements
WHERE account_type IN (
  'broker_shipper', 'transport_broker',
  'fleet_courier', 'fleet_operator',
  'individual_driver', 'company_driver',
  'owner_operator', 'owner_driver'
);

INSERT INTO public.compliance_document_requirements
  (account_type, document_family, doc_type, required, active, notes)
VALUES
  ('transport_broker', 'company', 'company_registration', true, true, 'Required business identity evidence.'),
  ('transport_broker', 'company', 'public_liability', true, true, 'Required platform liability evidence.'),
  ('transport_broker', 'company', 'vat_registration', false, true, 'Conditional: required only when VAT registered.'),

  ('fleet_operator', 'company', 'company_registration', true, true, 'Required business identity evidence.'),
  ('fleet_operator', 'company', 'public_liability', true, true, 'Required platform liability evidence.'),
  ('fleet_operator', 'company', 'goods_in_transit', true, true, 'Required before marketplace freight operations.'),
  ('fleet_operator', 'company', 'vehicle_insurance', true, true, 'Required vehicle or motor fleet insurance evidence.'),
  ('fleet_operator', 'company', 'operator_licence', false, true, 'Conditional: required where the vehicles or operation legally require it.'),
  ('fleet_operator', 'company', 'vat_registration', false, true, 'Conditional: required only when VAT registered.'),

  ('owner_driver', 'identity', 'driving_licence', true, true, 'Required verified driving identity.'),
  ('owner_driver', 'identity', 'proof_of_address', true, true, 'Required verified residential identity.'),
  ('owner_driver', 'identity', 'right_to_work', true, true, 'Required verified right-to-work evidence.'),
  ('owner_driver', 'identity', 'insurance', true, true, 'Required carrier or vehicle insurance evidence.'),
  ('owner_driver', 'identity', 'cpc', false, true, 'Conditional: required where Driver CPC applies.'),
  ('owner_driver', 'identity', 'visa_document', false, true, 'Conditional: required where the right-to-work route needs it.'),

  ('company_driver', 'identity', 'driving_licence', true, true, 'Required verified driving identity.'),
  ('company_driver', 'identity', 'proof_of_address', true, true, 'Required verified residential identity.'),
  ('company_driver', 'identity', 'right_to_work', true, true, 'Required verified right-to-work evidence.'),
  ('company_driver', 'identity', 'cpc', false, true, 'Conditional: required where Driver CPC applies.'),
  ('company_driver', 'identity', 'visa_document', false, true, 'Conditional: required where the right-to-work route needs it.')
ON CONFLICT (account_type, document_family, doc_type)
DO UPDATE SET
  required = EXCLUDED.required,
  active = EXCLUDED.active,
  notes = EXCLUDED.notes,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 3. Normalise auth account_type metadata without changing platform-owner role.
--    Company drivers are derived from the authoritative drivers table.
-- -----------------------------------------------------------------------------
UPDATE auth.users user_record
SET raw_user_meta_data = jsonb_set(
      COALESCE(user_record.raw_user_meta_data, '{}'::jsonb),
      '{account_type}',
      to_jsonb(CASE lower(trim(COALESCE(user_record.raw_user_meta_data->>'account_type', '')))
        WHEN 'broker_shipper' THEN 'transport_broker'
        WHEN 'freight_broker' THEN 'transport_broker'
        WHEN 'broker' THEN 'transport_broker'
        WHEN 'fleet_courier' THEN 'fleet_operator'
        WHEN 'company_admin' THEN 'fleet_operator'
        WHEN 'owner_operator' THEN 'owner_driver'
        WHEN 'owner-operator' THEN 'owner_driver'
        WHEN 'owner-driver' THEN 'owner_driver'
        WHEN 'individual_driver' THEN 'company_driver'
        ELSE lower(trim(user_record.raw_user_meta_data->>'account_type'))
      END),
      true
    ),
    updated_at = now()
WHERE COALESCE(user_record.raw_app_meta_data->>'role', '') <> 'owner'
  AND lower(trim(COALESCE(user_record.raw_user_meta_data->>'account_type', ''))) IN (
    'broker_shipper', 'freight_broker', 'broker',
    'fleet_courier', 'company_admin',
    'owner_operator', 'owner-operator', 'owner-driver',
    'individual_driver'
  );

UPDATE auth.users user_record
SET raw_user_meta_data = jsonb_set(
      COALESCE(user_record.raw_user_meta_data, '{}'::jsonb),
      '{account_type}',
      '"company_driver"'::jsonb,
      true
    ),
    updated_at = now()
WHERE COALESCE(user_record.raw_app_meta_data->>'role', '') <> 'owner'
  AND EXISTS (
    SELECT 1
    FROM public.drivers driver
    WHERE driver.user_id = user_record.id
      AND driver.driver_type = 'company_driver'
  )
  AND COALESCE(user_record.raw_user_meta_data->>'account_type', '') <> 'company_driver';

-- -----------------------------------------------------------------------------
-- 4. Company Driver invitation binding always creates canonical onboarding.
-- -----------------------------------------------------------------------------
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
    IF v_existing.account_type = 'owner_driver' THEN
      IF v_existing.company_id IS NULL THEN
        UPDATE public.onboarding_applications
        SET company_id = p_company_id,
            payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{canonical_account_type}', '"owner_driver"'::jsonb, true),
            last_activity_at = now(),
            updated_at = now()
        WHERE id = v_existing.id;
        RETURN v_existing.id;
      END IF;

      IF v_existing.company_id <> p_company_id THEN
        RAISE EXCEPTION 'Identity conflict: this Owner Operator is already linked to another company.'
          USING ERRCODE = '23505';
      END IF;
      RETURN v_existing.id;
    END IF;

    IF v_existing.account_type = 'company_driver' THEN
      IF v_existing.company_id IS NULL THEN
        RAISE EXCEPTION 'Identity conflict: an unlinked Company Driver application requires Platform Owner review before company assignment.'
          USING ERRCODE = '23505';
      END IF;

      IF v_existing.company_id <> p_company_id THEN
        RAISE EXCEPTION 'Identity conflict: this Company Driver is already linked to another Fleet Operator.'
          USING ERRCODE = '23505';
      END IF;
      RETURN v_existing.id;
    END IF;

    RAISE EXCEPTION
      'Identity conflict: this user already has % onboarding and cannot be invited as a Company Driver.',
      v_existing.account_type
      USING ERRCODE = '23505';
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
    'company_driver',
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
-- 5. Company Driver submission remains review-gated. RPC name is retained only
--    for API compatibility; it now requires canonical company_driver storage.
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

  IF v_app.account_type <> 'company_driver' THEN
    RAISE EXCEPTION 'Application is not a Company Driver onboarding.' USING ERRCODE = '23514';
  END IF;

  IF v_app.company_id IS NULL THEN
    RAISE EXCEPTION 'Company Driver onboarding must be linked to one Fleet Operator.' USING ERRCODE = '23514';
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
      company_id = v_app.company_id,
      is_driver = true,
      updated_at = now()
  WHERE user_id = v_app.user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (
      user_id, full_name, phone, role, status, company_id, is_driver, created_at, updated_at
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
      onboarding_application_id, doc_type, upload_status, verification_status
    )
    VALUES (v_app.id, v_doc_type, 'missing', 'unverified')
    ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE public.onboarding_applications
  SET status = 'under_review',
      current_step = 'pending_review',
      completion_percentage = 100,
      payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{canonical_account_type}', '"company_driver"'::jsonb, true),
      submitted_at = COALESCE(submitted_at, now()),
      last_activity_at = now(),
      updated_at = now()
  WHERE id = v_app.id;

  RETURN v_app.id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Approval maps canonical account types to the correct identity mode.
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
    WHEN NEW.account_type = 'company_driver' THEN 'company_driver'
    WHEN NEW.account_type = 'owner_driver' THEN 'owner_driver'
    WHEN NEW.account_type IN ('fleet_operator', 'transport_broker') THEN 'company_owner'
    ELSE 'company_user'
  END;

  IF v_identity_mode IN ('company_driver', 'owner_driver') AND NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Cannot activate % identity without one linked company.', v_identity_mode
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
    RAISE EXCEPTION 'Identity conflict: approval would replace another company or identity mode.'
      USING ERRCODE = '23505';
  END IF;

  v_normalized_name := lower(trim(COALESCE(
    NULLIF(NEW.payload->>'full_name', ''),
    NULLIF(NEW.payload->>'contact_person', ''),
    split_part(NEW.email, '@', 1)
  )));

  INSERT INTO public.platform_identity_registry (
    user_id, company_id, identity_mode, legal_name_normalized, status, verified_at, verified_by, updated_at
  )
  VALUES (
    NEW.user_id, NEW.company_id, v_identity_mode, v_normalized_name, 'active', now(), NEW.risk_reviewed_by, now()
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
        driver_type = CASE WHEN v_identity_mode = 'company_driver' THEN 'company_driver' ELSE 'owner_driver' END,
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

-- Ensure Company Driver auth metadata is canonical whenever a driver row is
-- created/reassigned. This does not change platform-owner accounts.
CREATE OR REPLACE FUNCTION public.sync_company_driver_auth_account_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NEW.user_id IS NULL OR NEW.driver_type <> 'company_driver' THEN
    RETURN NEW;
  END IF;

  UPDATE auth.users user_record
  SET raw_user_meta_data = jsonb_set(
        COALESCE(user_record.raw_user_meta_data, '{}'::jsonb),
        '{account_type}',
        '"company_driver"'::jsonb,
        true
      ),
      updated_at = now()
  WHERE user_record.id = NEW.user_id
    AND COALESCE(user_record.raw_app_meta_data->>'role', '') <> 'owner';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_driver_auth_account_type ON public.drivers;
CREATE TRIGGER trg_sync_company_driver_auth_account_type
  AFTER INSERT OR UPDATE OF user_id, driver_type
  ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_company_driver_auth_account_type();

REVOKE ALL ON FUNCTION public.ensure_company_driver_onboarding(uuid, uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_individual_driver_onboarding(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_company_driver_auth_account_type() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_company_driver_onboarding(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.submit_individual_driver_onboarding(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
