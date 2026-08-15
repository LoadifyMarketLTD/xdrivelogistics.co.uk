-- Canonical driver + vehicle eligibility and named-driver award semantics.
--
-- Owner-approved PR #357 product contract:
--   * owner_driver and company_driver use the same operational readiness gate;
--   * a driver-originated quote requires verified/current personal compliance,
--     an active account, commercial bid permission, one active assigned vehicle,
--     and current MOT + vehicle insurance evidence;
--   * accepting a named-driver bid auto-allocates that SAME driver + vehicle;
--   * accepting a company-level bid without a named driver stops at AWARDED;
--   * no fallback to an arbitrary/first driver in the winning company.
--
-- This migration is intentionally narrow. It does not change unrelated job
-- lifecycle/POD/finance permissions. jobs.vehicle_id is added because the live
-- schema has no authoritative job-level vehicle FK while the approved contract
-- requires persistent driver+vehicle allocation.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- -----------------------------------------------------------------------------
-- 1. Persist the execution vehicle on the job.
-- -----------------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS vehicle_id uuid
    REFERENCES public.vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS jobs_vehicle_id_idx
  ON public.jobs (vehicle_id)
  WHERE vehicle_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. One fail-closed readiness resolver for owner_driver + company_driver.
-- -----------------------------------------------------------------------------
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
  SELECT d.*
  INTO v_driver
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

  SELECT
    pir.identity_mode,
    pir.status,
    pir.verified_at,
    pir.company_id
  INTO
    v_identity_mode,
    v_identity_status,
    v_identity_verified_at,
    v_identity_company_id
  FROM public.platform_identity_registry pir
  WHERE pir.user_id = v_driver.user_id
  LIMIT 1;

  IF NOT FOUND
     OR COALESCE(v_identity_status, '') <> 'active'
     OR v_identity_verified_at IS NULL
     OR v_identity_company_id IS DISTINCT FROM v_driver.company_id
     OR (
       COALESCE(v_driver.driver_type, '') = 'owner_driver'
       AND COALESCE(v_identity_mode, '') <> 'owner_driver'
     )
     OR (
       COALESCE(v_driver.driver_type, '') = 'company_driver'
       AND COALESCE(v_identity_mode, '') <> 'company_driver'
     )
     OR COALESCE(v_driver.driver_type, '') NOT IN ('owner_driver', 'company_driver')
  THEN
    v_blockers := array_append(v_blockers, 'verified_driver_identity_missing');
  END IF;

  SELECT
    oa.id,
    oa.status,
    oa.risk_status,
    oa.account_type,
    oa.company_id
  INTO
    v_onboarding_id,
    v_onboarding_status,
    v_onboarding_risk_status,
    v_onboarding_account_type,
    v_onboarding_company_id
  FROM public.onboarding_applications oa
  WHERE oa.user_id = v_driver.user_id
    AND (
      oa.company_id = v_driver.company_id
      OR (
        oa.company_id IS NULL
        AND COALESCE(v_driver.driver_type, '') = 'owner_driver'
      )
    )
  ORDER BY oa.created_at DESC
  LIMIT 1;

  IF v_onboarding_id IS NULL
     OR COALESCE(v_onboarding_status, '') <> 'approved'
     OR COALESCE(v_onboarding_risk_status, '') <> 'clear'
     OR (
       COALESCE(v_driver.driver_type, '') = 'owner_driver'
       AND COALESCE(v_onboarding_account_type, '') <> 'owner_driver'
     )
     OR (
       COALESCE(v_driver.driver_type, '') = 'company_driver'
       AND COALESCE(v_onboarding_account_type, '') NOT IN ('individual_driver', 'company_driver')
     )
  THEN
    v_blockers := array_append(v_blockers, 'driver_onboarding_not_approved');
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.get_missing_onboarding_documents(v_onboarding_id)
    )
    INTO v_missing_personal;

    IF COALESCE(v_missing_personal, true) THEN
      v_blockers := array_append(v_blockers, 'driver_personal_compliance_not_current');
    END IF;
  END IF;

  SELECT c.status::text
  INTO v_company_status
  FROM public.companies c
  WHERE c.id = v_driver.company_id;

  IF COALESCE(v_company_status, '') NOT IN ('active', 'approved') THEN
    v_blockers := array_append(v_blockers, 'driver_company_not_active');
  END IF;

  SELECT cm.status::text
  INTO v_membership_status
  FROM public.company_memberships cm
  WHERE cm.user_id = v_driver.user_id
    AND cm.company_id = v_driver.company_id
  LIMIT 1;

  IF COALESCE(v_membership_status, '') <> 'active' THEN
    v_blockers := array_append(v_blockers, 'driver_company_membership_not_active');
  END IF;

  SELECT COUNT(*), MIN(v.id)
  INTO v_vehicle_count, v_vehicle_id
  FROM public.vehicles v
  WHERE v.assigned_driver_id = v_driver.id
    AND COALESCE(v.status::text, '') = 'active';

  IF v_vehicle_count = 0 THEN
    v_blockers := array_append(v_blockers, 'canonical_vehicle_missing');
    v_vehicle_id := NULL;
  ELSIF v_vehicle_count > 1 THEN
    v_blockers := array_append(v_blockers, 'canonical_vehicle_ambiguous');
    v_vehicle_id := NULL;
  END IF;

  IF v_vehicle_id IS NOT NULL THEN
    SELECT v.company_id
    INTO v_vehicle_company_id
    FROM public.vehicles v
    WHERE v.id = v_vehicle_id;

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

  RETURN QUERY
    SELECT
      COALESCE(array_length(v_blockers, 1), 0) = 0,
      v_vehicle_id,
      v_blockers;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_operational_eligibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_operational_eligibility(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_operational_eligibility(uuid) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Driver-originated direct inserts cannot bypass readiness.
--    Preserve the existing distinct company-level bid path when no driver is
--    named; that path still requires active company membership.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;
CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND (
      (
        bidder_driver_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.drivers d
          CROSS JOIN LATERAL public.driver_operational_eligibility(d.id) readiness
          WHERE d.id = job_bids.bidder_driver_id
            AND d.user_id = auth.uid()
            AND job_bids.company_id IS NOT DISTINCT FROM d.company_id
            AND readiness.eligible = true
        )
      )
      OR (
        bidder_driver_id IS NULL
        AND job_bids.company_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.company_memberships cm
          WHERE cm.company_id = job_bids.company_id
            AND cm.user_id = auth.uid()
            AND COALESCE(cm.status::text, '') = 'active'
        )
      )
    )
    AND public.can_quote_marketplace_job(job_bids.job_id, job_bids.company_id)
  );

