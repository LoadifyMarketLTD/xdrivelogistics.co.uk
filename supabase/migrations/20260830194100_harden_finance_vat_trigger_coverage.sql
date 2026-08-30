BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- P0-09 follow-up: all columns that can alter VAT or duplicate monetary
-- snapshots must pass through the canonical VAT guard and snapshot validator.
DROP TRIGGER IF EXISTS trg_guard_xdrive_invoice_vat_contract ON public.invoices;
CREATE TRIGGER trg_guard_xdrive_invoice_vat_contract
BEFORE INSERT OR UPDATE OF
  company_id,
  buyer_company_id,
  net_amount,
  vat_treatment,
  vat_rate,
  vat_amount,
  amount,
  subtotal,
  total,
  agreed_gross_amount,
  issuer_vat_number_snapshot,
  customer_vat_number_snapshot
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_xdrive_invoice_vat_contract();

DROP TRIGGER IF EXISTS trg_validate_invoice_snapshot_integrity ON public.invoices;
CREATE TRIGGER trg_validate_invoice_snapshot_integrity
BEFORE INSERT OR UPDATE OF
  invoice_number,
  job_ref,
  job_id,
  company_id,
  client_name,
  amount,
  net_amount,
  subtotal,
  vat_amount,
  vat_rate,
  vat_treatment,
  total,
  agreed_gross_amount,
  issuer_vat_number_snapshot,
  customer_vat_number_snapshot,
  currency,
  invoice_origin,
  commercial_agreement_id,
  buyer_company_id,
  supplier_company_id,
  status,
  delivery_state,
  delivery_provider,
  delivery_message_id,
  delivery_recipient_email
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_invoice_snapshot_integrity();

DO $$
DECLARE
  v_guard text;
  v_validator text;
BEGIN
  SELECT pg_get_triggerdef(t.oid)
  INTO v_guard
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.invoices'::regclass
    AND t.tgname = 'trg_guard_xdrive_invoice_vat_contract'
    AND NOT t.tgisinternal;

  SELECT pg_get_triggerdef(t.oid)
  INTO v_validator
  FROM pg_trigger t
  WHERE t.tgrelid = 'public.invoices'::regclass
    AND t.tgname = 'trg_validate_invoice_snapshot_integrity'
    AND NOT t.tgisinternal;

  IF v_guard IS NULL
     OR v_guard NOT ILIKE '%vat_treatment%'
     OR v_guard NOT ILIKE '%subtotal%'
     OR v_guard NOT ILIKE '%agreed_gross_amount%'
     OR v_guard NOT ILIKE '%issuer_vat_number_snapshot%' THEN
    RAISE EXCEPTION 'Invoice VAT guard trigger coverage is incomplete.';
  END IF;

  IF v_validator IS NULL
     OR v_validator NOT ILIKE '%vat_treatment%'
     OR v_validator NOT ILIKE '%subtotal%'
     OR v_validator NOT ILIKE '%agreed_gross_amount%'
     OR v_validator NOT ILIKE '%customer_vat_number_snapshot%' THEN
    RAISE EXCEPTION 'Invoice snapshot validation trigger coverage is incomplete.';
  END IF;
END;
$$;

COMMIT;
