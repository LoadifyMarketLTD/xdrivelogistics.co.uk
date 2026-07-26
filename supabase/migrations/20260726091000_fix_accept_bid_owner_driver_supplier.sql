-- Migration: fix_accept_bid_owner_driver_supplier
--
-- PROBLEM:
--   accept_job_bid_atomic (20260725171000) reads supplier_company_id from
--   job_bids.company_id, which is NULL for owner_driver bids (the bidding RLS
--   policy permits company_id = NULL when the driver has no employer company).
--   job_commercial_agreements.supplier_company_id is NOT NULL, so the INSERT
--   fails with a NOT-NULL violation whenever an owner_driver wins a job.
--
--   Additionally, the driver auto-assignment lookup uses:
--     WHERE d.company_id = v_bidder_company_id
--   which returns zero rows when v_bidder_company_id IS NULL, leaving
--   assigned_driver_id unpopulated for owner_driver jobs.
--
-- SOLUTION:
--   When v_bidder_company_id is NULL (owner_driver scenario):
--     a. Resolve supplier_company_id by looking up companies WHERE
--        created_by = bid.bidder_user_id (the sole-trader workspace created
--        during submit_onboarding_application).
--     b. Resolve assigned_driver_id first from bid.bidder_driver_id, then
--        by driver.user_id = bid.bidder_user_id.
--   All other logic (auth check, bid/job UPDATE, commercial agreement INSERT,
--   return payload) is identical to 20260725171000.
--
-- IDEMPOTENCY: CREATE OR REPLACE.  ON CONFLICT DO NOTHING on agreement.

