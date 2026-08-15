-- Owner-approved canonical driver + vehicle readiness contract.
-- Shared by owner_driver and company_driver. Fail closed.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS vehicle_id uuid
    REFERENCES public.vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS jobs_vehicle_id_idx
  ON public.jobs (vehicle_id)
  WHERE vehicle_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.driver_operational_eligibility(p_driver_id uuid)
RETURNS TABLE (
  eligible boolean,
  vehicle_id uuid,
  blockers text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_driver public.drivers%ROWTYPE;
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
  v_vehicle_count integer := 0;
  v_vehicle_id uuid;
  v_vehicle_company_id uuid;
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
  IF v_driver.user_id IS NULL THEN
    v_blockers := array_append(v_blockers, 'driver_user_identity_missing');
  END IF;
  IF v_driver.company_id IS NULL THEN
    v_blockers := array_append(v_blockers, 'driver_company_context_missing');
  END IF;

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
     OR COALESCE(v_driver.driver_type, '') NOT IN ('owner_driver', 'company_driver')
  THEN
    v_blockers := array_append(v_blockers, 'verified_driver_identity_missing');
  END IF;

  SELECT oa.id, oa.status, oa.risk_status, oa.account_type, oa.company_id
  INTO v_onboarding_id, v_onboarding_status, v_onboarding_risk_status, v_onboarding_account_type, v_onboarding_company_id
  FROM public.onboarding_applications oa
  WHERE oa.user_id = v_driver.user_id
  ORDER BY oa.created_at DESC
  LIMIT 1;

  -- Owner Driver onboarding may begin before its company exists, but the
  -- canonical company-binding migration attaches that same application before
  -- activation. Operational eligibility therefore requires the approved row to
  -- be bound to the exact driver company for BOTH driver types.
  IF v_onboarding_id IS NULL
     OR COALESCE(v_onboarding_status, '') <> 'approved'
     OR COALESCE(v_onboarding_risk_status, '') <> 'clear'
     OR v_onboarding_company_id IS DISTINCT FROM v_driver.company_id
     OR (COALESCE(v_driver.driver_type, '') = 'owner_driver' AND COALESCE(v_onboarding_account_type, '') <> 'owner_driver')
     OR (COALESCE(v_driver.driver_type, '') = 'company_driver' AND COALESCE(v_onboarding_account_type, '') NOT IN ('individual_driver', 'company_driver'))
  THEN
    v_blockers := array_append(v_blockers, 'driver_onboarding_not_approved');
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.get_missing_onboarding_documents(v_onboarding_id)
    ) INTO v_missing_personal;

    IF COALESCE(v_missing_personal, true) THEN
      v_blockers := array_append(v_blockers, 'driver_personal_compliance_not_current');
    END IF;
  END IF;

  SELECT c.status::text INTO v_company_status
  FROM public.companies c
  WHERE c.id = v_driver.company_id;

  IF COALESCE(v_company_status, '') NOT IN ('active', 'approved') THEN
    v_blockers := array_append(v_blockers, 'driver_company_not_active');
  END IF;

  SELECT cm.status::text INTO v_membership_status
  FROM public.company_memberships cm
  WHERE cm.user_id = v_driver.user_id
    AND cm.company_id = v_driver.company_id
  LIMIT 1;

  IF COALESCE(v_membership_status, '') <> 'active' THEN
    v_blockers := array_append(v_blockers, 'driver_company_membership_not_active');
  END IF;

  SELECT COUNT(*) INTO v_vehicle_count
  FROM public.vehicles v
  WHERE v.assigned_driver_id = v_driver.id
    AND COALESCE(v.status::text, '') = 'active';

  IF v_vehicle_count = 0 THEN
    v_blockers := array_append(v_blockers, 'canonical_vehicle_missing');
  ELSIF v_vehicle_count > 1 THEN
    v_blockers := array_append(v_blockers, 'canonical_vehicle_ambiguous');
  ELSE
    SELECT v.id, v.company_id
    INTO v_vehicle_id, v_vehicle_company_id
    FROM public.vehicles v
    WHERE v.assigned_driver_id = v_driver.id
      AND COALESCE(v.status::text, '') = 'active'
    ORDER BY v.id
    LIMIT 1;

    IF v_vehicle_company_id IS DISTINCT FROM v_driver.company_id THEN
      v_blockers := array_append(v_blockers, 'canonical_vehicle_company_mismatch');
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.vehicle_documents vd
      WHERE vd.vehicle_id = v_vehicle_id
        AND vd.status::text = 'approved'
        AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
        AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
            IN ('mot', 'vehiclemot', 'goodsvehicletest')
    ) INTO v_has_mot;

    SELECT EXISTS (
      SELECT 1
      FROM public.vehicle_documents vd
      WHERE vd.vehicle_id = v_vehicle_id
        AND vd.status::text = 'approved'
        AND (vd.expiry_date IS NULL OR vd.expiry_date >= CURRENT_DATE)
        AND regexp_replace(lower(COALESCE(vd.doc_type, '')), '[^a-z0-9]+', '', 'g')
            IN ('insurance', 'vehicleinsurance', 'motorfleetinsurance', 'insurancecertificate')
    ) INTO v_has_insurance;

    IF NOT COALESCE(v_has_mot, false) THEN
      v_blockers := array_append(v_blockers, 'vehicle_document_missing_or_invalid:mot');
    END IF;
    IF NOT COALESCE(v_has_insurance, false) THEN
      v_blockers := array_append(v_blockers, 'vehicle_document_missing_or_invalid:insurance');
    END IF;
  END IF;

  RETURN QUERY SELECT
    COALESCE(array_length(v_blockers, 1), 0) = 0,
    CASE WHEN COALESCE(array_length(v_blockers, 1), 0) = 0 THEN v_vehicle_id ELSE NULL END,
    v_blockers;
END;
$$;

-- The resolver exposes readiness blockers and the canonical vehicle id. Keep it
-- behind authorised server/RPC boundaries rather than granting arbitrary
-- authenticated callers direct cross-driver introspection.
REVOKE ALL ON FUNCTION public.driver_operational_eligibility(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.driver_operational_eligibility(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.driver_operational_eligibility(uuid) TO service_role;

COMMENT ON FUNCTION public.driver_operational_eligibility(uuid) IS
  'Canonical fail-closed owner/company driver readiness: active account, current verified onboarding identity bound to the same company, active company membership, exactly one active assigned vehicle, current MOT and vehicle insurance. Direct execution is service-bound; authorised operational RPCs may compose it internally.';

NOTIFY pgrst, 'reload schema';
COMMIT;
