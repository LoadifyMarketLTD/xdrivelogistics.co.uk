BEGIN;

-- P0-09 hosted runtime proof. All mutation probes are rolled back inside
-- exception subtransactions; no live payable invoice is changed by this proof.
DO $$
DECLARE
  v_invoice_id uuid;
  v_agreement_id uuid;
  v_original_net numeric;
  v_original_amount numeric;
  v_original_subtotal numeric;
  v_original_total numeric;
  v_original_gross numeric;
  v_probe_subtotal numeric;
  v_probe_total numeric;
  v_probe_gross numeric;
  v_rejected boolean := false;
  v_bad_settings integer;
  v_bad_agreements integer;
  v_bad_invoices integer;
BEGIN
  SELECT
    i.id,
    i.commercial_agreement_id,
    i.net_amount,
    i.amount,
    i.subtotal,
    i.total,
    i.agreed_gross_amount
  INTO
    v_invoice_id,
    v_agreement_id,
    v_original_net,
    v_original_amount,
    v_original_subtotal,
    v_original_total,
    v_original_gross
  FROM public.invoices i
  JOIN public.job_commercial_agreements a ON a.id = i.commercial_agreement_id
  JOIN public.jobs j ON j.id = i.job_id
  JOIN public.companies supplier ON supplier.id = a.supplier_company_id
  WHERE i.invoice_origin = 'marketplace'
    AND lower(i.status::text) <> 'void'
    AND COALESCE(j.is_test, false) = true
    AND a.vat_treatment = 'not_registered'
    AND NULLIF(btrim(COALESCE(supplier.vat_number, '')), '') IS NULL
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF v_invoice_id IS NULL OR v_agreement_id IS NULL THEN
    RAISE EXCEPTION 'P0-09 runtime proof could not resolve the reconciled test invoice/agreement.';
  END IF;

  -- Direct writes to duplicate money fields must be canonicalized before the
  -- snapshot validator sees the row. Force a mutation, prove normalization, and
  -- deliberately raise/catch to roll the probe back.
  BEGIN
    UPDATE public.invoices
    SET subtotal = 999,
        total = 998,
        agreed_gross_amount = 997
    WHERE id = v_invoice_id;

    SELECT subtotal, total, agreed_gross_amount
    INTO v_probe_subtotal, v_probe_total, v_probe_gross
    FROM public.invoices
    WHERE id = v_invoice_id;

    IF abs(v_probe_subtotal - v_original_net) > 0.01
       OR abs(v_probe_total - v_original_amount) > 0.01
       OR abs(v_probe_gross - v_original_amount) > 0.01 THEN
      RAISE EXCEPTION 'Invoice duplicate-money synchronization probe failed.';
    END IF;

    RAISE EXCEPTION 'rollback finance sync probe' USING ERRCODE = 'P0001';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'rollback finance sync probe' THEN
        RAISE;
      END IF;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = v_invoice_id
      AND i.net_amount IS NOT DISTINCT FROM v_original_net
      AND i.amount IS NOT DISTINCT FROM v_original_amount
      AND i.subtotal IS NOT DISTINCT FROM v_original_subtotal
      AND i.total IS NOT DISTINCT FROM v_original_total
      AND i.agreed_gross_amount IS NOT DISTINCT FROM v_original_gross
  ) THEN
    RAISE EXCEPTION 'Finance synchronization probe did not roll back cleanly.';
  END IF;

  -- A non-VAT-registered issuer cannot be changed to a taxable treatment.
  v_rejected := false;
  BEGIN
    UPDATE public.invoices
    SET vat_treatment = 'standard'
    WHERE id = v_invoice_id;
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Non-VAT issuer accepted a taxable invoice treatment.';
  END IF;

  -- The agreement repair window is closed again; the ledger must be immutable.
  v_rejected := false;
  BEGIN
    UPDATE public.job_commercial_agreements
    SET vat_rate = 20
    WHERE id = v_agreement_id;
  EXCEPTION
    WHEN SQLSTATE '23514' THEN
      v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Commercial agreement immutability was not restored.';
  END IF;

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
      OR (i.vat_treatment <> 'reverse_charge' AND abs(i.amount - (i.net_amount + i.vat_amount)) > 0.01)
      OR (i.vat_treatment = 'reverse_charge' AND abs(i.amount - i.net_amount) > 0.01)
    );

  IF v_bad_settings <> 0 OR v_bad_agreements <> 0 OR v_bad_invoices <> 0 THEN
    RAISE EXCEPTION
      'P0-09 runtime postcondition failed: settings=%, agreements=%, invoices=%',
      v_bad_settings, v_bad_agreements, v_bad_invoices;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.invoices i
    JOIN public.jobs j ON j.id = i.job_id
    WHERE COALESCE(j.is_test, false) = true
      AND i.invoice_origin = 'marketplace'
      AND i.commercial_agreement_id IS NULL
      AND lower(i.status::text) = 'void'
      AND COALESCE(i.amount, 0) <= 0
      AND COALESCE(i.net_amount, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'Legacy zero-value test invoice was not preserved as void audit history.';
  END IF;
END;
$$;

COMMIT;