CREATE OR REPLACE FUNCTION public.accept_job_bid_atomic(
  p_actor_user_id uuid,
  p_bid_id        uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor              uuid := coalesce(auth.uid(), p_actor_user_id);
  v_job_id             uuid;
  v_owner_company_id   uuid;
  v_bidder_company_id  uuid;
  v_bidder_user_id     uuid;
  v_bidder_driver_id   uuid;
  v_bid_price_gbp      numeric(12,2);
  v_bid_currency       text;
  v_driver_id          uuid;
  v_agreement_id       uuid;
BEGIN
  -- ── 1. Input validation ──────────────────────────────────────────────────────
  IF p_bid_id IS NULL THEN
    RAISE EXCEPTION 'p_bid_id is required';
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- ── 2. Lock bid + job row, read price and bidder identifiers ─────────────────
  SELECT
    jb.job_id,
    j.company_id,
    jb.company_id,
    jb.bidder_user_id,
    jb.bidder_driver_id,
    COALESCE(jb.bid_price_gbp, jb.amount)::numeric(12,2),
    COALESCE(jb.currency, j.currency, 'GBP')
  INTO
    v_job_id,
    v_owner_company_id,
    v_bidder_company_id,
    v_bidder_user_id,
    v_bidder_driver_id,
    v_bid_price_gbp,
    v_bid_currency
  FROM public.job_bids jb
  JOIN public.jobs     j  ON j.id = jb.job_id
  WHERE jb.id = p_bid_id
  FOR UPDATE;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;

  IF v_bid_price_gbp IS NULL OR v_bid_price_gbp <= 0 THEN
    RAISE EXCEPTION 'Bid has no valid price — bid_price_gbp must be a positive amount';
  END IF;

  -- ── 3. Authorisation — caller must be owner/admin/dispatcher of job company ──
  IF NOT EXISTS (
    SELECT 1
    FROM   public.company_memberships cm
    WHERE  cm.company_id     = v_owner_company_id
      AND  cm.user_id        = v_actor
      AND  cm.status         = 'active'
      AND  cm.role_in_company IN ('owner', 'admin', 'dispatcher')
  ) THEN
    RAISE EXCEPTION 'Not authorized to accept bids for this job';
  END IF;

  -- ── 4. Resolve supplier company for owner_driver bids ────────────────────────
  --    company_driver bids carry company_id on the bid row; owner_driver bids
  --    have company_id = NULL because the driver has no employer.  In that case
  --    we look up the sole-trader workspace created during submission.
  IF v_bidder_company_id IS NULL AND v_bidder_user_id IS NOT NULL THEN
    SELECT c.id INTO v_bidder_company_id
    FROM   public.companies c
    WHERE  c.created_by = v_bidder_user_id
    ORDER BY c.created_at DESC
    LIMIT  1;
  END IF;

  IF v_bidder_company_id IS NULL THEN
    RAISE EXCEPTION
      'Cannot create commercial agreement: bidder has no linked company. '
      'Owner drivers must complete onboarding before receiving jobs.';
  END IF;

  -- ── 5. Find active driver for auto-allocation ─────────────────────────────────
  --    Priority: explicit bidder_driver_id → same user → same company.
  IF v_bidder_driver_id IS NOT NULL THEN
    SELECT d.id INTO v_driver_id
    FROM   public.drivers d
    WHERE  d.id                           = v_bidder_driver_id
      AND  coalesce(d.status,    'active') = 'active'
      AND  coalesce(d.is_active,  true)   = true
      AND  coalesce(d.app_access, true)   = true;
  END IF;

  IF v_driver_id IS NULL AND v_bidder_user_id IS NOT NULL THEN
    SELECT d.id INTO v_driver_id
    FROM   public.drivers d
    WHERE  d.user_id                      = v_bidder_user_id
      AND  coalesce(d.status,    'active') = 'active'
      AND  coalesce(d.is_active,  true)   = true
      AND  coalesce(d.app_access, true)   = true
    ORDER BY d.created_at NULLS LAST, d.id
    LIMIT  1;
  END IF;

  IF v_driver_id IS NULL THEN
    SELECT d.id INTO v_driver_id
    FROM   public.drivers d
    WHERE  d.company_id                   = v_bidder_company_id
      AND  coalesce(d.status,    'active') = 'active'
      AND  coalesce(d.is_active,  true)   = true
      AND  coalesce(d.app_access, true)   = true
    ORDER BY d.created_at NULLS LAST, d.id
    LIMIT  1;
  END IF;

  -- ── 6. Accept this bid, reject competing bids ────────────────────────────────
  UPDATE public.job_bids jb
  SET    status     = CASE WHEN jb.id = p_bid_id THEN 'accepted' ELSE 'rejected' END,
         updated_at = now()
  WHERE  jb.job_id  = v_job_id
    AND  jb.status IN ('submitted', 'accepted');

  -- ── 7. Update job — awarded carrier, assigned driver, status ────────────────
  UPDATE public.jobs j
  SET    accepted_bid_id            = p_bid_id,
         awarded_carrier_company_id = v_bidder_company_id,
         assigned_company_id        = v_bidder_company_id,
         assigned_driver_id         = coalesce(j.assigned_driver_id, v_driver_id),
         status                     = 'allocated',
         current_status             = 'allocated',
         updated_at                 = now()
  WHERE  j.id = v_job_id;

  -- ── 8. Create immutable commercial agreement ─────────────────────────────────
  -- trg_complete_commercial_agreement_snapshot fires BEFORE INSERT and
  -- auto-fills vat_rate, vat_amount, agreed_gross_amount, payment_terms.
  INSERT INTO public.job_commercial_agreements
    (job_id, bid_id, buyer_company_id, supplier_company_id, agreed_amount, currency, agreed_at, created_by)
  VALUES
    (v_job_id, p_bid_id, v_owner_company_id, v_bidder_company_id, v_bid_price_gbp, v_bid_currency, now(), v_actor)
  ON CONFLICT (job_id) DO NOTHING
  RETURNING id INTO v_agreement_id;

  IF v_agreement_id IS NULL THEN
    SELECT id INTO v_agreement_id
    FROM   public.job_commercial_agreements
    WHERE  job_id = v_job_id
    LIMIT  1;
  END IF;

  -- ── 9. Return canonical result ───────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',                         true,
    'success',                    true,
    'bid_id',                     p_bid_id,
    'job_id',                     v_job_id,
    'awarded_carrier_company_id', v_bidder_company_id,
    'assigned_driver_id',         v_driver_id,
    'commercial_agreement_id',    v_agreement_id
  );
END;
$$;

REVOKE ALL   ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
