-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 129 — Serialize overpayment guard
--
-- Purpose:
--   Fix a race condition in fn_guard_invoice_overpayment (introduced in
--   migration 125) where two concurrent INSERT statements for the same
--   invoice could both pass the overpayment check if they executed before
--   either committed.
--
--   Both triggers read the current committed payment total but neither holds
--   a row-level lock on the invoice while doing so.  The fix is to lock the
--   invoice row with SELECT … FOR UPDATE before summing existing payments,
--   so the second concurrent insert must wait for the first to commit before
--   it re-reads the balance.
--
-- Rollback notes (manual):
--   Re-apply the original function body from migration 125 without FOR UPDATE.
-- ═══════════════════════════════════════════════════════════════════════════

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
  -- Lock the invoice row so concurrent BEFORE INSERT triggers on the same
  -- invoice are serialized.  Without this lock two concurrent payments can
  -- both read the same committed balance and both pass the guard, pushing
  -- the ledger above the invoice face value.
  SELECT amount
    INTO v_invoice_amount
    FROM public.invoices
   WHERE id         = NEW.invoice_id
     AND company_id = NEW.company_id
   FOR UPDATE;

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
