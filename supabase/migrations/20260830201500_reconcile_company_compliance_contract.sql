BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- P0-10: converge company-level onboarding compliance around the persisted
-- onboarding account type. companies.company_type is a workspace label and is
-- deliberately not used as the compliance requirement key.

-- Canonical matrix. Keep the production fleet_operator compatibility alias
-- because historical applications still carry that stored value.
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

  ('fleet_operator', 'company', 'company_registration', true, true, 'Legacy production alias of fleet_courier: required business identity evidence.'),
  ('fleet_operator', 'company', 'public_liability', true, true, 'Legacy production alias of fleet_courier: required platform liability evidence.'),
  ('fleet_operator', 'company', 'goods_in_transit', true, true, 'Legacy production alias of fleet_courier: required before freight operations.'),
  ('fleet_operator', 'company', 'vehicle_insurance', true, true, 'Legacy production alias of fleet_courier: required vehicle or motor fleet insurance evidence.'),
  ('fleet_operator', 'company', 'operator_licence', false, true, 'Legacy production alias: conditional where legally required.'),
  ('fleet_operator', 'company', 'vat_registration', false, true, 'Legacy production alias: conditional when VAT registered.'),

  ('owner_driver', 'identity', 'driving_licence', true, true, 'Required verified driving identity.'),
  ('owner_driver', 'identity', 'proof_of_address', true, true, 'Required verified residential identity. A current verified Driving Licence may satisfy this requirement.'),
  ('owner_driver', 'identity', 'right_to_work', true, true, 'Required verified right-to-work evidence.'),
  ('owner_driver', 'identity', 'insurance', false, true, 'Optional personal / Driver insurance evidence. Vehicle Insurance is validated separately against the canonical vehicle.'),
  ('owner_driver', 'identity', 'cpc', false, true, 'Conditional: required where Driver CPC applies.'),
  ('owner_driver', 'identity', 'visa_document', false, true, 'Conditional: required where the right-to-work route needs it.'),

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

