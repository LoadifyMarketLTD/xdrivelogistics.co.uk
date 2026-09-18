CREATE OR REPLACE FUNCTION public.company_compliance_issues(
  p_company_id uuid,
  p_context text DEFAULT NULL::text
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_issues text[] := array[]::text[];
  v_missing_driver_docs text[] := array[]::text[];
  v_missing_vehicle_docs text[] := array[]::text[];
BEGIN
  IF p_company_id IS NULL THEN
    RETURN ARRAY['No company context available for compliance validation.'];
  END IF;

  IF v_role <> 'service_role' THEN
    IF v_actor IS NULL THEN
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;
    IF NOT public.is_owner(v_actor)
       AND NOT EXISTS (
         SELECT 1
         FROM public.company_memberships cm
         WHERE cm.company_id = p_company_id
           AND cm.user_id = v_actor
           AND cm.status::text = 'active'
       ) THEN
      RAISE EXCEPTION 'Company compliance access denied.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF lower(coalesce(p_context, '')) = 'publish' THEN
    RETURN v_issues;
  END IF;

  WITH required_docs AS (
    SELECT unnest(ARRAY['drivinglicence', 'insurance']) AS normalized_doc
  ),
  present_docs AS (
    SELECT DISTINCT
      CASE regexp_replace(lower(COALESCE(dd.doc_type, '')), '[^a-z0-9]+', '', 'g')
        WHEN 'drivinglicense' THEN 'drivinglicence'
        WHEN 'drivinglicencecard' THEN 'drivinglicence'
        WHEN 'drivinglicensecard' THEN 'drivinglicence'
        WHEN 'insurancecertificate' THEN 'insurance'
        ELSE regexp_replace(lower(COALESCE(dd.doc_type, '')), '[^a-z0-9]+', '', 'g')
      END AS normalized_doc
    FROM public.driver_documents dd
    JOIN public.drivers d ON d.id = dd.driver_id
    WHERE d.company_id = p_company_id
      AND coalesce(d.status::text, 'active') = 'active'
      AND lower(coalesce(dd.status::text, '')) = 'approved'
      AND (dd.expiry_date IS NULL OR dd.expiry_date >= CURRENT_DATE)
    UNION
    SELECT DISTINCT
      CASE regexp_replace(lower(COALESCE(did.doc_type, '')), '[^a-z0-9]+', '', 'g')
        WHEN 'drivinglicense' THEN 'drivinglicence'
        ELSE regexp_replace(lower(COALESCE(did.doc_type, '')), '[^a-z0-9]+', '', 'g')
      END AS normalized_doc
    FROM public.driver_identity_documents did
    JOIN public.onboarding_applications oa ON oa.id = did.onboarding_application_id
    WHERE oa.company_id = p_company_id
      AND lower(coalesce(did.verification_status::text, '')) = 'verified'
      AND (did.expiry_date IS NULL OR did.expiry_date >= CURRENT_DATE)
  )
  SELECT coalesce(array_agg(rd.normalized_doc), ARRAY[]::text[])
  INTO v_missing_driver_docs
  FROM required_docs rd
  LEFT JOIN present_docs pd ON pd.normalized_doc = rd.normalized_doc
  WHERE pd.normalized_doc IS NULL;

  WITH required_docs AS (
    SELECT unnest(ARRAY['mot', 'insurance']) AS normalized_doc
  ),
  present_docs AS (
    SELECT DISTINCT
      CASE regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
        WHEN 'vehiclemot' THEN 'mot'
        WHEN 'goodsvehicletest' THEN 'mot'
        WHEN 'vehicleinsurance' THEN 'insurance'
        WHEN 'motorfleetinsurance' THEN 'insurance'
        WHEN 'insurancecertificate' THEN 'insurance'
        ELSE regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
      END AS normalized_doc
    FROM public.vehicle_documents vd
    JOIN public.vehicles v ON v.id = vd.vehicle_id
    WHERE v.company_id = p_company_id
      AND lower(coalesce(vd.status::text, '')) = 'approved'
      AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
  )
  SELECT coalesce(array_agg(rd.normalized_doc), ARRAY[]::text[])
  INTO v_missing_vehicle_docs
  FROM required_docs rd
  LEFT JOIN present_docs pd ON pd.normalized_doc = rd.normalized_doc
  WHERE pd.normalized_doc IS NULL;

  IF coalesce(array_length(v_missing_driver_docs, 1), 0) > 0 THEN
    v_issues := array_append(v_issues, format('Missing approved driver compliance documents: %s.', array_to_string(v_missing_driver_docs, ', ')));
  END IF;

  IF coalesce(array_length(v_missing_vehicle_docs, 1), 0) > 0 THEN
    v_issues := array_append(v_issues, format('Missing approved vehicle compliance documents: %s.', array_to_string(v_missing_vehicle_docs, ', ')));
  END IF;

  RETURN v_issues;
END;
$function$;

REVOKE ALL ON FUNCTION public.company_compliance_issues(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_compliance_issues(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_compliance_issues(uuid, text) TO service_role;;
