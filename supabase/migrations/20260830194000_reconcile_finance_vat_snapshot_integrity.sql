BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- P0-09: finance/VAT snapshot convergence.
-- Historical PreLive classification labelled non-VAT-registered suppliers
-- correctly but intentionally did not rewrite their previously calculated 20%
-- amounts. That left settings, immutable commercial agreements and one generated
-- invoice internally contradictory. Reconcile only provable production fixtures
-- and make future invoice duplicate-money fields deterministic.

-- A company with no VAT registration number cannot carry a positive default VAT
-- rate. The existing settings trigger also derives not_registered treatment.
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

-- Commercial agreements are immutable. Open a deliberately tiny repair window
-- only for marked test jobs where the supplier is demonstrably not VAT
-- registered and only the derived VAT/gross fields change to their canonical
-- values. Restore the strict immutable lock before this transaction commits.
CREATE OR REPLACE FUNCTION public.fn_lock_commercial_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND current_setting('app.finance_snapshot_reconciliation', true) = 'p0_09_test_vat'
     AND OLD.vat_treatment = 'not_registered'
     AND NEW.vat_treatment = 'not_registered'
     AND NEW.vat_rate = 0
     AND NEW.vat_amount = 0
     AND NEW.agreed_gross_amount = NEW.agreed_amount
     AND (to_jsonb(NEW) - 'vat_rate' - 'vat_amount' - 'agreed_gross_amount') =
         (to_jsonb(OLD) - 'vat_rate' - 'vat_amount' - 'agreed_gross_amount')
     AND EXISTS (
       SELECT 1
       FROM public.jobs j
       JOIN public.companies c ON c.id = NEW.supplier_company_id
       WHERE j.id = NEW.job_id
         AND COALESCE(j.is_test, false) = true
         AND NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL
     )
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'commercial_agreement % is immutable and cannot be %d.',
    OLD.id, TG_OP
    USING ERRCODE = '23514';
END;
$$;

PERFORM set_config('app.finance_snapshot_reconciliation', 'p0_09_test_vat', true);

UPDATE public.job_commercial_agreements a
SET vat_rate = 0,
    vat_amount = 0,
    agreed_gross_amount = a.agreed_amount
FROM public.jobs j,
     public.companies c
WHERE j.id = a.job_id
  AND c.id = a.supplier_company_id
  AND COALESCE(j.is_test, false) = true
  AND NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL
  AND a.vat_treatment = 'not_registered'
  AND (
    a.vat_rate <> 0
    OR a.vat_amount <> 0
    OR abs(a.agreed_gross_amount - a.agreed_amount) > 0.01
  );

CREATE OR REPLACE FUNCTION public.fn_lock_commercial_agreement()
RETURNS trigger
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

REVOKE ALL ON FUNCTION public.fn_lock_commercial_agreement() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_lock_commercial_agreement() FROM anon;
REVOKE ALL ON FUNCTION public.fn_lock_commercial_agreement() FROM authenticated;

-- Reconcile generated Marketplace invoices from the now-canonical immutable
-- agreement. This includes the legacy duplicate display fields used by older UI.
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

-- One older marked test invoice predates the commercial-agreement snapshot and
-- has zero money plus no invoice header. It cannot truthfully be repaired into a
-- payable invoice and must not remain Submitted. Preserve it as void audit
-- history. The validation trigger is disabled and re-enabled inside this single
-- transaction only; other integrity/audit triggers remain enabled.
ALTER TABLE public.invoices DISABLE TRIGGER trg_validate_invoice_snapshot_integrity;

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

ALTER TABLE public.invoices ENABLE TRIGGER trg_validate_invoice_snapshot_integrity;

-- Canonical invoice VAT guard now also owns the legacy duplicate amount columns.
CREATE OR REPLACE FUNCTION public.fn_guard_xdrive_invoice_vat_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_issuer_vat_number text;
  v_customer_vat_number text;
  v_treatment text;
  v_rate smallint;
  v_expected_vat numeric(12,2);
  v_expected_total numeric(12,2);
