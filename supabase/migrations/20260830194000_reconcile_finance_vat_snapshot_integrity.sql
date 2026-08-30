BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- P0-09: reconcile historical VAT snapshots that were classified as
-- not_registered after their old 20% arithmetic had already been persisted.
-- Repair only facts that are provable from canonical production data.

-- Canonical company rule: without a stored VAT registration number, the
-- ordinary default is not_registered at 0%.
UPDATE public.company_settings cs
SET default_vat_rate = 0,
    default_vat_treatment = 'not_registered',
    updated_at = now()
FROM public.companies c
WHERE c.id = cs.company_id
  AND NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL
  AND (
    cs.default_vat_rate <> 0
    OR cs.default_vat_treatment <> 'not_registered'
  );

-- Three historical inconsistent commercial agreements are on rows explicitly
-- marked as test fixtures. The commercial ledger is otherwise immutable.
-- Disabling this single UPDATE lock trigger is transaction-safe: ALTER TABLE
-- holds the table lock until COMMIT and any failure rolls the trigger state back.
ALTER TABLE public.job_commercial_agreements
  DISABLE TRIGGER trg_lock_commercial_agreement_update;

UPDATE public.job_commercial_agreements a
SET vat_rate = 0,
    vat_amount = 0,
    agreed_gross_amount = a.agreed_amount
FROM public.jobs j,
     public.companies supplier
WHERE j.id = a.job_id
  AND supplier.id = a.supplier_company_id
  AND COALESCE(j.is_test, false) = true
  AND NULLIF(btrim(COALESCE(supplier.vat_number, '')), '') IS NULL
  AND a.vat_treatment = 'not_registered'
  AND (
    a.vat_rate <> 0
    OR a.vat_amount <> 0
    OR abs(a.agreed_gross_amount - a.agreed_amount) > 0.01
  );

ALTER TABLE public.job_commercial_agreements
  ENABLE TRIGGER trg_lock_commercial_agreement_update;

-- Reconcile generated Marketplace invoices from the immutable agreement.
-- This also converges the legacy duplicate display fields still consumed by UI.
UPDATE public.invoices i
SET net_amount = a.agreed_amount,
    subtotal = a.agreed_amount,
    vat_treatment = a.vat_treatment,
    vat_rate = a.vat_rate,
    vat_amount = a.vat_amount,
    amount = a.agreed_gross_amount,
    total = a.agreed_gross_amount,
    agreed_gross_amount = a.agreed_gross_amount,
    issuer_vat_number_snapshot = NULLIF(btrim(COALESCE(supplier.vat_number, '')), ''),
    customer_vat_number_snapshot = NULLIF(btrim(COALESCE(buyer.vat_number, '')), ''),
    updated_at = now()
FROM public.job_commercial_agreements a
JOIN public.jobs j ON j.id = a.job_id
JOIN public.companies supplier ON supplier.id = a.supplier_company_id
JOIN public.companies buyer ON buyer.id = a.buyer_company_id
WHERE i.commercial_agreement_id = a.id
  AND i.invoice_origin = 'marketplace'
  AND COALESCE(j.is_test, false) = true
  AND NULLIF(btrim(COALESCE(supplier.vat_number, '')), '') IS NULL
  AND a.vat_treatment = 'not_registered';

-- A still older marked test invoice predates the commercial-agreement ledger.
-- It has zero money, no usable invoice header, no PDF and no payment. It cannot
-- truthfully be made payable, so preserve it as void audit history.
ALTER TABLE public.invoices
  DISABLE TRIGGER trg_validate_invoice_snapshot_integrity;

UPDATE public.invoices i
SET status = 'void'::public.invoice_status,
    updated_at = now()
FROM public.jobs j
WHERE j.id = i.job_id
  AND COALESCE(j.is_test, false) = true
  AND i.commercial_agreement_id IS NULL
  AND i.invoice_origin = 'marketplace'
  AND lower(COALESCE(i.status::text, '')) <> 'void'
  AND (COALESCE(i.amount, 0) <= 0 OR COALESCE(i.net_amount, 0) <= 0)
  AND NOT EXISTS (SELECT 1 FROM public.invoice_documents d WHERE d.invoice_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM public.invoice_payment_history p WHERE p.invoice_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.invoice_id = i.id);

