-- Ensure newly accepted bids persist a complete immutable commercial snapshot.
-- Migration 127 added non-null defaults before the BEFORE INSERT trigger. PostgreSQL
-- applies column defaults before that trigger, so omitted values could arrive as
-- vat_rate = 0 / vat_amount = 0 and bypass the supplier finance defaults.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Let the BEFORE INSERT trigger distinguish omitted values from an explicit 0% VAT.
-- NOT NULL constraints remain in place and are checked after the trigger completes.
ALTER TABLE public.job_commercial_agreements
  ALTER COLUMN vat_rate DROP DEFAULT,
  ALTER COLUMN vat_amount DROP DEFAULT,
  ALTER COLUMN agreed_gross_amount DROP DEFAULT,
  ALTER COLUMN payment_terms DROP DEFAULT,
  ALTER COLUMN payment_due_days DROP DEFAULT,
  ALTER COLUMN pod_required DROP DEFAULT,
  ALTER COLUMN agreement_status DROP DEFAULT,
  ALTER COLUMN accepted_at DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.fn_complete_commercial_agreement_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_payment_terms text;
  v_job_pod_required boolean;
  v_supplier_default_vat_rate integer;
  v_supplier_default_payment_terms text;
  v_resolved_payment_terms text;
  v_resolved_vat_rate smallint;
  v_expected_vat numeric(12,2);
  v_expected_gross numeric(12,2);
BEGIN
  IF NEW.agreed_amount IS NULL OR NEW.agreed_amount <= 0 THEN
    RAISE EXCEPTION 'Commercial agreement amount must be positive.' USING ERRCODE = '23514';
  END IF;

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
  FROM public.jobs j
  LEFT JOIN public.company_settings cs
    ON cs.company_id = NEW.supplier_company_id
  WHERE j.id = NEW.job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial agreement job was not found.' USING ERRCODE = '23503';
  END IF;

  v_resolved_payment_terms := COALESCE(
    NULLIF(btrim(NEW.payment_terms), ''),
    NULLIF(btrim(v_job_payment_terms), ''),
    NULLIF(btrim(v_supplier_default_payment_terms), ''),
    '14 days'
  );

  v_resolved_vat_rate := CASE
    WHEN NEW.vat_rate IN (0, 5, 20) THEN NEW.vat_rate
    WHEN v_supplier_default_vat_rate IN (0, 5, 20)
      THEN v_supplier_default_vat_rate::smallint
    ELSE 0
  END;

  v_expected_vat := round((NEW.agreed_amount * v_resolved_vat_rate) / 100.0, 2);

  NEW.accepted_at := COALESCE(NEW.accepted_at, NEW.agreed_at, NEW.created_at, now());
  NEW.agreement_status := COALESCE(NULLIF(btrim(NEW.agreement_status), ''), 'accepted');
  NEW.payment_terms := v_resolved_payment_terms;
  NEW.payment_due_days := COALESCE(
    NEW.payment_due_days,
    public.fn_parse_payment_due_days(v_resolved_payment_terms)
  );
  NEW.pod_required := COALESCE(NEW.pod_required, v_job_pod_required, true);
  NEW.vat_rate := v_resolved_vat_rate;
  NEW.vat_amount := CASE
    WHEN NEW.vat_amount IS NULL
      OR (v_resolved_vat_rate > 0 AND NEW.vat_amount = 0)
      THEN v_expected_vat
    ELSE round(NEW.vat_amount, 2)
  END;

  v_expected_gross := round(NEW.agreed_amount + NEW.vat_amount, 2);
  NEW.agreed_gross_amount := CASE
    WHEN NEW.agreed_gross_amount IS NULL OR NEW.agreed_gross_amount <= 0
      THEN v_expected_gross
    ELSE round(NEW.agreed_gross_amount, 2)
  END;

  IF NEW.payment_due_days < 0 THEN
    RAISE EXCEPTION 'Commercial agreement payment due days cannot be negative.' USING ERRCODE = '23514';
  END IF;

  IF NEW.vat_amount < 0 THEN
    RAISE EXCEPTION 'Commercial agreement VAT amount cannot be negative.' USING ERRCODE = '23514';
  END IF;

  IF abs(NEW.vat_amount - v_expected_vat) > 0.01 THEN
    RAISE EXCEPTION 'Commercial agreement VAT does not match its net amount and VAT rate.' USING ERRCODE = '23514';
  END IF;

  IF abs(NEW.agreed_gross_amount - v_expected_gross) > 0.01 THEN
    RAISE EXCEPTION 'Commercial agreement gross amount must equal net amount plus VAT.' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_commercial_agreement_snapshot
  ON public.job_commercial_agreements;
CREATE TRIGGER trg_complete_commercial_agreement_snapshot
BEFORE INSERT ON public.job_commercial_agreements
FOR EACH ROW
EXECUTE FUNCTION public.fn_complete_commercial_agreement_snapshot();

COMMIT;

NOTIFY pgrst, 'reload schema';
