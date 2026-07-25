-- Migration: accept_bid_creates_commercial_agreement
--
-- PROBLEM:
--   Migration 20260723201300 (driver_native_production_workflow_repair) replaced
--   accept_job_bid_atomic with a simplified version that omitted the
--   job_commercial_agreements INSERT that migration 126 had introduced.
--   As a result, accepted bids leave no immutable financial record, breaking
--   the invoice trail (no commercial_agreement_id on the invoice, no VAT snapshot,
--   no agreed_gross_amount).
--
--   The returned JSONB key was also inconsistent: the function emitted
--   "accepted_bid_id" but both API routes (admin accept, customer award) read
--   result.bid_id, so the field was silently undefined.
--
-- SOLUTION:
--   Replace accept_job_bid_atomic with a version that:
--     a. Reads bid_price_gbp (with fallback to amount) as the agreed price.
--     b. Inserts a job_commercial_agreements row inside the same transaction.
--        ON CONFLICT (job_id) DO NOTHING ensures idempotency.
--        The trg_complete_commercial_agreement_snapshot BEFORE-INSERT trigger
--        auto-fills vat_rate, vat_amount, agreed_gross_amount, payment_terms.
--     c. Returns "bid_id" (not "accepted_bid_id") so API routes receive the
--        expected key without any application-layer change.
--     d. Preserves all other behaviour: driver auto-allocation, bid rejection,
--        job status transition to allocated, compliance guard.
--
-- PREREQUISITES (confirmed by preflight):
--   has_jobs_budget_amount              true
--   has_job_bids_bid_price_gbp          true
--   has_accept_job_bid_atomic_fn        true
--   has_job_bids_compliance_trigger     true
--   has_jobs_job_distance_miles         true
--   has_invoices_amount                 true
--
-- IDEMPOTENCY: DROP IF EXISTS + CREATE, ON CONFLICT DO NOTHING on agreement.

BEGIN;

DROP FUNCTION IF EXISTS public.accept_job_bid_atomic(uuid, uuid);

CREATE FUNCTION public.accept_job_bid_atomic(
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

  -- ── 2. Lock bid + job row, read price ────────────────────────────────────────
  SELECT
    jb.job_id,
    j.company_id,
    jb.company_id,
    COALESCE(jb.bid_price_gbp, jb.amount)::numeric(12,2),
    COALESCE(jb.currency, j.currency, 'GBP')
  INTO
    v_job_id,
    v_owner_company_id,
    v_bidder_company_id,
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

  -- ── 4. Find an active driver from the carrier company for auto-allocation ────
  SELECT d.id
  INTO   v_driver_id
  FROM   public.drivers d
  WHERE  d.company_id     = v_bidder_company_id
    AND  coalesce(d.status,     'active') = 'active'
    AND  coalesce(d.is_active,  true)     = true
    AND  coalesce(d.app_access, true)     = true
  ORDER BY d.created_at NULLS LAST, d.id
  LIMIT 1;

  -- ── 5. Accept this bid, reject competing bids ────────────────────────────────
  UPDATE public.job_bids jb
  SET    status     = CASE WHEN jb.id = p_bid_id THEN 'accepted' ELSE 'rejected' END,
         updated_at = now()
  WHERE  jb.job_id  = v_job_id
    AND  jb.status IN ('submitted', 'accepted');

  -- ── 6. Update job — awarded carrier, assigned driver, status ────────────────
  UPDATE public.jobs j
  SET    accepted_bid_id          = p_bid_id,
         awarded_carrier_company_id = v_bidder_company_id,
         assigned_company_id      = v_bidder_company_id,
         assigned_driver_id       = coalesce(j.assigned_driver_id, v_driver_id),
         status                   = 'allocated',
         current_status           = 'allocated',
         updated_at               = now()
  WHERE  j.id = v_job_id;

  -- ── 7. Create immutable commercial agreement ─────────────────────────────────
  -- trg_complete_commercial_agreement_snapshot fires BEFORE INSERT and
  -- auto-fills vat_rate, vat_amount, agreed_gross_amount, payment_terms.
  INSERT INTO public.job_commercial_agreements
    (job_id, bid_id, buyer_company_id, supplier_company_id, agreed_amount, currency, agreed_at, created_by)
  VALUES
    (v_job_id, p_bid_id, v_owner_company_id, v_bidder_company_id, v_bid_price_gbp, v_bid_currency, now(), v_actor)
  ON CONFLICT (job_id) DO NOTHING
  RETURNING id INTO v_agreement_id;

  IF v_agreement_id IS NULL THEN
    SELECT id
    INTO v_agreement_id
    FROM public.job_commercial_agreements
    WHERE job_id = v_job_id
    LIMIT 1;
  END IF;

  -- ── 8. Return canonical result ───────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',                        true,
    'success',                   true,
    'bid_id',                    p_bid_id,
    'job_id',                    v_job_id,
    'awarded_carrier_company_id', v_bidder_company_id,
    'assigned_driver_id',        v_driver_id,
    'commercial_agreement_id',   v_agreement_id
  );
END;
$$;

REVOKE ALL   ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