-- Hosted production permits an Owner Driver's current verified Driving Licence
-- to satisfy the Proof of Address requirement. Fresh replay previously rebuilt
-- an older helper that required a separate proof_of_address row, contradicting
-- both the canonical requirement note above and the P0-10 runtime proof.
CREATE OR REPLACE FUNCTION public.get_missing_onboarding_documents(p_application_id uuid)
RETURNS TABLE(document_family text, doc_type text, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH app AS (
    SELECT id, account_type
    FROM public.onboarding_applications
    WHERE id = p_application_id
  ),
  requirements AS (
    SELECT r.document_family, r.doc_type, app.account_type
    FROM public.compliance_document_requirements r
    JOIN app ON app.account_type = r.account_type
    WHERE r.active = true
      AND r.required = true
  )
  SELECT
    requirement.document_family,
    requirement.doc_type,
    CASE
      WHEN requirement.document_family = 'company'
        THEN 'Missing, unapproved or expired company document.'
      ELSE 'Missing, unverified or expired identity document.'
    END AS reason
  FROM requirements requirement
  WHERE NOT (
    CASE
      WHEN requirement.document_family = 'company' THEN EXISTS (
        SELECT 1
        FROM public.company_documents document
        WHERE document.onboarding_application_id = p_application_id
          AND document.doc_type = requirement.doc_type
          AND document.status = 'approved'
          AND document.file_path IS NOT NULL
          AND (document.expiry_date IS NULL OR document.expiry_date >= current_date)
      )
      WHEN requirement.document_family = 'identity' THEN (
        EXISTS (
          SELECT 1
          FROM public.driver_identity_documents document
          WHERE document.onboarding_application_id = p_application_id
            AND document.doc_type = requirement.doc_type
            AND document.verification_status = 'verified'
            AND document.file_path IS NOT NULL
            AND (document.expiry_date IS NULL OR document.expiry_date >= current_date)
        )
        OR (
          requirement.account_type = 'owner_driver'
          AND requirement.doc_type = 'proof_of_address'
          AND EXISTS (
            SELECT 1
            FROM public.driver_identity_documents licence
            WHERE licence.onboarding_application_id = p_application_id
              AND licence.doc_type = 'driving_licence'
              AND licence.verification_status = 'verified'
              AND licence.file_path IS NOT NULL
              AND (licence.expiry_date IS NULL OR licence.expiry_date >= current_date)
          )
        )
      )
      ELSE false
    END
  );
$$;

-- Match hosted production execution authority: this security-definer helper is
-- server-side only and is consumed by service-role governance/API paths.
REVOKE ALL ON FUNCTION public.get_missing_onboarding_documents(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_missing_onboarding_documents(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_missing_onboarding_documents(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_missing_onboarding_documents(uuid) TO service_role;

-- Remove only the obsolete fleet insurance alias from the requirement matrix.
-- The canonical requirement and upload contract are vehicle_insurance.
DELETE FROM public.compliance_document_requirements
WHERE account_type IN ('fleet_courier', 'fleet_operator')
  AND document_family = 'company'
  AND doc_type = 'motor_fleet_insurance';

-- Normalize any historical placeholder/evidence row carrying the obsolete alias.
UPDATE public.company_documents
SET doc_type = 'vehicle_insurance',
    updated_at = now()
WHERE lower(btrim(doc_type)) = 'motor_fleet_insurance';

CREATE OR REPLACE FUNCTION public.normalize_company_document_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF lower(btrim(COALESCE(NEW.doc_type, ''))) = 'motor_fleet_insurance' THEN
    NEW.doc_type := 'vehicle_insurance';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_company_document_type() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_company_document_type() FROM anon;
REVOKE ALL ON FUNCTION public.normalize_company_document_type() FROM authenticated;

DROP TRIGGER IF EXISTS trg_normalize_company_document_type ON public.company_documents;
CREATE TRIGGER trg_normalize_company_document_type
BEFORE INSERT OR UPDATE OF doc_type
ON public.company_documents
FOR EACH ROW
EXECUTE FUNCTION public.normalize_company_document_type();

-- Company activation has two distinct cases:
-- 1) broker/fleet accounts have required company-level evidence and must pass
--    the complete onboarding compliance gate;
-- 2) customer/Owner Driver/Company Driver accounts have no required company
--    document family. Their own identity/onboarding approval gate remains
--    authoritative, so company activation must not invent company documents.
-- Missing onboarding remains fail-closed for every governance activation.
CREATE OR REPLACE FUNCTION public.assert_company_compliance_ready(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application_id uuid;
  v_account_type text;
  v_has_required_company_documents boolean := false;
BEGIN
  SELECT application.id, application.account_type
  INTO v_application_id, v_account_type
  FROM public.companies company
  JOIN public.onboarding_applications application
    ON application.user_id = company.created_by
   AND (
     application.company_id = company.id
     OR application.company_id IS NULL
   )
  WHERE company.id = p_company_id
  ORDER BY
    CASE WHEN application.company_id = company.id THEN 0 ELSE 1 END,
    application.created_at DESC
  LIMIT 1;

  IF v_application_id IS NULL THEN
    RAISE EXCEPTION
      'Cannot activate company without a linked onboarding application.'
      USING ERRCODE = '23514';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.compliance_document_requirements requirement
    WHERE requirement.account_type = v_account_type
      AND requirement.document_family = 'company'
      AND requirement.required = true
      AND requirement.active = true
  )
  INTO v_has_required_company_documents;

  IF v_has_required_company_documents THEN
    PERFORM public.assert_onboarding_compliance_ready(v_application_id);
  END IF;
END;
$$;

-- The helper remains internal to the governance path.
REVOKE ALL ON FUNCTION public.assert_company_compliance_ready(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_company_compliance_ready(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.assert_company_compliance_ready(uuid) FROM authenticated;

DO $$
DECLARE
  v_owner_required text[];
  v_fleet_required text[];
  v_fleet_legacy_required text[];
BEGIN
  SELECT COALESCE(array_agg(doc_type ORDER BY doc_type), ARRAY[]::text[])
  INTO v_owner_required
  FROM public.compliance_document_requirements
  WHERE account_type = 'owner_driver'
    AND document_family = 'identity'
    AND required = true
    AND active = true;

  SELECT COALESCE(array_agg(doc_type ORDER BY doc_type), ARRAY[]::text[])
  INTO v_fleet_required
  FROM public.compliance_document_requirements
  WHERE account_type = 'fleet_courier'
    AND document_family = 'company'
    AND required = true
    AND active = true;

  SELECT COALESCE(array_agg(doc_type ORDER BY doc_type), ARRAY[]::text[])
  INTO v_fleet_legacy_required
  FROM public.compliance_document_requirements
  WHERE account_type = 'fleet_operator'
    AND document_family = 'company'
    AND required = true
    AND active = true;

  IF v_owner_required IS DISTINCT FROM ARRAY['driving_licence','proof_of_address','right_to_work']::text[] THEN
    RAISE EXCEPTION 'Owner Driver required-document contract is not canonical: %', v_owner_required;
  END IF;

  IF v_fleet_required IS DISTINCT FROM ARRAY['company_registration','goods_in_transit','public_liability','vehicle_insurance']::text[] THEN
    RAISE EXCEPTION 'Fleet Courier required-document contract is not canonical: %', v_fleet_required;
  END IF;

  IF v_fleet_legacy_required IS DISTINCT FROM v_fleet_required THEN
    RAISE EXCEPTION 'Legacy fleet_operator requirements diverge from fleet_courier: % vs %', v_fleet_legacy_required, v_fleet_required;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.compliance_document_requirements
    WHERE doc_type = 'motor_fleet_insurance'
      AND active = true
  ) THEN
    RAISE EXCEPTION 'Obsolete motor_fleet_insurance requirement remains active.';
  END IF;

  IF has_function_privilege('anon', 'public.get_missing_onboarding_documents(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.get_missing_onboarding_documents(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.get_missing_onboarding_documents(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Missing-document helper execution authority diverges from hosted production.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