ALTER TABLE public.invoices
  ENABLE TRIGGER trg_validate_invoice_snapshot_integrity;

-- Future writes have one money snapshot. The existing VAT guard runs first
-- alphabetically (trg_guard_*), calculates canonical VAT/amount, then this
-- trigger copies those values into the legacy duplicate fields before validation.
CREATE OR REPLACE FUNCTION public.fn_sync_invoice_money_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.net_amount IS NOT NULL THEN
    NEW.subtotal := round(NEW.net_amount, 2);
  END IF;
  IF NEW.amount IS NOT NULL THEN
    NEW.total := round(NEW.amount, 2);
    NEW.agreed_gross_amount := round(NEW.amount, 2);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_sync_invoice_money_snapshot() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_sync_invoice_money_snapshot() FROM anon;
REVOKE ALL ON FUNCTION public.fn_sync_invoice_money_snapshot() FROM authenticated;

DROP TRIGGER IF EXISTS trg_sync_invoice_money_snapshot ON public.invoices;
CREATE TRIGGER trg_sync_invoice_money_snapshot
BEFORE INSERT OR UPDATE OF
  net_amount,
  amount,
  subtotal,
  total,
  agreed_gross_amount,
  vat_treatment,
  vat_rate,
  vat_amount
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_invoice_money_snapshot();

-- Align DB snapshot validation with the application VAT contract. In particular,
-- reverse charge carries the underlying rate/VAT calculation but the payable
-- total remains net, while all other treatments use net + VAT.
CREATE OR REPLACE FUNCTION public.fn_validate_invoice_snapshot_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  agreement public.job_commercial_agreements%ROWTYPE;
  v_expected_total numeric(12,2);
