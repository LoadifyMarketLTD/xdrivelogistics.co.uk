-- Commercial agreement snapshot columns were added with zero defaults. The
-- snapshot trigger used COALESCE, so omitted values kept the zero defaults
-- instead of calculating VAT and gross amounts. Marketplace invoices then
-- inherited amount = 0 even though agreed_amount/net_amount was valid.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_complete_commercial_agreement_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_payment_terms text;
  v_job_pod_required boolean;
  v_supplier_default_vat_rate integer;
  v_supplier_default_payment_terms text;
  v_resolved_payment_terms text;
  v_resolved_vat_rate smallint;
BEGIN
  SELECT
    j.payment_terms,
    j.pod_required,
    cs.default_vat_rate,
    cs.default_payment_terms
  INTO
    v_job_payment_terms,
    v_job_pod_required,
    v_supplier_default_vat_rate,
    v_supplier_default_payment_terms
  FROM public.jobs AS j
  LEFT JOIN public.company_settings AS cs
    ON cs.company_id = NEW.supplier_company_id
  WHERE j.id = NEW.job_id;

  v_resolved_payment_terms := COALESCE(
    NULLIF(NEW.payment_terms, ''),
    v_job_payment_terms,
    v_supplier_default_payment_terms,
    '14 days'
  );

  v_resolved_vat_rate := CASE
    WHEN NEW.vat_rate IN (0, 5, 20) THEN NEW.vat_rate
    WHEN v_supplier_default_vat_rate IN (0, 5, 20)
      THEN v_supplier_default_vat_rate::smallint
    ELSE 0
  END;

  NEW.accepted_at := COALESCE(NEW.accepted_at, NEW.agreed_at, NEW.created_at, now());
  NEW.agreement_status := COALESCE(NULLIF(NEW.agreement_status, ''), 'accepted');
  NEW.payment_terms := v_resolved_payment_terms;
  NEW.payment_due_days := public.fn_parse_payment_due_days(v_resolved_payment_terms);
  NEW.pod_required := COALESCE(NEW.pod_required, v_job_pod_required, true);
  NEW.vat_rate := v_resolved_vat_rate;

  -- agreed_amount is the carrier's net accepted quote. VAT and gross are
  -- deterministic immutable derivatives, so zero defaults must not win.
  NEW.vat_amount := round((NEW.agreed_amount * v_resolved_vat_rate) / 100.0, 2);
  NEW.agreed_gross_amount := round(NEW.agreed_amount + NEW.vat_amount, 2);

  RETURN NEW;
END;
$$;

UPDATE public.job_commercial_agreements
SET
  vat_amount = round((agreed_amount * vat_rate) / 100.0, 2),
  agreed_gross_amount = round(
    agreed_amount + round((agreed_amount * vat_rate) / 100.0, 2),
    2
  )
WHERE agreed_gross_amount IS NULL
   OR agreed_gross_amount <= 0
   OR vat_amount IS NULL
   OR (vat_rate > 0 AND vat_amount <= 0);

COMMENT ON FUNCTION public.fn_complete_commercial_agreement_snapshot() IS
  'Creates an immutable accepted-price snapshot where agreed_amount is net and VAT/gross are deterministically calculated.';

NOTIFY pgrst, 'reload schema';

COMMIT;
