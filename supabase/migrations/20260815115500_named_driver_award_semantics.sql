-- Canonical award semantics approved for PR #357.
-- Named driver bid => same eligible driver + canonical vehicle auto-allocated.
-- Company-level bid without named driver => awarded/unallocated.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

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
  v_driver_vehicle_id uuid;
  v_driver_eligible boolean := false;
  v_driver_blockers text[] := ARRAY[]::text[];
  v_owner_driver_count integer := 0;
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

  -- Compatibility only for legacy owner-driver bids that pre-date explicit
  -- bidder_driver_id. Resolve a UNIQUE owner_driver for the same bidder user.
  -- Never choose an arbitrary company driver for a company-level bid.
  IF v_bidder_driver_id IS NULL
     AND v_bidder_company_id IS NULL
     AND v_bidder_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_owner_driver_count
    FROM public.drivers d
    WHERE d.user_id = v_bidder_user_id
      AND COALESCE(d.driver_type, '') = 'owner_driver';

    IF v_owner_driver_count = 1 THEN
      SELECT d.id INTO v_bidder_driver_id
      FROM public.drivers d
      WHERE d.user_id = v_bidder_user_id
        AND COALESCE(d.driver_type, '') = 'owner_driver'
      ORDER BY d.id
      LIMIT 1;
    END IF;
  END IF;

  IF v_bidder_driver_id IS NOT NULL THEN
    SELECT d.company_id, d.user_id
    INTO v_driver_company_id, v_driver_user_id
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

    IF NOT COALESCE(v_driver_eligible, false) OR v_driver_vehicle_id IS NULL THEN
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
  SET accepted_bid_id = p_bid_id,
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
      jsonb_build_object('assigned_driver_id', v_bidder_driver_id, 'vehicle_id', v_driver_vehicle_id)
    );
  END IF;

  INSERT INTO public.job_commercial_agreements
    (job_id, bid_id, buyer_company_id, supplier_company_id, agreed_amount, currency, agreed_at, created_by)
  VALUES
    (v_job_id, p_bid_id, v_owner_company_id, v_bidder_company_id, v_bid_price_gbp, v_bid_currency, now(), v_actor)
  ON CONFLICT (job_id) DO NOTHING
  RETURNING id INTO v_agreement_id;

  IF v_agreement_id IS NULL THEN
    SELECT agreement.id INTO v_agreement_id
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

COMMENT ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) IS
  'Canonical award: named bidder auto-allocates that same eligible driver + canonical vehicle; company-level bid without named driver remains awarded/unallocated.';

NOTIFY pgrst, 'reload schema';
COMMIT;