BEGIN
  IF NULLIF(btrim(COALESCE(NEW.invoice_number, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Invoice number is required.' USING ERRCODE = '23514';
  END IF;
  IF NULLIF(btrim(COALESCE(NEW.job_ref, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Invoice job reference is required.' USING ERRCODE = '23514';
  END IF;
  IF NULLIF(btrim(COALESCE(NEW.client_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Invoice customer name is required.' USING ERRCODE = '23514';
  END IF;
  IF COALESCE(NEW.amount, 0) <= 0 OR COALESCE(NEW.net_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Invoice amount and net amount must be positive.' USING ERRCODE = '23514';
  END IF;
  IF COALESCE(NEW.vat_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Invoice VAT amount cannot be negative.' USING ERRCODE = '23514';
  END IF;

  v_expected_total := CASE
    WHEN NEW.vat_treatment = 'reverse_charge' THEN round(NEW.net_amount, 2)
    ELSE round(NEW.net_amount + NEW.vat_amount, 2)
  END;

  IF abs(NEW.amount - v_expected_total) > 0.01 THEN
    RAISE EXCEPTION 'Invoice payable total is inconsistent with VAT treatment.' USING ERRCODE = '23514';
  END IF;

  IF abs(NEW.subtotal - NEW.net_amount) > 0.01
     OR abs(NEW.total - NEW.amount) > 0.01
     OR abs(NEW.agreed_gross_amount - NEW.amount) > 0.01 THEN
    RAISE EXCEPTION 'Invoice duplicate monetary snapshot fields are inconsistent.' USING ERRCODE = '23514';
  END IF;

  IF NEW.invoice_origin = 'marketplace' THEN
    IF NEW.commercial_agreement_id IS NULL
       OR NEW.buyer_company_id IS NULL
       OR NEW.supplier_company_id IS NULL
       OR NEW.job_id IS NULL THEN
      RAISE EXCEPTION 'Marketplace invoice linkage is incomplete.' USING ERRCODE = '23514';
    END IF;

    SELECT * INTO agreement
    FROM public.job_commercial_agreements
    WHERE id = NEW.commercial_agreement_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Marketplace commercial agreement was not found.' USING ERRCODE = '23514';
    END IF;

    IF NEW.job_id IS DISTINCT FROM agreement.job_id
       OR NEW.company_id IS DISTINCT FROM agreement.supplier_company_id
       OR NEW.buyer_company_id IS DISTINCT FROM agreement.buyer_company_id
       OR NEW.supplier_company_id IS DISTINCT FROM agreement.supplier_company_id
       OR abs(NEW.net_amount - agreement.agreed_amount) > 0.01
       OR abs(NEW.vat_amount - agreement.vat_amount) > 0.01
       OR abs(NEW.amount - agreement.agreed_gross_amount) > 0.01
       OR NEW.vat_rate IS DISTINCT FROM agreement.vat_rate
       OR NEW.vat_treatment IS DISTINCT FROM agreement.vat_treatment
       OR NEW.currency IS DISTINCT FROM agreement.currency THEN
      RAISE EXCEPTION 'Marketplace invoice does not match the accepted commercial agreement.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF lower(NEW.status::text) IN ('submitted', 'approved') THEN
    IF NEW.delivery_state IS DISTINCT FROM 'sent'
       OR NULLIF(btrim(COALESCE(NEW.delivery_provider, '')), '') IS NULL
       OR NULLIF(btrim(COALESCE(NEW.delivery_message_id, '')), '') IS NULL
       OR NULLIF(btrim(COALESCE(NEW.delivery_recipient_email, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Invoice cannot be marked Sent before provider delivery is confirmed.' USING ERRCODE = '23514';
    END IF;

    IF NEW.delivery_recipient_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'Invoice delivery recipient email is invalid.' USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.invoice_documents document
      WHERE document.invoice_id = NEW.id
        AND document.doc_type = 'invoice_pdf'
        AND NULLIF(btrim(document.file_url), '') IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Invoice cannot be marked Sent before its private PDF is stored.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Zero-tolerance postconditions. Non-test business rows are never silently
-- rewritten by the commercial-agreement repair; an unexpected mismatch aborts.
DO $$
DECLARE
  v_bad_settings integer;
  v_bad_agreements integer;
  v_bad_invoices integer;
BEGIN
  SELECT count(*) INTO v_bad_settings
  FROM public.company_settings cs
  JOIN public.companies c ON c.id = cs.company_id
  WHERE NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL
    AND (cs.default_vat_rate <> 0 OR cs.default_vat_treatment <> 'not_registered');

  SELECT count(*) INTO v_bad_agreements
  FROM public.job_commercial_agreements a
  JOIN public.companies c ON c.id = a.supplier_company_id
  WHERE NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL
    AND (
      a.vat_treatment <> 'not_registered'
      OR a.vat_rate <> 0
      OR a.vat_amount <> 0
      OR abs(a.agreed_gross_amount - a.agreed_amount) > 0.01
    );

  SELECT count(*) INTO v_bad_invoices
  FROM public.invoices i
  WHERE lower(i.status::text) <> 'void'
    AND (
      i.net_amount <= 0
      OR i.amount <= 0
      OR abs(i.subtotal - i.net_amount) > 0.01
      OR abs(i.total - i.amount) > 0.01
      OR abs(i.agreed_gross_amount - i.amount) > 0.01
      OR (
        i.vat_treatment <> 'reverse_charge'
        AND abs(i.amount - (i.net_amount + i.vat_amount)) > 0.01
      )
      OR (
        i.vat_treatment = 'reverse_charge'
        AND abs(i.amount - i.net_amount) > 0.01
      )
    );

  IF v_bad_settings <> 0 OR v_bad_agreements <> 0 OR v_bad_invoices <> 0 THEN
    RAISE EXCEPTION
      'Finance VAT snapshot reconciliation failed: settings=%, agreements=%, invoices=%',
      v_bad_settings, v_bad_agreements, v_bad_invoices;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
