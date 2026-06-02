-- Migration 070: Owner-driver bid win → auto-assign driver record
-- Upgrades accept_job_bid_atomic to:
--   1. Set jobs.status = 'allocated' when a bid is accepted
--   2. When the winning company is a single-driver (owner-driver) workspace,
--      also set jobs.assigned_driver_id to that driver's id so the driver
--      immediately sees the job in their dashboard.

BEGIN;

CREATE OR REPLACE FUNCTION public.accept_job_bid_atomic(
  p_bid_id uuid,
  p_actor_user_id uuid
)
RETURNS TABLE (
  success boolean,
  http_status integer,
  error_code text,
  error_message text,
  bid_id uuid,
  job_id uuid,
  awarded_carrier_company_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_job_company_id uuid;
  v_bid_company_id uuid;
  v_bid_status text;
  v_exchange_visibility text;
  v_awarded_carrier_company_id uuid;
  v_actor_role text;
  v_accepted_count integer;
  v_award_count integer;
  v_owner_driver_id uuid;
BEGIN
  -- ── Lock bid + job row ─────────────────────────────────────────────────────
  SELECT
    jb.job_id,
    j.company_id,
    jb.company_id,
    jb.status,
    j.exchange_visibility,
    j.awarded_carrier_company_id
  INTO
    v_job_id,
    v_job_company_id,
    v_bid_company_id,
    v_bid_status,
    v_exchange_visibility,
    v_awarded_carrier_company_id
  FROM public.job_bids jb
  JOIN public.jobs j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id
  FOR UPDATE OF jb, j;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 404, 'NOT_FOUND', 'Bid not found.', NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- ── Actor role check ───────────────────────────────────────────────────────
  SELECT cm.role_in_company
  INTO v_actor_role
  FROM public.company_memberships cm
  WHERE cm.user_id = p_actor_user_id
    AND cm.company_id = v_job_company_id
    AND cm.status = 'active'
  LIMIT 1;

  IF v_actor_role IS NULL THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN', 'Forbidden — you are not a member of the job-owning company.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_actor_role NOT IN ('owner', 'admin', 'dispatcher') THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN', 'Forbidden — insufficient role to accept bids.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_exchange_visibility NOT IN ('exchange', 'direct') THEN
    RETURN QUERY SELECT false, 400, 'BAD_REQUEST', 'Bad request — this job is not on the exchange.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_status <> 'submitted' THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — only submitted bids can be accepted.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_awarded_carrier_company_id IS NOT NULL THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — this job has already been awarded to a carrier.', p_bid_id, v_job_id, v_awarded_carrier_company_id;
    RETURN;
  END IF;

  IF v_bid_company_id IS NULL THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — bid company is missing.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  IF v_bid_company_id = v_job_company_id THEN
    RETURN QUERY SELECT false, 403, 'FORBIDDEN', 'Forbidden — cannot accept a bid placed by your own company.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  -- ── Accept bid, reject others ──────────────────────────────────────────────
  UPDATE public.job_bids
  SET status = 'accepted'
  WHERE id = p_bid_id
    AND status = 'submitted';
  GET DIAGNOSTICS v_accepted_count = ROW_COUNT;

  IF v_accepted_count <> 1 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT', 'Conflict — bid is no longer in submitted status.', p_bid_id, v_job_id, NULL::uuid;
    RETURN;
  END IF;

  UPDATE public.job_bids
  SET status = 'rejected'
  WHERE job_id = v_job_id
    AND id <> p_bid_id
    AND status = 'submitted';

  -- ── Owner-driver check: look for a single driver in the winning company ────
  -- If the winning carrier is an owner-driver workspace (exactly one driver
  -- whose company_id matches and who has app_access), auto-assign that driver.
  SELECT d.id
  INTO v_owner_driver_id
  FROM public.drivers d
  WHERE d.company_id = v_bid_company_id
    AND d.app_access = true
  ORDER BY d.created_at
  LIMIT 1;

  -- ── Award job: set carrier, status=allocated, assigned driver if applicable ─
  UPDATE public.jobs
  SET
    awarded_carrier_company_id = v_bid_company_id,
    status                     = 'allocated',
    assigned_driver_id         = COALESCE(v_owner_driver_id, assigned_driver_id),
    status_history             = COALESCE(status_history, '[]'::jsonb)
                                   || jsonb_build_object(
                                        'status',    'allocated',
                                        'timestamp', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                                      )
  WHERE id = v_job_id
    AND awarded_carrier_company_id IS NULL;
  GET DIAGNOSTICS v_award_count = ROW_COUNT;

  IF v_award_count <> 1 THEN
    RAISE EXCEPTION 'Atomic award update failed for job %', v_job_id;
  END IF;

  RETURN QUERY SELECT true, 200, NULL::text, NULL::text, p_bid_id, v_job_id, v_bid_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) TO service_role;

COMMIT;
