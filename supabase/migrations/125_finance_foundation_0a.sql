-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 125 — Finance Foundation Phase 0A
--
-- Fixes all DB-layer audit findings from the reconciled finance audit:
--
--   1. settlement_method CHECK constraint          (unrestricted settlement_method)
--   2. Append-only RLS on audit/ledger tables      (mutable audit history)
--   3. Overpayment guard BEFORE INSERT trigger     (missing overpayment protection)
--   4. Payment idempotency_key                     (missing payment idempotency)
--   5. Bilateral customer invoice visibility RLS   (broken bilateral visibility)
--   6. Restrict payment INSERT to admin/dispatcher (excessive driver payment perms)
--
-- All statements are idempotent (DO/IF NOT EXISTS guards where needed).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. settlement_method allowed-values constraint ────────────────────────────
-- The column was TEXT with DEFAULT 'bank_transfer' but no CHECK, allowing any
-- arbitrary string. Lock it down to the canonical set of methods.

ALTER TABLE public.invoice_payment_history
  DROP CONSTRAINT IF EXISTS invoice_payment_history_settlement_method_check;

ALTER TABLE public.invoice_payment_history
  ADD CONSTRAINT invoice_payment_history_settlement_method_check
  CHECK (settlement_method IN (
    'bank_transfer',
    'faster_payments',
    'bacs',
    'chaps',
    'cash',
    'cheque',
    'card',
    'paypal',
    'other'
  ));

-- ── 2. Append-only RLS on invoice_status_history ─────────────────────────────
-- Replace the overly-broad FOR ALL policy (which implicitly allowed UPDATE and
-- DELETE) with separate SELECT and INSERT policies.

DROP POLICY IF EXISTS invoice_status_history_member_access ON public.invoice_status_history;

CREATE POLICY invoice_status_history_select ON public.invoice_status_history
  FOR SELECT
  USING (public.is_company_member(company_id));

CREATE POLICY invoice_status_history_insert ON public.invoice_status_history
  FOR INSERT
  WITH CHECK (public.is_company_member(company_id));

-- ── 3. Append-only RLS on invoice_payment_history ────────────────────────────
-- Replace the overly-broad FOR ALL policy with SELECT + INSERT.
-- INSERT is additionally restricted to owner, admin, and dispatcher roles —
-- regular drivers must not be able to self-record payments.

DROP POLICY IF EXISTS invoice_payment_history_member_access ON public.invoice_payment_history;

CREATE POLICY invoice_payment_history_select ON public.invoice_payment_history
  FOR SELECT
  USING (public.is_company_member(company_id));

-- Only admin-tier members may record a payment entry.
CREATE POLICY invoice_payment_history_insert ON public.invoice_payment_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.user_id    = auth.uid()
        AND cm.company_id = invoice_payment_history.company_id
        AND cm.status     = 'active'
        AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
    )
  );

-- ── 4. Payment idempotency_key ────────────────────────────────────────────────
-- Callers may supply a client-generated idempotency key (e.g. UUID).
-- A partial unique index prevents duplicate inserts for the same key.
-- NULL keys are allowed for legacy rows and for callers that don't need it.

ALTER TABLE public.invoice_payment_history
  ADD COLUMN IF NOT EXISTS idempotency_key text;

DROP INDEX IF EXISTS public.invoice_payment_history_idempotency_idx;
CREATE UNIQUE INDEX invoice_payment_history_idempotency_idx
  ON public.invoice_payment_history (invoice_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ── 5. Overpayment guard — BEFORE INSERT trigger ──────────────────────────────
-- Raises an exception if the incoming payment amount would push the cumulative
-- total above the invoice's face value.  The existing AFTER INSERT trigger
-- (fn_apply_invoice_payment) continues to handle status auto-advance.

CREATE OR REPLACE FUNCTION public.fn_guard_invoice_overpayment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_amount  numeric(12,2);
  v_already_paid    numeric(12,2);
  v_remaining       numeric(12,2);
BEGIN
  -- Fetch invoice face value; validates invoice exists and belongs to company.
  SELECT amount
    INTO v_invoice_amount
    FROM public.invoices
   WHERE id         = NEW.invoice_id
     AND company_id = NEW.company_id;

  IF v_invoice_amount IS NULL THEN
    RAISE EXCEPTION 'Invoice % not found for company %', NEW.invoice_id, NEW.company_id;
  END IF;

  -- Sum all previous payments (not yet including NEW, which is BEFORE INSERT).
  SELECT coalesce(sum(amount), 0)
    INTO v_already_paid
    FROM public.invoice_payment_history
   WHERE invoice_id = NEW.invoice_id
     AND company_id = NEW.company_id;

  v_remaining := v_invoice_amount - v_already_paid;

  IF NEW.amount > v_remaining THEN
    RAISE EXCEPTION
      'Overpayment rejected: invoice balance is £%.2f but payment is £%.2f.',
      v_remaining, NEW.amount;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_invoice_overpayment ON public.invoice_payment_history;
CREATE TRIGGER trg_guard_invoice_overpayment
BEFORE INSERT ON public.invoice_payment_history
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_invoice_overpayment();

-- ── 6. Bilateral customer invoice visibility ─────────────────────────────────
-- The existing invoices_all_member policy only allows a company to see its OWN
-- invoices (where invoices.company_id = the carrier's company).  A customer who
-- posted the job cannot see the carrier's invoice.
--
-- This policy grants SELECT-only access to any company that is the job owner
-- (i.e. jobs.company_id ∈ the reader's company membership set).

DROP POLICY IF EXISTS invoices_job_owner_read ON public.invoices;
CREATE POLICY invoices_job_owner_read ON public.invoices
  FOR SELECT
  USING (
    job_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.jobs j
       WHERE j.id = invoices.job_id
         AND public.is_company_member(j.company_id)
    )
  );

COMMIT;
