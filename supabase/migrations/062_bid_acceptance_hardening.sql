-- Migration 062: Bid acceptance hardening
-- 1) Replace overlapping INSERT policies on job_bids with one strict exchange rule.
-- 2) Add atomic bid-accept RPC used by /api/admin/bids/[id]/accept.

BEGIN;

-- ── 1. RLS: remove permissive overlap and enforce strict exchange insert rule ──
DROP POLICY IF EXISTS "job_bids_insert_bidder_or_admin" ON public.job_bids;
DROP POLICY IF EXISTS job_bids_exchange_insert ON public.job_bids;

CREATE POLICY job_bids_exchange_insert
  ON public.job_bids
  FOR INSERT
  WITH CHECK (
    bidder_user_id = auth.uid()
    AND company_id IS NOT NULL
    AND public.is_company_member(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      WHERE cm.company_id = job_bids.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs j
      WHERE j.id = job_bids.job_id
        AND j.exchange_visibility IN ('exchange', 'direct')
        AND j.company_id <> job_bids.company_id
        AND j.awarded_carrier_company_id IS NULL
    )
  );

-- ── 2. Atomic accept RPC ───────────────────────────────────────────────────────
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
BEGIN
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

  UPDATE public.jobs
  SET awarded_carrier_company_id = v_bid_company_id
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
