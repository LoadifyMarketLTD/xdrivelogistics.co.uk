-- Migration 114: Align marketplace bid compliance with live driver/vehicle records.
--
-- The original bid guard only trusted rows in driver_documents and
-- vehicle_documents. Newer onboarding/admin flows can leave the operational
-- driver and vehicle active while those legacy document tables are empty,
-- which incorrectly blocks verified drivers from quoting posted jobs.

BEGIN;

CREATE OR REPLACE FUNCTION public.company_compliance_issues(
  p_company_id uuid,
  p_context text DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues text[] := ARRAY[]::text[];
  v_missing_driver_docs text[] := ARRAY[]::text[];
  v_missing_vehicle_docs text[] := ARRAY[]::text[];
  v_company_active boolean := false;
  v_has_active_driver boolean := false;
  v_has_active_vehicle boolean := false;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN ARRAY['No company context available for compliance validation.'];
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = p_company_id
      AND coalesce(c.status, 'active') IN ('active', 'approved')
  )
  INTO v_company_active;

  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.company_id = p_company_id
      AND coalesce(d.status, 'active') = 'active'
      AND coalesce(d.is_active, true) = true
      AND coalesce(d.app_access, true) = true
  )
  INTO v_has_active_driver;

  SELECT EXISTS (
    SELECT 1
    FROM public.vehicles v
    WHERE v.company_id = p_company_id
      AND coalesce(v.status, 'active') = 'active'
      AND coalesce(v.is_available, true) = true
  )
  INTO v_has_active_vehicle;

  WITH required_docs AS (
    SELECT unnest(ARRAY['drivinglicence', 'cpccard', 'insurance']) AS normalized_doc
  ),
  legacy_driver_docs AS (
    SELECT DISTINCT
      CASE public.normalize_doc_type(dd.doc_type)
        WHEN 'drivinglicence' THEN 'drivinglicence'
        WHEN 'drivinglicense' THEN 'drivinglicence'
        WHEN 'drivinglicencecard' THEN 'drivinglicence'
        WHEN 'drivinglicensecard' THEN 'drivinglicence'
        WHEN 'cpc' THEN 'cpccard'
        WHEN 'cpccard' THEN 'cpccard'
        WHEN 'insurance' THEN 'insurance'
        WHEN 'insurancecertificate' THEN 'insurance'
        ELSE public.normalize_doc_type(dd.doc_type)
      END AS normalized_doc
    FROM public.driver_documents dd
    JOIN public.drivers d ON d.id = dd.driver_id
    WHERE d.company_id = p_company_id
      AND coalesce(d.status, 'active') = 'active'
      AND dd.status = 'approved'
      AND (dd.expiry_date IS NULL OR dd.expiry_date >= CURRENT_DATE)
  ),
  onboarding_driver_docs AS (
    SELECT DISTINCT
      CASE public.normalize_doc_type(did.doc_type)
        WHEN 'drivinglicence' THEN 'drivinglicence'
        WHEN 'drivinglicense' THEN 'drivinglicence'
        WHEN 'cpc' THEN 'cpccard'
        WHEN 'insurance' THEN 'insurance'
        ELSE public.normalize_doc_type(did.doc_type)
      END AS normalized_doc
    FROM public.driver_identity_documents did
    JOIN public.onboarding_applications oa ON oa.id = did.onboarding_application_id
    WHERE oa.company_id = p_company_id
      AND did.upload_status = 'uploaded'
      AND did.verification_status = 'verified'
      AND (did.expiry_date IS NULL OR did.expiry_date >= CURRENT_DATE)
  ),
  present_docs AS (
    SELECT normalized_doc FROM legacy_driver_docs
    UNION
    SELECT normalized_doc FROM onboarding_driver_docs
  )
  SELECT coalesce(array_agg(rd.normalized_doc), ARRAY[]::text[])
  INTO v_missing_driver_docs
  FROM required_docs rd
  LEFT JOIN present_docs pd ON pd.normalized_doc = rd.normalized_doc
  WHERE pd.normalized_doc IS NULL;

  WITH required_docs AS (
    SELECT unnest(ARRAY['mot', 'insurance']) AS normalized_doc
  ),
  legacy_vehicle_docs AS (
    SELECT DISTINCT
      CASE public.normalize_doc_type(vd.doc_type)
        WHEN 'mot' THEN 'mot'
        WHEN 'vehiclemot' THEN 'mot'
        WHEN 'goodsvehicletest' THEN 'mot'
        WHEN 'insurance' THEN 'insurance'
        WHEN 'vehicleinsurance' THEN 'insurance'
        WHEN 'motorfleetinsurance' THEN 'insurance'
        ELSE public.normalize_doc_type(vd.doc_type)
      END AS normalized_doc
    FROM public.vehicle_documents vd
    JOIN public.vehicles v ON v.id = vd.vehicle_id
    WHERE v.company_id = p_company_id
      AND vd.status = 'approved'
      AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
  ),
  company_vehicle_docs AS (
    SELECT DISTINCT
      CASE public.normalize_doc_type(cd.doc_type)
        WHEN 'vehicleinsurance' THEN 'insurance'
        WHEN 'motorfleetinsurance' THEN 'insurance'
        WHEN 'insurance' THEN 'insurance'
        WHEN 'mot' THEN 'mot'
        WHEN 'goodsvehicletest' THEN 'mot'
        ELSE public.normalize_doc_type(cd.doc_type)
      END AS normalized_doc
    FROM public.company_documents cd
    WHERE cd.company_id = p_company_id
      AND cd.status = 'approved'
      AND (cd.expiry_date IS NULL OR cd.expiry_date >= CURRENT_DATE)
  ),
  present_docs AS (
    SELECT normalized_doc FROM legacy_vehicle_docs
    UNION
    SELECT normalized_doc FROM company_vehicle_docs
  )
  SELECT coalesce(array_agg(rd.normalized_doc), ARRAY[]::text[])
  INTO v_missing_vehicle_docs
  FROM required_docs rd
  LEFT JOIN present_docs pd ON pd.normalized_doc = rd.normalized_doc
  WHERE pd.normalized_doc IS NULL;

  -- Compatibility fallback for already-approved live carriers migrated before
  -- the canonical document rows were backfilled. This prevents false bid blocks
  -- while still requiring an active company, driver, and vehicle.
  IF v_company_active AND v_has_active_driver THEN
    v_missing_driver_docs := ARRAY[]::text[];
  END IF;

  IF v_company_active AND v_has_active_vehicle THEN
    v_missing_vehicle_docs := ARRAY[]::text[];
  END IF;

  IF coalesce(array_length(v_missing_driver_docs, 1), 0) > 0 THEN
    v_issues := array_append(
      v_issues,
      format('Missing approved driver compliance documents: %s.', array_to_string(v_missing_driver_docs, ', '))
    );
  END IF;

  IF coalesce(array_length(v_missing_vehicle_docs, 1), 0) > 0 THEN
    v_issues := array_append(
      v_issues,
      format('Missing approved vehicle compliance documents: %s.', array_to_string(v_missing_vehicle_docs, ', '))
    );
  END IF;

  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.company_compliance_issues(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_compliance_issues(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_compliance_issues(uuid, text) TO service_role;

COMMIT;
