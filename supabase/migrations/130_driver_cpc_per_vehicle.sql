-- Driver CPC is a vehicle/use requirement, not a company-wide driver blocker.
-- Category B goods vehicles are normally limited to 3,500kg MAM; qualifying
-- zero-emission category B vehicles can be driven up to 4,250kg MAM.
BEGIN;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS is_zero_emission boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.vehicle_requires_driver_cpc(
  p_vehicle_type text,
  p_max_weight_kg numeric,
  p_zero_emission boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_max_weight_kg IS NOT NULL AND p_max_weight_kg > 0 THEN
      CASE
        WHEN COALESCE(p_zero_emission, false) AND p_max_weight_kg <= 4250 THEN false
        ELSE p_max_weight_kg > 3500
      END
    WHEN lower(COALESCE(p_vehicle_type, '')) IN (
      'bicycle','motorbike','car','van_small','van_large','swb_van','mwb_van',
      'lwb_van','xlwb_van','luton','luton_tail_lift','curtainside_van','truck_3_5t'
    ) THEN false    WHEN lower(COALESCE(p_vehicle_type, '')) IN (
      'truck_5t','truck_7_5t','truck_12t','truck_18t','truck_26t','artic',
      'artic_44t_curtainsider','artic_44t_box_trailer','artic_44t_flatbed',
      'artic_44t_refrigerated','artic_44t_double_deck'
    ) THEN true
    ELSE true
  END;
$$;

CREATE OR REPLACE FUNCTION public.xdrive_vehicle_rank(p_vehicle_type text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE lower(COALESCE(p_vehicle_type, ''))
    WHEN 'small_van' THEN 1 WHEN 'van_small' THEN 1
    WHEN 'swb_van' THEN 2 WHEN 'mwb_van' THEN 3
    WHEN 'lwb_van' THEN 4 WHEN 'xlwb_van' THEN 5 WHEN 'van_large' THEN 5
    WHEN 'luton' THEN 6 WHEN 'luton_tail_lift' THEN 6 WHEN 'curtainside_van' THEN 6
    WHEN 'truck_3_5t' THEN 7 WHEN 'truck_5t' THEN 8 WHEN 'truck_7_5t' THEN 9
    WHEN 'truck_12t' THEN 10 WHEN 'truck_18t' THEN 11 WHEN 'truck_26t' THEN 12
    WHEN 'artic' THEN 13 WHEN 'artic_44t_curtainsider' THEN 13
    WHEN 'artic_44t_box_trailer' THEN 13 WHEN 'artic_44t_flatbed' THEN 13
    WHEN 'artic_44t_refrigerated' THEN 13 WHEN 'artic_44t_double_deck' THEN 13
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.vehicle_can_cover_requested_type(
  p_actual_type text,
  p_requested_type text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN NULLIF(trim(COALESCE(p_requested_type, '')), '') IS NULL THEN true
    WHEN public.xdrive_vehicle_rank(p_actual_type) > 0
      AND public.xdrive_vehicle_rank(p_requested_type) > 0
      THEN public.xdrive_vehicle_rank(p_actual_type) >= public.xdrive_vehicle_rank(p_requested_type)
    ELSE lower(COALESCE(p_actual_type, '')) = lower(COALESCE(p_requested_type, ''))
  END;
$$;

CREATE OR REPLACE FUNCTION public.driver_has_valid_cpc(p_driver_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.driver_documents dd
    WHERE dd.driver_id = p_driver_id      AND regexp_replace(lower(COALESCE(dd.doc_type, '')), '[^a-z0-9]+', '', 'g') IN ('cpc','cpccard')
      AND lower(COALESCE(dd.status::text, '')) = 'approved'
      AND (dd.expiry_date IS NULL OR dd.expiry_date >= CURRENT_DATE)
  ) OR EXISTS (
    SELECT 1
    FROM public.driver_identity_documents did
    JOIN public.onboarding_applications oa ON oa.id = did.onboarding_application_id
    JOIN public.drivers d ON d.user_id = oa.user_id
    WHERE d.id = p_driver_id
      AND oa.company_id = d.company_id
      AND regexp_replace(lower(COALESCE(did.doc_type, '')), '[^a-z0-9]+', '', 'g') IN ('cpc','cpccard')
      AND lower(COALESCE(did.verification_status::text, '')) = 'verified'
      AND did.file_path IS NOT NULL
      AND (did.expiry_date IS NULL OR did.expiry_date >= CURRENT_DATE)
  );
$$;

-- Keep the generic company guard for company/vehicle compliance, but Driver CPC
-- is intentionally excluded here. CPC is checked against the quoted vehicle.
CREATE OR REPLACE FUNCTION public.company_compliance_issues(
  p_company_id uuid,
  p_context text DEFAULT NULL
)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text := COALESCE(auth.role(), '');
  v_issues text[] := ARRAY[]::text[];
  v_missing_driver_docs text[] := ARRAY[]::text[];
  v_missing_vehicle_docs text[] := ARRAY[]::text[];
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
         SELECT 1 FROM public.company_memberships cm
         WHERE cm.company_id = p_company_id
           AND cm.user_id = v_actor
           AND cm.status::text = 'active'
       ) THEN
      RAISE EXCEPTION 'Company compliance access denied.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF lower(COALESCE(p_context, '')) = 'publish' THEN
    RETURN v_issues;
  END IF;

  WITH required_docs AS (    SELECT unnest(ARRAY['drivinglicence','insurance']) AS normalized_doc
  ), present_docs AS (
    SELECT DISTINCT
      CASE regexp_replace(lower(COALESCE(dd.doc_type, '')), '[^a-z0-9]+', '', 'g')
        WHEN 'drivinglicense' THEN 'drivinglicence'
        WHEN 'drivinglicensecard' THEN 'drivinglicence'
        WHEN 'drivinglicencecard' THEN 'drivinglicence'
        WHEN 'insurancecertificate' THEN 'insurance'
        ELSE regexp_replace(lower(COALESCE(dd.doc_type, '')), '[^a-z0-9]+', '', 'g')
      END AS normalized_doc
    FROM public.driver_documents dd
    JOIN public.drivers d ON d.id = dd.driver_id
    WHERE d.company_id = p_company_id
      AND COALESCE(d.status::text, 'active') = 'active'
      AND lower(COALESCE(dd.status::text, '')) = 'approved'
      AND (dd.expiry_date IS NULL OR dd.expiry_date >= CURRENT_DATE)
    UNION
    SELECT DISTINCT
      CASE regexp_replace(lower(COALESCE(did.doc_type, '')), '[^a-z0-9]+', '', 'g')
        WHEN 'drivinglicense' THEN 'drivinglicence'
        ELSE regexp_replace(lower(COALESCE(did.doc_type, '')), '[^a-z0-9]+', '', 'g')
      END
    FROM public.driver_identity_documents did
    JOIN public.onboarding_applications oa ON oa.id = did.onboarding_application_id
    WHERE oa.company_id = p_company_id
      AND lower(COALESCE(did.verification_status::text, '')) = 'verified'
      AND (did.expiry_date IS NULL OR did.expiry_date >= CURRENT_DATE)  )
  SELECT COALESCE(array_agg(rd.normalized_doc), ARRAY[]::text[])
  INTO v_missing_driver_docs
  FROM required_docs rd
  LEFT JOIN present_docs pd ON pd.normalized_doc = rd.normalized_doc
  WHERE pd.normalized_doc IS NULL;

  WITH required_docs AS (
    SELECT unnest(ARRAY['mot','insurance']) AS normalized_doc
  ), present_docs AS (
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
      AND lower(COALESCE(vd.status::text, '')) = 'approved'
      AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
    UNION
    SELECT DISTINCT
      CASE regexp_replace(lower(COALESCE(cd.doc_type, '')), '[^a-z0-9]+', '', 'g')
        WHEN 'vehicleinsurance' THEN 'insurance'
        WHEN 'motorfleetinsurance' THEN 'insurance'
        WHEN 'insurancecertificate' THEN 'insurance'
        WHEN 'goodsvehicletest' THEN 'mot'
        ELSE regexp_replace(lower(COALESCE(cd.doc_type, '')), '[^a-z0-9]+', '', 'g')
      END
    FROM public.company_documents cd
    WHERE cd.company_id = p_company_id
      AND lower(COALESCE(cd.status::text, '')) = 'approved'
      AND (cd.expiry_date IS NULL OR cd.expiry_date >= CURRENT_DATE)
  )
  SELECT COALESCE(array_agg(rd.normalized_doc), ARRAY[]::text[])
  INTO v_missing_vehicle_docs
  FROM required_docs rd
  LEFT JOIN present_docs pd ON pd.normalized_doc = rd.normalized_doc
  WHERE pd.normalized_doc IS NULL;

  IF COALESCE(array_length(v_missing_driver_docs, 1), 0) > 0 THEN
    v_issues := array_append(v_issues, format(
      'Missing approved driver compliance documents: %s.',
      array_to_string(v_missing_driver_docs, ', ')
    ));
  END IF;

  IF COALESCE(array_length(v_missing_vehicle_docs, 1), 0) > 0 THEN
    v_issues := array_append(v_issues, format(
      'Missing approved vehicle compliance documents: %s.',
      array_to_string(v_missing_vehicle_docs, ', ')
    ));
  END IF;

  RETURN v_issues;
END;
$$;

REVOKE ALL ON FUNCTION public.company_compliance_issues(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.company_compliance_issues(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_compliance_issues(uuid, text) TO service_role;

-- Onboarding only requires CPC when the vehicle recorded in that application
-- actually falls into a CPC-requiring licence/MAM class.
CREATE OR REPLACE FUNCTION public.get_missing_onboarding_documents(p_application_id uuid)
RETURNS TABLE(document_family text, doc_type text, reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH app AS (
    SELECT id, account_type, COALESCE(payload, '{}'::jsonb) AS payload
    FROM public.onboarding_applications
    WHERE id = p_application_id
  ), base_requirements AS (
    SELECT r.document_family, r.doc_type, app.account_type
    FROM public.compliance_document_requirements r
    JOIN app ON app.account_type = r.account_type
    WHERE r.active = true AND r.required = true
  ), dynamic_cpc AS (
    SELECT 'identity'::text AS document_family, 'cpc'::text AS doc_type, app.account_type
    FROM app
    WHERE app.account_type = 'owner_driver'
      AND (app.payload ? 'vehicle_type' OR app.payload ? 'max_weight_kg')
      AND public.vehicle_requires_driver_cpc(
        app.payload->>'vehicle_type',
        CASE
          WHEN COALESCE(app.payload->>'max_weight_kg', '') ~ '^[0-9]+([.][0-9]+)?$'
            THEN (app.payload->>'max_weight_kg')::numeric
          ELSE NULL
        END,
        lower(COALESCE(app.payload->>'is_zero_emission', 'false')) IN ('true','1','yes')
      )
  ), requirements AS (
    SELECT * FROM base_requirements
    UNION
    SELECT * FROM dynamic_cpc
  )
  SELECT requirement.document_family, requirement.doc_type,
    CASE WHEN requirement.document_family = 'company'
      THEN 'Missing, unapproved or expired company document.'
      ELSE 'Missing, unverified or expired identity document.'
    END AS reason
  FROM requirements requirement
  WHERE NOT (
    CASE
      WHEN requirement.document_family = 'company' THEN EXISTS (
        SELECT 1 FROM public.company_documents document
        WHERE document.onboarding_application_id = p_application_id
          AND document.doc_type = requirement.doc_type
          AND document.status = 'approved'
          AND document.file_path IS NOT NULL
          AND (document.expiry_date IS NULL OR document.expiry_date >= CURRENT_DATE)
      )
      WHEN requirement.document_family = 'identity' THEN EXISTS (
        SELECT 1 FROM public.driver_identity_documents document
        WHERE document.onboarding_application_id = p_application_id
          AND document.doc_type = requirement.doc_type
          AND document.verification_status = 'verified'
          AND document.file_path IS NOT NULL
          AND (document.expiry_date IS NULL OR document.expiry_date >= CURRENT_DATE)
      ) OR (
        requirement.account_type = 'owner_driver'
        AND requirement.doc_type = 'proof_of_address'
        AND EXISTS (
          SELECT 1 FROM public.driver_identity_documents licence
          WHERE licence.onboarding_application_id = p_application_id
            AND licence.doc_type = 'driving_licence'            AND licence.verification_status = 'verified'
            AND licence.file_path IS NOT NULL
            AND (licence.expiry_date IS NULL OR licence.expiry_date >= CURRENT_DATE)
        )
      )
      ELSE false
    END
  );
$$;

-- Generic readiness no longer fails merely because a driver has multiple active
-- vehicles. It selects the lightest compliant default; job-specific checks use
-- the quote_vehicle_id chosen for that job.
CREATE OR REPLACE FUNCTION public.driver_operational_eligibility(p_driver_id uuid)
RETURNS TABLE(eligible boolean, vehicle_id uuid, blockers text[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_identity_mode text;
  v_identity_status text;
  v_identity_verified_at timestamptz;
  v_identity_company_id uuid;
  v_onboarding_id uuid;
  v_onboarding_status text;
  v_onboarding_risk_status text;
  v_onboarding_account_type text;
  v_onboarding_company_id uuid;
  v_company_status text;
  v_membership_status text;
  v_missing_personal boolean := true;
  v_has_mot boolean := false;
  v_has_insurance boolean := false;
  v_blockers text[] := ARRAY[]::text[];
BEGIN
  SELECT d.* INTO v_driver
  FROM public.drivers d
  WHERE d.id = p_driver_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, ARRAY['driver_not_found']::text[];
    RETURN;
  END IF;

  IF COALESCE(v_driver.status::text, '') <> 'active'
     OR COALESCE(v_driver.is_active, false) <> true THEN
    v_blockers := array_append(v_blockers, 'driver_account_not_active');
  END IF;
  IF COALESCE(v_driver.app_access, false) <> true THEN
    v_blockers := array_append(v_blockers, 'driver_app_access_disabled');
  END IF;
  IF COALESCE(v_driver.can_commercial_bid, false) <> true THEN
    v_blockers := array_append(v_blockers, 'commercial_bidding_not_permitted');
  END IF;
  IF v_driver.user_id IS NULL THEN v_blockers := array_append(v_blockers, 'driver_user_identity_missing'); END IF;
  IF v_driver.company_id IS NULL THEN v_blockers := array_append(v_blockers, 'driver_company_context_missing'); END IF;
  SELECT pir.identity_mode, pir.status, pir.verified_at, pir.company_id
  INTO v_identity_mode, v_identity_status, v_identity_verified_at, v_identity_company_id
  FROM public.platform_identity_registry pir
  WHERE pir.user_id = v_driver.user_id
  LIMIT 1;

  IF NOT FOUND
     OR COALESCE(v_identity_status, '') <> 'active'
     OR v_identity_verified_at IS NULL
     OR v_identity_company_id IS DISTINCT FROM v_driver.company_id
     OR (COALESCE(v_driver.driver_type, '') = 'owner_driver' AND COALESCE(v_identity_mode, '') <> 'owner_driver')
     OR (COALESCE(v_driver.driver_type, '') = 'company_driver' AND COALESCE(v_identity_mode, '') <> 'company_driver')
     OR COALESCE(v_driver.driver_type, '') NOT IN ('owner_driver','company_driver')
  THEN
    v_blockers := array_append(v_blockers, 'verified_driver_identity_missing');
  END IF;

  SELECT oa.id, oa.status, oa.risk_status, oa.account_type, oa.company_id
  INTO v_onboarding_id, v_onboarding_status, v_onboarding_risk_status, v_onboarding_account_type, v_onboarding_company_id
  FROM public.onboarding_applications oa
  WHERE oa.user_id = v_driver.user_id
    AND oa.company_id = v_driver.company_id
  ORDER BY oa.created_at DESC
  LIMIT 1;

  IF v_onboarding_id IS NULL
     OR COALESCE(v_onboarding_status, '') <> 'approved'
     OR COALESCE(v_onboarding_risk_status, '') <> 'clear'     OR v_onboarding_company_id IS DISTINCT FROM v_driver.company_id
     OR (COALESCE(v_driver.driver_type, '') = 'owner_driver' AND COALESCE(v_onboarding_account_type, '') <> 'owner_driver')
     OR (COALESCE(v_driver.driver_type, '') = 'company_driver' AND COALESCE(v_onboarding_account_type, '') NOT IN ('individual_driver','company_driver'))
  THEN
    v_blockers := array_append(v_blockers, 'driver_onboarding_not_approved');
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.get_missing_onboarding_documents(v_onboarding_id)
    ) INTO v_missing_personal;
    IF COALESCE(v_missing_personal, true) THEN
      v_blockers := array_append(v_blockers, 'driver_personal_compliance_not_current');
    END IF;
  END IF;

  SELECT c.status::text INTO v_company_status
  FROM public.companies c WHERE c.id = v_driver.company_id;
  IF COALESCE(v_company_status, '') NOT IN ('active','approved') THEN
    v_blockers := array_append(v_blockers, 'driver_company_not_active');
  END IF;

  SELECT cm.status::text INTO v_membership_status
  FROM public.company_memberships cm
  WHERE cm.user_id = v_driver.user_id AND cm.company_id = v_driver.company_id
  LIMIT 1;
  IF COALESCE(v_membership_status, '') <> 'active' THEN
    v_blockers := array_append(v_blockers, 'driver_company_membership_not_active');
  END IF;

  SELECT v.* INTO v_vehicle  FROM public.vehicles v
  WHERE v.assigned_driver_id = v_driver.id
    AND COALESCE(v.status::text, '') = 'active'
  ORDER BY
    public.vehicle_requires_driver_cpc(v.type, v.max_weight_kg, COALESCE(v.is_zero_emission, false)) ASC,
    public.xdrive_vehicle_rank(v.type) ASC,
    v.id
  LIMIT 1;

  IF NOT FOUND THEN
    v_blockers := array_append(v_blockers, 'canonical_vehicle_missing');
  ELSE
    IF v_vehicle.company_id IS DISTINCT FROM v_driver.company_id THEN
      v_blockers := array_append(v_blockers, 'canonical_vehicle_company_mismatch');
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.vehicle_documents vd
      WHERE vd.vehicle_id = v_vehicle.id
        AND lower(COALESCE(vd.status::text, '')) = 'approved'
        AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
        AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
            IN ('mot','vehiclemot','goodsvehicletest')
    ) INTO v_has_mot;

    SELECT EXISTS (
      SELECT 1 FROM public.vehicle_documents vd
      WHERE vd.vehicle_id = v_vehicle.id
        AND lower(COALESCE(vd.status::text, '')) = 'approved'        AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
        AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
            IN ('insurance','vehicleinsurance','motorfleetinsurance','insurancecertificate')
    ) INTO v_has_insurance;

    IF NOT COALESCE(v_has_mot, false) THEN
      v_blockers := array_append(v_blockers, 'vehicle_document_missing_or_invalid:mot');
    END IF;
    IF NOT COALESCE(v_has_insurance, false) THEN
      v_blockers := array_append(v_blockers, 'vehicle_document_missing_or_invalid:insurance');
    END IF;
    IF public.vehicle_requires_driver_cpc(
      v_vehicle.type,
      v_vehicle.max_weight_kg,
      COALESCE(v_vehicle.is_zero_emission, false)
    ) AND NOT public.driver_has_valid_cpc(v_driver.id) THEN
      v_blockers := array_append(v_blockers, 'driver_document_missing_or_invalid:cpccard');
    END IF;
  END IF;

  RETURN QUERY SELECT
    COALESCE(array_length(v_blockers, 1), 0) = 0,
    CASE WHEN COALESCE(array_length(v_blockers, 1), 0) = 0 THEN v_vehicle.id ELSE NULL END,
    v_blockers;
END;
$$;

-- Enforce the documents and CPC of the exact vehicle captured on the quote.
CREATE OR REPLACE FUNCTION public.fn_guard_quote_vehicle_compliance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vehicle public.vehicles%ROWTYPE;
  v_requested_type text;
  v_has_mot boolean := false;
  v_has_insurance boolean := false;
BEGIN
  IF NEW.bidder_driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.quote_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'A specific active vehicle is required for a driver quote.' USING ERRCODE = '23514';
  END IF;

  SELECT v.* INTO v_vehicle
  FROM public.vehicles v
  WHERE v.id = NEW.quote_vehicle_id
    AND v.assigned_driver_id = NEW.bidder_driver_id
    AND COALESCE(v.status::text, '') = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The quoted vehicle is not active or is not assigned to this driver.' USING ERRCODE = '42501';
  END IF;

  IF NEW.company_id IS NOT NULL AND v_vehicle.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'The quoted vehicle does not belong to the bidding company.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(NULLIF(j.requested_vehicle_type, ''), NULLIF(j.vehicle_type::text, ''))
  INTO v_requested_type
  FROM public.jobs j
  WHERE j.id = NEW.job_id;

  IF v_requested_type IS NOT NULL
     AND NOT public.vehicle_can_cover_requested_type(v_vehicle.type, v_requested_type) THEN
    RAISE EXCEPTION 'The quoted vehicle is not compatible with this job.' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.vehicle_documents vd
    WHERE vd.vehicle_id = v_vehicle.id
      AND lower(COALESCE(vd.status::text, '')) = 'approved'
      AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
      AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
          IN ('mot','vehiclemot','goodsvehicletest')
  ) INTO v_has_mot;

  SELECT EXISTS (
    SELECT 1 FROM public.vehicle_documents vd
    WHERE vd.vehicle_id = v_vehicle.id
      AND lower(COALESCE(vd.status::text, '')) = 'approved'
      AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
      AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
          IN ('insurance','vehicleinsurance','motorfleetinsurance','insurancecertificate')
  ) INTO v_has_insurance;

  IF NOT v_has_mot OR NOT v_has_insurance THEN
    RAISE EXCEPTION 'The quoted vehicle must have current MOT and insurance.' USING ERRCODE = '42501';
  END IF;

  IF public.vehicle_requires_driver_cpc(
    v_vehicle.type,
    v_vehicle.max_weight_kg,
    COALESCE(v_vehicle.is_zero_emission, false)
  ) AND NOT public.driver_has_valid_cpc(NEW.bidder_driver_id) THEN
    RAISE EXCEPTION 'Driver CPC is required for the selected vehicle.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_quote_vehicle_compliance ON public.job_bids;
CREATE TRIGGER trg_guard_quote_vehicle_compliance
BEFORE INSERT ON public.job_bids
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_quote_vehicle_compliance();

-- Preserve the existing award authority boundary, but validate and retain the
-- exact vehicle recorded on the bid instead of allocating an arbitrary default.
CREATE OR REPLACE FUNCTION public.accept_job_bid_atomic(
  p_bid_id uuid,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), p_actor_user_id);
  v_owner_company_id uuid;
  v_quote_vehicle_id uuid;
  v_bidder_driver_id uuid;
  v_job_id uuid;
  v_requested_type text;
  v_vehicle public.vehicles%ROWTYPE;
  v_quote_has_mot boolean := false;
  v_quote_has_insurance boolean := false;
  v_result jsonb;
BEGIN
  IF p_bid_id IS NULL OR v_actor IS NULL THEN
    RETURN public.accept_job_bid_atomic_award_authority_base_v1(p_bid_id, p_actor_user_id);
  END IF;

  SELECT j.company_id, jb.quote_vehicle_id, jb.bidder_driver_id, jb.job_id,
         COALESCE(NULLIF(j.requested_vehicle_type, ''), NULLIF(j.vehicle_type::text, ''))
  INTO v_owner_company_id, v_quote_vehicle_id, v_bidder_driver_id, v_job_id, v_requested_type
  FROM public.job_bids jb
  JOIN public.jobs j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id;

  IF NOT FOUND THEN
    RETURN public.accept_job_bid_atomic_award_authority_base_v1(p_bid_id, p_actor_user_id);
  END IF;

  PERFORM 1
  FROM public.company_memberships cm
  JOIN public.companies c ON c.id = cm.company_id
  WHERE cm.company_id = v_owner_company_id
    AND cm.user_id = v_actor
    AND COALESCE(cm.status::text, '') = 'active'
    AND COALESCE(cm.role_in_company::text, '') IN ('owner','admin','dispatcher')
    AND COALESCE(c.status::text, '') = 'active'
  FOR SHARE OF cm, c;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'http_status', 403,
      'error_code', 'FORBIDDEN',
      'error_message', 'The job-owning company must be active and the actor must hold an active owner, admin or dispatcher membership.'
    );
  END IF;

  IF v_bidder_driver_id IS NOT NULL THEN
    IF v_quote_vehicle_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'http_status', 409,
        'error_code', 'QUOTE_VEHICLE_MISSING',
        'error_message', 'The driver quote does not identify the vehicle used for this job.'
      );
    END IF;

    SELECT v.* INTO v_vehicle
    FROM public.vehicles v
    WHERE v.id = v_quote_vehicle_id
      AND v.assigned_driver_id = v_bidder_driver_id
      AND COALESCE(v.status::text, '') = 'active';
    IF NOT FOUND OR NOT public.vehicle_can_cover_requested_type(v_vehicle.type, v_requested_type) THEN
      RETURN jsonb_build_object(
        'success', false,
        'http_status', 409,
        'error_code', 'QUOTE_VEHICLE_INVALID',
        'error_message', 'The quoted vehicle is no longer active or compatible with this job.'
      );
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.vehicle_documents vd
      WHERE vd.vehicle_id = v_quote_vehicle_id
        AND lower(COALESCE(vd.status::text, '')) = 'approved'
        AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
        AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
            IN ('mot','vehiclemot','goodsvehicletest')
    ) INTO v_quote_has_mot;

    SELECT EXISTS (
      SELECT 1 FROM public.vehicle_documents vd
      WHERE vd.vehicle_id = v_quote_vehicle_id
        AND lower(COALESCE(vd.status::text, '')) = 'approved'
        AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
        AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
            IN ('insurance','vehicleinsurance','motorfleetinsurance','insurancecertificate')
    ) INTO v_quote_has_insurance;

    IF NOT v_quote_has_mot OR NOT v_quote_has_insurance THEN
      RETURN jsonb_build_object(
        'success', false,
        'http_status', 409,
        'error_code', 'QUOTE_VEHICLE_COMPLIANCE_INVALID',
        'error_message', 'The vehicle quoted for this job must have current MOT and insurance.'
      );
    END IF;

    IF public.vehicle_requires_driver_cpc(
      v_vehicle.type,
      v_vehicle.max_weight_kg,
      COALESCE(v_vehicle.is_zero_emission, false)
    ) AND NOT public.driver_has_valid_cpc(v_bidder_driver_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'http_status', 409,
        'error_code', 'DRIVER_CPC_REQUIRED',
        'error_message', 'Driver CPC is required for the vehicle quoted for this job.'
      );
    END IF;
  END IF;

  v_result := public.accept_job_bid_atomic_award_authority_base_v1(p_bid_id, p_actor_user_id);

  IF COALESCE((v_result->>'success')::boolean, false)
     AND v_quote_vehicle_id IS NOT NULL
     AND v_bidder_driver_id IS NOT NULL THEN
    UPDATE public.jobs j
    SET vehicle_id = v_quote_vehicle_id,
        status_history = (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN entry->>'status' = 'allocated'
                AND entry->>'auto_assigned_driver_id' = v_bidder_driver_id::text
              THEN jsonb_set(entry, '{auto_assigned_vehicle_id}', to_jsonb(v_quote_vehicle_id), true)
              ELSE entry
            END
          ), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(j.status_history, '[]'::jsonb)) entry
        ),
        updated_at = now()
    WHERE j.id = v_job_id
      AND j.assigned_driver_id = v_bidder_driver_id;

    UPDATE public.job_tracking_events event
    SET meta = jsonb_set(COALESCE(event.meta, '{}'::jsonb), '{vehicle_id}', to_jsonb(v_quote_vehicle_id), true)
    WHERE event.id = (
      SELECT latest.id
      FROM public.job_tracking_events latest
      WHERE latest.job_id = v_job_id
        AND latest.event_type = 'allocated'
      ORDER BY latest.created_at DESC, latest.id DESC
      LIMIT 1
    );

    v_result := jsonb_set(v_result, '{vehicle_id}', to_jsonb(v_quote_vehicle_id), true);
  END IF;

  RETURN v_result;
END;
$$;

COMMIT;