-- -----------------------------------------------------------------------------
-- 4. Canonical award: named driver => same driver + vehicle allocation;
--    company-only bid => awarded/unallocated.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.accept_job_bid_atomic(uuid, uuid);

CREATE FUNCTION public.accept_job_bid_atomic(
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
  v_job_id uuid;
  v_owner_company_id uuid;
  v_job_created_by uuid;
  v_job_status text;
  v_exchange_visibility text;
  v_existing_awarded_company uuid;
  v_bid_status text;
  v_bidder_company_id uuid;
  v_bidder_user_id uuid;
  v_bidder_driver_id uuid;
  v_bid_price_gbp numeric(12,2);
  v_bid_currency text;
  v_driver_company_id uuid;
  v_driver_user_id uuid;
  v_driver_type text;
  v_driver_vehicle_id uuid;
  v_driver_eligible boolean := false;
  v_driver_blockers text[] := ARRAY[]::text[];
  v_owner_driver_count integer := 0;
  v_owner_driver_id uuid;
  v_company_issues text[] := ARRAY[]::text[];
  v_agreement_id uuid;
  v_final_status text;
BEGIN
  IF p_bid_id IS NULL THEN
    RAISE EXCEPTION 'p_bid_id is required';
  END IF;
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT
    jb.job_id,
    j.company_id,
    j.created_by,
    j.status,
    j.exchange_visibility,
    j.awarded_carrier_company_id,
    jb.status,
    jb.company_id,
    jb.bidder_user_id,
    jb.bidder_driver_id,
    COALESCE(jb.bid_price_gbp, jb.amount)::numeric(12,2),
    COALESCE(jb.currency, j.currency, 'GBP')
  INTO
    v_job_id,
    v_owner_company_id,
    v_job_created_by,
    v_job_status,
    v_exchange_visibility,
    v_existing_awarded_company,
    v_bid_status,
    v_bidder_company_id,
    v_bidder_user_id,
    v_bidder_driver_id,
    v_bid_price_gbp,
    v_bid_currency
  FROM public.job_bids jb
  JOIN public.jobs j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id
  FOR UPDATE OF jb, j;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'http_status', 404, 'error_code', 'NOT_FOUND', 'error_message', 'Bid not found.');
  END IF;

  IF v_actor IS DISTINCT FROM v_job_created_by
     AND NOT EXISTS (
       SELECT 1
       FROM public.company_memberships cm
       WHERE cm.company_id = v_owner_company_id
         AND cm.user_id = v_actor
         AND COALESCE(cm.status::text, '') = 'active'
         AND COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin', 'dispatcher')
     )
  THEN
    RETURN jsonb_build_object('success', false, 'http_status', 403, 'error_code', 'FORBIDDEN', 'error_message', 'Not authorized to accept bids for this job.');
  END IF;

  IF COALESCE(v_exchange_visibility, '') NOT IN ('exchange', 'direct') THEN
    RETURN jsonb_build_object('success', false, 'http_status', 400, 'error_code', 'BAD_REQUEST', 'error_message', 'This job is not on the Marketplace.');
  END IF;
  IF COALESCE(v_job_status, '') NOT IN ('posted', 'quoted') THEN
    RETURN jsonb_build_object('success', false, 'http_status', 409, 'error_code', 'CONFLICT', 'error_message', 'Job is no longer awardable.');
  END IF;
  IF COALESCE(v_bid_status, '') <> 'submitted' THEN
    RETURN jsonb_build_object('success', false, 'http_status', 409, 'error_code', 'CONFLICT', 'error_message', 'Only submitted bids can be accepted.');
  END IF;
  IF v_existing_awarded_company IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'http_status', 409, 'error_code', 'CONFLICT', 'error_message', 'This job has already been awarded.');
  END IF;
  IF v_bid_price_gbp IS NULL OR v_bid_price_gbp <= 0 THEN
    RETURN jsonb_build_object('success', false, 'http_status', 409, 'error_code', 'INVALID_BID', 'error_message', 'Bid has no valid positive price.');
  END IF;

  -- Legacy owner-driver bids may pre-date bidder_driver_id. Resolve only a
  -- unique owner_driver for the same bidder user. Never select an arbitrary
  -- company driver for a company-level bid.
  IF v_bidder_driver_id IS NULL AND v_bidder_company_id IS NULL AND v_bidder_user_id IS NOT NULL THEN
    SELECT COUNT(*), MIN(d.id)
    INTO v_owner_driver_count, v_owner_driver_id
    FROM public.drivers d
    WHERE d.user_id = v_bidder_user_id
      AND COALESCE(d.driver_type, '') = 'owner_driver';

    IF v_owner_driver_count = 1 THEN
      v_bidder_driver_id := v_owner_driver_id;
    END IF;
  END IF;

  IF v_bidder_driver_id IS NOT NULL THEN
    SELECT d.company_id, d.user_id, d.driver_type
    INTO v_driver_company_id, v_driver_user_id, v_driver_type
    FROM public.drivers d
    WHERE d.id = v_bidder_driver_id;

    IF NOT FOUND OR v_driver_user_id IS DISTINCT FROM v_bidder_user_id THEN
      RETURN jsonb_build_object('success', false, 'http_status', 409, 'error_code', 'DRIVER_IDENTITY_MISMATCH', 'error_message', 'Accepted bid driver identity is invalid.');
    END IF;

    IF v_bidder_company_id IS NULL THEN
      v_bidder_company_id := v_driver_company_id;
    ELSIF v_bidder_company_id IS DISTINCT FROM v_driver_company_id THEN
      RETURN jsonb_build_object('success', false, 'http_status', 409, 'error_code', 'DRIVER_COMPANY_MISMATCH', 'error_message', 'Accepted bid driver does not belong to the bidding company.');
    END IF;

    SELECT readiness.eligible, readiness.vehicle_id, readiness.blockers
    INTO v_driver_eligible, v_driver_vehicle_id, v_driver_blockers
    FROM public.driver_operational_eligibility(v_bidder_driver_id) readiness;

    IF NOT COALESCE(v_driver_eligible, false) THEN
      RETURN jsonb_build_object(
        'success', false,
        'http_status', 409,
        'error_code', 'DRIVER_NOT_OPERATIONALLY_ELIGIBLE',
        'error_message', 'The named bidder driver or vehicle is no longer operationally eligible.',
        'blockers', to_jsonb(COALESCE(v_driver_blockers, ARRAY[]::text[]))
      );
    END IF;
  END IF;

  IF v_bidder_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'http_status', 409, 'error_code', 'SUPPLIER_MISSING', 'error_message', 'Bidder has no canonical supplier company.');
  END IF;

  IF v_bidder_company_id = v_owner_company_id THEN
    RETURN jsonb_build_object('success', false, 'http_status', 403, 'error_code', 'OWN_JOB', 'error_message', 'Cannot accept a bid placed by the job-owning company.');
  END IF;

  -- Preserve existing company-level compliance gate as an additional supplier
  -- check. Named-driver readiness above is stricter for personal/vehicle truth.
  v_company_issues := public.company_compliance_issues(v_bidder_company_id, 'award');
  IF COALESCE(array_length(v_company_issues, 1), 0) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'http_status', 409,
      'error_code', 'COMPLIANCE_BLOCKED',
      'error_message', format('Compliance blocked award action: %s', array_to_string(v_company_issues, ' '))
    );
  END IF;

  UPDATE public.job_bids jb
  SET status = CASE WHEN jb.id = p_bid_id THEN 'accepted' ELSE 'rejected' END,
      updated_at = now()
  WHERE jb.job_id = v_job_id
    AND jb.status IN ('submitted', 'accepted');

  v_final_status := CASE WHEN v_bidder_driver_id IS NOT NULL THEN 'allocated' ELSE 'awarded' END;

  UPDATE public.jobs j
  SET
    accepted_bid_id = p_bid_id,
    awarded_carrier_company_id = v_bidder_company_id,
    assigned_company_id = v_bidder_company_id,
    assigned_driver_id = CASE WHEN v_bidder_driver_id IS NOT NULL THEN v_bidder_driver_id ELSE NULL END,
    vehicle_id = CASE WHEN v_bidder_driver_id IS NOT NULL THEN v_driver_vehicle_id ELSE NULL END,
    status = v_final_status,
    current_status = v_final_status,
    status_history = COALESCE(j.status_history, '[]'::jsonb)
      || jsonb_build_object(
        'status', 'awarded',
        'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'bid_id', p_bid_id,
        'awarded_by', v_actor,
        'awarded_carrier_company_id', v_bidder_company_id
      )
      || CASE
           WHEN v_bidder_driver_id IS NOT NULL THEN jsonb_build_object(
             'status', 'allocated',
             'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
             'auto_assigned_driver_id', v_bidder_driver_id,
             'auto_assigned_vehicle_id', v_driver_vehicle_id
           )
           ELSE '[]'::jsonb
         END,
    updated_at = now()
  WHERE j.id = v_job_id
    AND j.awarded_carrier_company_id IS NULL
    AND j.status IN ('posted', 'quoted');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atomic award update failed for job %', v_job_id;
  END IF;

  INSERT INTO public.job_tracking_events
    (job_id, event_type, created_by, message, meta)
  VALUES (
    v_job_id,
    'awarded',
    v_actor,
    'Bid accepted — supplier awarded.',
    jsonb_build_object(
      'bid_id', p_bid_id,
      'awarded_carrier_company_id', v_bidder_company_id,
      'bidder_driver_id', v_bidder_driver_id,
      'vehicle_id', v_driver_vehicle_id
    )
  );

  IF v_bidder_driver_id IS NOT NULL THEN
    INSERT INTO public.job_tracking_events
      (job_id, event_type, created_by, message, meta)
    VALUES (
      v_job_id,
      'allocated',
      v_actor,
      'Named bidder driver and canonical vehicle auto-allocated.',
      jsonb_build_object(
        'assigned_driver_id', v_bidder_driver_id,
        'vehicle_id', v_driver_vehicle_id
      )
    );
  END IF;

  INSERT INTO public.job_commercial_agreements
    (job_id, bid_id, buyer_company_id, supplier_company_id, agreed_amount, currency, agreed_at, created_by)
  VALUES
    (v_job_id, p_bid_id, v_owner_company_id, v_bidder_company_id, v_bid_price_gbp, v_bid_currency, now(), v_actor)
  ON CONFLICT (job_id) DO NOTHING
  RETURNING id INTO v_agreement_id;

  IF v_agreement_id IS NULL THEN
    SELECT agreement.id
    INTO v_agreement_id
    FROM public.job_commercial_agreements agreement
    WHERE agreement.job_id = v_job_id
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'success', true,
    'bid_id', p_bid_id,
    'job_id', v_job_id,
    'awarded_carrier_company_id', v_bidder_company_id,
    'assigned_driver_id', v_bidder_driver_id,
    'vehicle_id', v_driver_vehicle_id,
    'job_status', v_final_status,
    'commercial_agreement_id', v_agreement_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.driver_operational_eligibility(uuid) IS
  'Canonical fail-closed owner/company driver readiness: active account, verified/current onboarding identity, active company membership, exactly one active assigned vehicle, current MOT and vehicle insurance.';
COMMENT ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) IS
  'Canonical award: named bidder driver auto-allocates that same eligible driver + vehicle; company-level bid without named driver remains awarded/unallocated.';

NOTIFY pgrst, 'reload schema';

COMMIT;
