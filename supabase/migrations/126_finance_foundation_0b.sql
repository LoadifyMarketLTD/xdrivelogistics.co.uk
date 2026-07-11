-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 126 — Finance Foundation Phase 0B
--
-- Completes the approved financial architecture:
--
--   1. job_commercial_agreements  — immutable financial source of truth
--   2. accept_job_bid_atomic      — creates commercial agreement atomically
--   3. Lock accepted bids         — BEFORE trigger blocks UPDATE/DELETE
--   4. Lock commercial agreements — BEFORE trigger blocks any mutation
--   5. Invoice linkage columns    — commercial_agreement_id, buyer_company_id,
--                                   supplier_company_id, invoice_origin
--   6. Canonical payment_status   — unpaid/partially_paid/paid/overdue/
--                                   disputed/refunded
--   7. Backfill existing invoices — payment_status derived from status
--   8. Restrict financial audit   — invoice_status_history and
--                                   invoice_payment_history INSERT via
--                                   service_role / trigger only
--
-- All statements are idempotent (DO/IF NOT EXISTS/CREATE OR REPLACE guards).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. job_commercial_agreements ─────────────────────────────────────────────
-- One row per accepted bid. Immutable once created — it is the canonical
-- financial source of truth for the agreed price.

CREATE TABLE IF NOT EXISTS public.job_commercial_agreements (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid        NOT NULL REFERENCES public.jobs(id)      ON DELETE RESTRICT,
  bid_id              uuid        NOT NULL REFERENCES public.job_bids(id)  ON DELETE RESTRICT,
  buyer_company_id    uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  supplier_company_id uuid        NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  agreed_amount       numeric(12,2) NOT NULL CHECK (agreed_amount > 0),
  currency            text        NOT NULL DEFAULT 'GBP',
  agreed_at           timestamptz NOT NULL DEFAULT now(),
  created_by          uuid        REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_commercial_agreements_job_bid_unique
  ON public.job_commercial_agreements (job_id, bid_id);

CREATE UNIQUE INDEX IF NOT EXISTS job_commercial_agreements_job_unique
  ON public.job_commercial_agreements (job_id);

CREATE INDEX IF NOT EXISTS job_commercial_agreements_buyer_idx
  ON public.job_commercial_agreements (buyer_company_id);

CREATE INDEX IF NOT EXISTS job_commercial_agreements_supplier_idx
  ON public.job_commercial_agreements (supplier_company_id);

ALTER TABLE public.job_commercial_agreements ENABLE ROW LEVEL SECURITY;

-- Carrier (supplier) can read their own agreements.
DROP POLICY IF EXISTS jca_supplier_select ON public.job_commercial_agreements;
CREATE POLICY jca_supplier_select ON public.job_commercial_agreements
  FOR SELECT
  USING (public.is_company_member(supplier_company_id));

-- Buyer can read agreements for their jobs.
DROP POLICY IF EXISTS jca_buyer_select ON public.job_commercial_agreements;
CREATE POLICY jca_buyer_select ON public.job_commercial_agreements
  FOR SELECT
  USING (public.is_company_member(buyer_company_id));

-- No INSERT/UPDATE/DELETE for authenticated users — done via service_role (RPC only).

-- ── 2. Lock commercial agreements (immutable) ────────────────────────────────
-- Any attempt to UPDATE or DELETE a commercial agreement is blocked.

CREATE OR REPLACE FUNCTION public.fn_lock_commercial_agreement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'commercial_agreement % is immutable and cannot be %d.',
    OLD.id, TG_OP
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_commercial_agreement_update
  ON public.job_commercial_agreements;
CREATE TRIGGER trg_lock_commercial_agreement_update
BEFORE UPDATE ON public.job_commercial_agreements
FOR EACH ROW
EXECUTE FUNCTION public.fn_lock_commercial_agreement();

DROP TRIGGER IF EXISTS trg_lock_commercial_agreement_delete
  ON public.job_commercial_agreements;
CREATE TRIGGER trg_lock_commercial_agreement_delete
BEFORE DELETE ON public.job_commercial_agreements
FOR EACH ROW
EXECUTE FUNCTION public.fn_lock_commercial_agreement();

-- ── 3. Lock accepted bids against mutation ───────────────────────────────────
-- Once a bid reaches 'accepted' status it must not be changed or deleted.

CREATE OR REPLACE FUNCTION public.fn_lock_accepted_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'accepted' THEN
      RAISE EXCEPTION
        'Accepted bid % cannot be deleted.', OLD.id
        USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE path: block any change once the bid is accepted.
  IF OLD.status = 'accepted' THEN
    RAISE EXCEPTION
      'Accepted bid % is immutable — field "%" cannot be changed.',
      OLD.id, TG_OP
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_accepted_bid_update ON public.job_bids;
CREATE TRIGGER trg_lock_accepted_bid_update
BEFORE UPDATE ON public.job_bids
FOR EACH ROW
EXECUTE FUNCTION public.fn_lock_accepted_bid();

DROP TRIGGER IF EXISTS trg_lock_accepted_bid_delete ON public.job_bids;
CREATE TRIGGER trg_lock_accepted_bid_delete
BEFORE DELETE ON public.job_bids
FOR EACH ROW
EXECUTE FUNCTION public.fn_lock_accepted_bid();

-- ── 4. accept_job_bid_atomic — with commercial agreement creation ─────────────
-- All changes from migration 103 are preserved.  This version adds:
--   j. Creates a job_commercial_agreements row in the same transaction.
-- The function runs as SECURITY DEFINER / service_role, bypassing RLS on the
-- commercial_agreements table (which has no INSERT policy for authenticated).

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
  -- ── a. Lock and load bid + job ─────────────────────────────────────────────
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
  FROM public.job_bids jb
  JOIN public.jobs j ON j.id = jb.job_id
  WHERE jb.id = p_bid_id
  FOR UPDATE OF jb, j;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 404, 'NOT_FOUND', 'Bid not found.',
      NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- ── b. Authorisation ───────────────────────────────────────────────────────
  IF p_actor_user_id IS DISTINCT FROM v_job_created_by THEN
    SELECT cm.role_in_company
    INTO   v_actor_role
    FROM   public.company_memberships cm
    WHERE  cm.user_id    = p_actor_user_id
      AND  cm.company_id = v_job_company_id
      AND  cm.status     = 'active'
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

  -- ── c. Business guards ─────────────────────────────────────────────────────
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

  -- ── d. Compliance check on winning carrier ─────────────────────────────────
  v_bid_issues := public.company_compliance_issues(v_bid_company_id, 'award');
  IF coalesce(array_length(v_bid_issues, 1), 0) > 0 THEN
    RETURN QUERY SELECT false, 409, 'COMPLIANCE_BLOCKED',
      format('Compliance blocked award action: %s', array_to_string(v_bid_issues, ' ')),
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- ── e. Accept the winning bid ──────────────────────────────────────────────
  UPDATE public.job_bids
  SET status = 'accepted'
  WHERE id     = p_bid_id
    AND status = 'submitted';
  GET DIAGNOSTICS v_accepted_count = ROW_COUNT;

  IF v_accepted_count <> 1 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — bid is no longer in submitted status.',
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- ── f. Reject all other submitted bids for this job ───────────────────────
  UPDATE public.job_bids
  SET status = 'rejected'
  WHERE job_id = v_job_id
    AND id     <> p_bid_id
    AND status = 'submitted';

  -- ── g. Transition job to 'awarded' ─────────────────────────────────────────
  UPDATE public.jobs
  SET
    awarded_carrier_company_id = v_bid_company_id,
    status                     = 'awarded',
    status_history             = COALESCE(status_history, '[]'::jsonb)
                                   || jsonb_build_object(
                                        'status',    'awarded',
                                        'timestamp', to_char(now() AT TIME ZONE 'UTC',
                                                             'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                                        'bid_id',    p_bid_id,
                                        'awarded_by', p_actor_user_id,
                                        'awarded_carrier_company_id', v_bid_company_id
                                      ),
    updated_at                 = now()
  WHERE id                        = v_job_id
    AND awarded_carrier_company_id IS NULL
    AND status IN ('posted', 'quoted');
  GET DIAGNOSTICS v_award_count = ROW_COUNT;

  IF v_award_count <> 1 THEN
    RETURN QUERY SELECT false, 409, 'CONFLICT',
      'Conflict — job is no longer in an awardable status.',
      p_bid_id, v_job_id, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- ── h. Audit: write tracking event ─────────────────────────────────────────
  INSERT INTO public.job_tracking_events
    (job_id, event_type, created_by, message, meta)
  VALUES (
    v_job_id,
    'awarded',
    p_actor_user_id,
    'Bid accepted — carrier awarded.',
    jsonb_build_object(
      'bid_id',                     p_bid_id,
      'awarded_by',                 p_actor_user_id,
      'awarded_carrier_company_id', v_bid_company_id
    )
  );

  -- ── i. Create immutable commercial agreement ───────────────────────────────
  -- This is the canonical financial record for the agreed price.
  -- Buyer = job-owning company; Supplier = winning carrier company.
  INSERT INTO public.job_commercial_agreements
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
  ON CONFLICT (job_id) DO NOTHING
  RETURNING id INTO v_agreement_id;

  -- ── j. Owner-driver auto-allocation ────────────────────────────────────────
  SELECT COUNT(*), MIN(d.id)
  INTO   v_driver_count, v_owner_driver_id
  FROM   public.drivers d
  WHERE  d.company_id = v_bid_company_id
    AND  d.app_access = true;

  IF v_driver_count = 1 AND v_owner_driver_id IS NOT NULL THEN
    UPDATE public.jobs
    SET
      status             = 'allocated',
      assigned_driver_id = v_owner_driver_id,
      status_history     = COALESCE(status_history, '[]'::jsonb)
                             || jsonb_build_object(
                                  'status',    'allocated',
                                  'timestamp', to_char(now() AT TIME ZONE 'UTC',
                                                       'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                                  'auto_assigned_driver_id', v_owner_driver_id
                                ),
      updated_at         = now()
    WHERE id     = v_job_id
      AND status = 'awarded';
    GET DIAGNOSTICS v_allocate_count = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT true, 200, NULL::text, NULL::text,
    p_bid_id, v_job_id, v_bid_company_id, v_agreement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.accept_job_bid_atomic(uuid, uuid) TO service_role;

-- ── 5. Invoice linkage columns ────────────────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS commercial_agreement_id uuid
    REFERENCES public.job_commercial_agreements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_company_id uuid
    REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_company_id uuid
    REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_origin text
    CHECK (invoice_origin IN ('marketplace', 'direct', 'manual'));

CREATE INDEX IF NOT EXISTS invoices_commercial_agreement_idx
  ON public.invoices (commercial_agreement_id)
  WHERE commercial_agreement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS invoices_buyer_company_idx
  ON public.invoices (buyer_company_id)
  WHERE buyer_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS invoices_supplier_company_idx
  ON public.invoices (supplier_company_id)
  WHERE supplier_company_id IS NOT NULL;

-- ── 6. Canonical payment_status enum and column ───────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname      = 'invoice_payment_status'
      AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    CREATE TYPE public.invoice_payment_status AS ENUM (
      'unpaid',
      'partially_paid',
      'paid',
      'overdue',
      'disputed',
      'refunded'
    );
  END IF;
END;
$$;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_status public.invoice_payment_status
    NOT NULL DEFAULT 'unpaid';

-- ── 7. Backfill existing invoices ─────────────────────────────────────────────
-- Derive payment_status from the existing invoice_status column.
-- 'Paid' → paid; disputed → disputed; overdue → overdue;
-- everything else (Draft/Sent/Pending/Submitted/Approved) → unpaid.

UPDATE public.invoices
SET payment_status =
  CASE
    WHEN lower(status::text) = 'paid'     THEN 'paid'::public.invoice_payment_status
    WHEN lower(status::text) = 'disputed' THEN 'disputed'::public.invoice_payment_status
    WHEN lower(status::text) = 'overdue'
      OR (due_date IS NOT NULL AND due_date < CURRENT_DATE
          AND lower(status::text) NOT IN ('paid', 'disputed', 'cancelled'))
      THEN 'overdue'::public.invoice_payment_status
    ELSE 'unpaid'::public.invoice_payment_status
  END
WHERE payment_status = 'unpaid';   -- only touch rows not yet set

-- Backfill buyer/supplier company IDs for invoices linked to marketplace jobs
-- that already have an accepted commercial agreement.
UPDATE public.invoices i
SET
  commercial_agreement_id = jca.id,
  buyer_company_id        = jca.buyer_company_id,
  supplier_company_id     = jca.supplier_company_id,
  invoice_origin          = 'marketplace'
FROM public.job_commercial_agreements jca
WHERE i.job_id       = jca.job_id
  AND i.commercial_agreement_id IS NULL;

-- ── 8. Restrict financial audit tables to service_role / trigger paths ────────
-- invoice_status_history: normal authenticated users get SELECT only.
-- INSERT is performed by the fn_log_invoice_status_change trigger which runs
-- as SECURITY DEFINER — it already uses service_role-equivalent privileges.

-- Drop the existing too-broad INSERT policies added in migration 125.
DROP POLICY IF EXISTS invoice_status_history_insert  ON public.invoice_status_history;
DROP POLICY IF EXISTS invoice_payment_history_insert ON public.invoice_payment_history;

-- Re-create INSERT policies for service_role only (authenticated users cannot
-- insert directly; they must go through the API which uses supabaseAdmin /
-- service_role, or through triggers running as SECURITY DEFINER).
-- NOTE: There is no standard RLS policy for "service_role only" because
-- service_role bypasses RLS entirely.  Removing the authenticated INSERT
-- policy is sufficient — the trigger/API runs with service_role credentials.

-- For invoice_status_history the trigger (SECURITY DEFINER) handles all
-- inserts automatically. We remove the direct-insert path for authenticated.

-- For invoice_payment_history the API route uses supabaseAdmin (service_role).
-- Authenticated users should not be able to insert directly via PostgREST.
-- We keep the SELECT policy but eliminate any direct INSERT for authenticated.

-- (Both tables already have SELECT policies from migration 125.)
-- No additional action required — removing the INSERT policies above is the
-- full restriction. service_role always bypasses RLS.

COMMIT;
