-- Repair the finance-foundation award RPC where RETURNS TABLE output names such
-- as job_id conflicted with unqualified table columns at runtime.
-- Preserve the public RPC contract while qualifying SQL references and keeping
-- the canonical job status/company mirrors synchronized.

BEGIN;

CREATE OR REPLACE FUNCTION public.accept_job_bid_atomic(
  p_bid_id        uuid,
  p_actor_user_id uuid
)
RETURNS TABLE (
  success                    boolean,
  http_status                integer,
  error_code                 text,
  error_message              text,
  bid_id                     uuid,
  job_id                     uuid,
  awarded_carrier_company_id uuid,
  commercial_agreement_id    uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_job_id                     uuid;
  v_job_company_id             uuid;
  v_job_created_by             uuid;
  v_bid_company_id             uuid;
  v_bid_status                 text;
  v_bid_amount                 numeric(12,2);
  v_bid_currency               text;
  v_exchange_visibility        text;
  v_existing_awarded_company   uuid;
  v_actor_role                 text;
  v_accepted_count             integer;
  v_award_count                integer;
  v_allocate_count             integer;
  v_owner_driver_id            uuid;
  v_driver_count               integer;
  v_bid_issues                 text[];
  v_agreement_id               uuid;
BEGIN
  SELECT
    jb.job_id,
    j.company_id,
    j.created_by,
    jb.company_id,
    jb.status,
    jb.amount,
    COALESCE(jb.currency, j.currency, 'GBP'),
    j.exchange_visibility,
    j.awarded_carrier_company_id
  INTO
    v_job_id,
    v_job_company_id,
    v_job_created_by,
    v_bid_company_id,
    v_bid_status,
    v_bid_amount,
    v_bid_currency,
    v_exchange_visibility,
    v_existing_awarded_company
  FROM public.job_bids AS jb
  JOIN public.jobs AS j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id
  FOR UPDATE OF jb, j;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 404, 'NOT_FOUND', 'Bid not found.',
      NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF p_actor_user_id IS DISTINCT FROM v_job_created_by THEN
    SELECT cm.role_in_company
    INTO v_actor_role
    FROM public.company_memberships AS cm
    WHERE cm.user_id = p_actor_user_id
      AND cm.company_id = v_job_company_id
      AND cm.status = 'active'
    LIMIT 1;

    IF v_actor_role IS NULL THEN
      RETURN QUERY SELECT false, 403, 'FORBIDDEN',
        'Forbidden — you are not a member of the job-owning company.',
        p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
      RETURN;
    END IF;

    IF v_actor_role NOT IN ('owner', 'admin', 'dispatcher') THEN
      RETURN QUERY SELECT false, 403, 'FORBIDDEN',
        'Forbidden — insufficient role to accept bids.',
        p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
      RETURN;
    END IF;
  END IF;

  IF v_exchange_visibility NOT IN ('exchange', 'direct') THEN
    RETURN QUERY SELECT false, 400, 'BAD_REQUEST',
      'Bad request — this job is not on the exchange.',
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_status <> 'submitted' THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — only submitted bids can be accepted.',
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF v_existing_awarded_company IS NOT NULL THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — this job has already been awarded to a carrier.',
      p_bid_id, v_job_id, v_existing_awarded_company, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_company_id IS NULL THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — bid company is missing.',
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_company_id = v_job_company_id THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN',
      'Forbidden — cannot accept a bid placed by your own company.',
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_amount IS NULL OR v_bid_amount <= 0 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — bid has no valid amount and cannot form a commercial agreement.',
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  v_bid_issues := public.company_compliance_issues(v_bid_company_id, 'award');
  IF coalesce(array_length(v_bid_issues, 1), 0) > 0 THEN
    RETURN QUERY SELECT false, 409, 'COMPLIANCE_BLOCKED',
      format('Compliance blocked award action: %s', array_to_string(v_bid_issues, ' ')),
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.job_bids AS jb
  SET status = 'accepted'
  WHERE jb.id = p_bid_id
    AND jb.status = 'submitted';
  GET DIAGNOSTICS v_accepted_count = ROW_COUNT;

  IF v_accepted_count <> 1 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — bid is no longer in submitted status.',
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.job_bids AS jb
  SET status = 'rejected'
  WHERE jb.job_id = v_job_id
    AND jb.id <> p_bid_id
    AND jb.status = 'submitted';

  UPDATE public.jobs AS j
  SET awarded_carrier_company_id = v_bid_company_id,
      assigned_company_id = v_bid_company_id,
      status = 'awarded',
      current_status = 'awarded',
      status_history = COALESCE(j.status_history, '[]'::jsonb)
        || jsonb_build_object(
          'status', 'awarded',
          'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'bid_id', p_bid_id,
          'awarded_by', p_actor_user_id,
          'awarded_carrier_company_id', v_bid_company_id
        ),
      updated_at = now()
  WHERE j.id = v_job_id
    AND j.awarded_carrier_company_id IS NULL
    AND j.status IN ('posted', 'quoted');
  GET DIAGNOSTICS v_award_count = ROW_COUNT;

  IF v_award_count <> 1 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — job is no longer in an awardable status.',
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.job_tracking_events
    (job_id, event_type, created_by, message, meta)
  VALUES (
    v_job_id,
    'awarded',
    p_actor_user_id,
    'Bid accepted — carrier awarded.',
    jsonb_build_object(
      'bid_id', p_bid_id,
      'awarded_by', p_actor_user_id,
      'awarded_carrier_company_id', v_bid_company_id
    )
  );

  INSERT INTO public.job_commercial_agreements AS jca
    (job_id, bid_id, buyer_company_id, supplier_company_id, agreed_amount, currency, agreed_at, created_by)
  VALUES (
    v_job_id,
    p_bid_id,
    v_job_company_id,
    v_bid_company_id,
    v_bid_amount,
    v_bid_currency,
    now(),
    p_actor_user_id
  )
  ON CONFLICT DO NOTHING
  RETURNING jca.id INTO v_agreement_id;

  IF v_agreement_id IS NULL THEN
    SELECT jca.id
    INTO v_agreement_id
    FROM public.job_commercial_agreements AS jca
    WHERE jca.job_id = v_job_id
    LIMIT 1;
  END IF;

  SELECT COUNT(*), MIN(d.id)
  INTO v_driver_count, v_owner_driver_id
  FROM public.drivers AS d
  WHERE d.company_id = v_bid_company_id
    AND d.app_access = true;

  IF v_driver_count = 1 AND v_owner_driver_id IS NOT NULL THEN
    UPDATE public.jobs AS j
    SET status = 'allocated',
        current_status = 'allocated',
        assigned_company_id = v_bid_company_id,
        assigned_driver_id = v_owner_driver_id,
        status_history = COALESCE(j.status_history, '[]'::jsonb)
          || jsonb_build_object(
            'status', 'allocated',
            'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            'auto_assigned_driver_id', v_owner_driver_id
          ),
        updated_at = now()
    WHERE j.id = v_job_id
      AND j.status = 'awarded';
    GET DIAGNOSTICS v_allocate_count = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT true, 200, NULL::text, NULL::text,
    p_bid_id, v_job_id, v_bid_company_id, v_agreement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