BEGIN
  IF NEW.net_amount IS NULL OR NEW.net_amount <= 0 THEN
    RAISE EXCEPTION 'Invoice net amount must be positive.' USING ERRCODE = '23514';
  END IF;

  SELECT NULLIF(btrim(COALESCE(c.vat_number, '')), '')
  INTO v_issuer_vat_number
  FROM public.companies c
  WHERE c.id = NEW.company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice issuer company was not found.' USING ERRCODE = '23503';
  END IF;

  IF NEW.buyer_company_id IS NOT NULL THEN
    SELECT NULLIF(btrim(COALESCE(c.vat_number, '')), '')
    INTO v_customer_vat_number
    FROM public.companies c
    WHERE c.id = NEW.buyer_company_id;
  END IF;

  v_treatment := lower(btrim(COALESCE(NEW.vat_treatment, '')));
  IF v_treatment = '' THEN
    IF v_issuer_vat_number IS NULL THEN
      v_treatment := 'not_registered';
    ELSE
      v_treatment := CASE NEW.vat_rate
        WHEN 20 THEN 'standard'
        WHEN 5 THEN 'reduced'
        WHEN 0 THEN 'zero_rated'
        ELSE NULL
      END;
    END IF;
  END IF;

  IF v_treatment NOT IN ('standard', 'reduced', 'zero_rated', 'reverse_charge', 'not_registered') THEN
    RAISE EXCEPTION 'Unsupported invoice VAT treatment: %', COALESCE(NULLIF(v_treatment, ''), '<empty>')
      USING ERRCODE = '23514';
  END IF;

  IF v_treatment = 'not_registered' THEN
    IF v_issuer_vat_number IS NOT NULL THEN
      RAISE EXCEPTION 'A VAT-registered invoice issuer cannot use not_registered treatment.'
        USING ERRCODE = '23514';
    END IF;
    v_rate := 0;
  ELSE
    IF v_issuer_vat_number IS NULL THEN
      RAISE EXCEPTION 'VAT treatment % requires an issuer VAT registration number.', v_treatment
        USING ERRCODE = '23514';
    END IF;

    v_rate := CASE v_treatment
      WHEN 'standard' THEN 20
      WHEN 'reduced' THEN 5
      WHEN 'zero_rated' THEN 0
      WHEN 'reverse_charge' THEN CASE WHEN NEW.vat_rate IN (5, 20) THEN NEW.vat_rate ELSE NULL END
    END;

    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'Reverse charge requires an underlying VAT rate of 5%% or 20%%.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_treatment = 'reverse_charge'
     AND NEW.buyer_company_id IS NOT NULL
     AND v_customer_vat_number IS NULL THEN
    RAISE EXCEPTION 'Reverse-charge marketplace invoice requires the canonical buyer company VAT number.'
      USING ERRCODE = '23514';
  END IF;

  v_expected_vat := round((NEW.net_amount * v_rate) / 100.0, 2);
  v_expected_total := CASE
    WHEN v_treatment = 'reverse_charge' THEN round(NEW.net_amount, 2)
    ELSE round(NEW.net_amount + v_expected_vat, 2)
  END;

  NEW.vat_treatment := v_treatment;
  NEW.vat_rate := v_rate;
  NEW.vat_amount := v_expected_vat;
  NEW.amount := v_expected_total;
  NEW.subtotal := round(NEW.net_amount, 2);
  NEW.total := v_expected_total;
  NEW.agreed_gross_amount := v_expected_total;
  NEW.issuer_vat_number_snapshot := v_issuer_vat_number;
  NEW.customer_vat_number_snapshot := v_customer_vat_number;

  RETURN NEW;
END;
$$;

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
  agreed_gross_amount
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_xdrive_invoice_vat_contract();

-- Align DB snapshot validation with the application VAT contract, including
-- reverse-charge payable totals and all duplicate monetary display columns.
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

-- Durable final invariants over all payable (non-void) invoices and all
-- commercial agreements.
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
