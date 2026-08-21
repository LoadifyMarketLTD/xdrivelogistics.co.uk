-- XDrive PreLive VAT contract.
-- A numeric VAT rate is not enough to distinguish zero-rated supplies,
-- reverse-charge supplies and suppliers that are not VAT registered.
-- Persist the treatment explicitly in the commercial snapshot and invoice so
-- the payable amount and PDF wording are deterministic.
--
-- IMPORTANT: reverse_charge is transaction-specific. It is never a company
-- default; company defaults are standard/reduced/zero-rated/not-registered.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS default_vat_treatment text;

ALTER TABLE public.job_commercial_agreements
  ADD COLUMN IF NOT EXISTS vat_treatment text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS vat_treatment text,
  ADD COLUMN IF NOT EXISTS issuer_vat_number_snapshot text,
  ADD COLUMN IF NOT EXISTS customer_vat_number_snapshot text;

-- Existing rows can be classified without changing their amounts. A supplier
-- with no VAT number is not VAT registered. For VAT-registered suppliers the
-- historical 20/5/0 rate maps to standard/reduced/zero-rated respectively.
UPDATE public.company_settings cs
SET default_vat_treatment = CASE
  WHEN NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL THEN 'not_registered'
  WHEN cs.default_vat_rate = 20 THEN 'standard'
  WHEN cs.default_vat_rate = 5 THEN 'reduced'
  WHEN cs.default_vat_rate = 0 THEN 'zero_rated'
  ELSE cs.default_vat_treatment
END
FROM public.companies c
WHERE c.id = cs.company_id
  AND cs.default_vat_treatment IS NULL;

UPDATE public.job_commercial_agreements jca
SET vat_treatment = CASE
  WHEN NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL THEN 'not_registered'
  WHEN jca.vat_rate = 20 THEN 'standard'
  WHEN jca.vat_rate = 5 THEN 'reduced'
  WHEN jca.vat_rate = 0 THEN 'zero_rated'
  ELSE jca.vat_treatment
END
FROM public.companies c
WHERE c.id = jca.supplier_company_id
  AND jca.vat_treatment IS NULL;

UPDATE public.invoices i
SET vat_treatment = CASE
  WHEN NULLIF(btrim(COALESCE(c.vat_number, '')), '') IS NULL THEN 'not_registered'
  WHEN i.vat_rate = 20 THEN 'standard'
  WHEN i.vat_rate = 5 THEN 'reduced'
  WHEN i.vat_rate = 0 THEN 'zero_rated'
  ELSE i.vat_treatment
END,
issuer_vat_number_snapshot = COALESCE(
  i.issuer_vat_number_snapshot,
  NULLIF(btrim(COALESCE(c.vat_number, '')), '')
),
customer_vat_number_snapshot = COALESCE(
  i.customer_vat_number_snapshot,
  (
    SELECT NULLIF(btrim(COALESCE(buyer.vat_number, '')), '')
    FROM public.companies buyer
    WHERE buyer.id = i.buyer_company_id
  )
)
FROM public.companies c
WHERE c.id = i.company_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.company_settings
    WHERE default_vat_treatment IS NULL
       OR default_vat_treatment NOT IN (
         'standard', 'reduced', 'zero_rated', 'not_registered'
       )
  ) THEN
    RAISE EXCEPTION 'PreLive VAT migration blocked: company_settings contains an unresolved/invalid default VAT treatment.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.job_commercial_agreements
    WHERE vat_treatment IS NULL
       OR vat_treatment NOT IN (
         'standard', 'reduced', 'zero_rated', 'reverse_charge', 'not_registered'
       )
  ) THEN
    RAISE EXCEPTION 'PreLive VAT migration blocked: a commercial agreement has an unresolved VAT treatment.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE vat_treatment IS NULL
       OR vat_treatment NOT IN (
         'standard', 'reduced', 'zero_rated', 'reverse_charge', 'not_registered'
       )
  ) THEN
    RAISE EXCEPTION 'PreLive VAT migration blocked: an invoice has an unresolved VAT treatment.';
  END IF;
END;
$$;

ALTER TABLE public.company_settings
  ALTER COLUMN default_vat_treatment SET NOT NULL,
  ALTER COLUMN default_vat_treatment SET DEFAULT 'standard';

ALTER TABLE public.company_settings
  DROP CONSTRAINT IF EXISTS company_settings_default_vat_treatment_check;
ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_default_vat_treatment_check
  CHECK (default_vat_treatment IN (
    'standard', 'reduced', 'zero_rated', 'not_registered'
  ));

ALTER TABLE public.job_commercial_agreements
  ALTER COLUMN vat_treatment SET NOT NULL;
ALTER TABLE public.job_commercial_agreements
  DROP CONSTRAINT IF EXISTS job_commercial_agreements_vat_treatment_check;
ALTER TABLE public.job_commercial_agreements
  ADD CONSTRAINT job_commercial_agreements_vat_treatment_check
  CHECK (vat_treatment IN (
    'standard', 'reduced', 'zero_rated', 'reverse_charge', 'not_registered'
  ));

ALTER TABLE public.invoices
  ALTER COLUMN vat_treatment SET NOT NULL;
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_vat_treatment_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_vat_treatment_check
  CHECK (vat_treatment IN (
    'standard', 'reduced', 'zero_rated', 'reverse_charge', 'not_registered'
  ));

-- Company settings cannot make reverse charge a blanket default. The normal
-- settings UI writes only the rate, so this trigger deterministically derives
-- the corresponding ordinary treatment from VAT registration + rate.
CREATE OR REPLACE FUNCTION public.fn_guard_xdrive_company_vat_settings()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vat_number text;
BEGIN
  SELECT NULLIF(btrim(COALESCE(c.vat_number, '')), '')
  INTO v_vat_number
  FROM public.companies c
  WHERE c.id = NEW.company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company settings company was not found.' USING ERRCODE = '23503';
  END IF;

  IF v_vat_number IS NULL THEN
    NEW.default_vat_rate := 0;
    NEW.default_vat_treatment := 'not_registered';
  ELSE
    IF NEW.default_vat_rate NOT IN (0, 5, 20) THEN
      RAISE EXCEPTION 'VAT-registered company default VAT rate must be 0, 5 or 20.'
        USING ERRCODE = '23514';
    END IF;

    NEW.default_vat_treatment := CASE NEW.default_vat_rate
      WHEN 20 THEN 'standard'
      WHEN 5 THEN 'reduced'
      WHEN 0 THEN 'zero_rated'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_xdrive_company_vat_settings ON public.company_settings;
CREATE TRIGGER trg_guard_xdrive_company_vat_settings
BEFORE INSERT OR UPDATE OF company_id, default_vat_rate, default_vat_treatment
ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_xdrive_company_vat_settings();

CREATE OR REPLACE FUNCTION public.fn_guard_xdrive_commercial_vat_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_supplier_vat_number text;
  v_default_treatment text;
  v_default_rate integer;
  v_treatment text;
  v_rate smallint;
  v_expected_vat numeric(12,2);
  v_expected_total numeric(12,2);
BEGIN
  IF NEW.agreed_amount IS NULL OR NEW.agreed_amount <= 0 THEN
    RAISE EXCEPTION 'Commercial agreement amount must be positive.' USING ERRCODE = '23514';
  END IF;

  SELECT
    NULLIF(btrim(COALESCE(c.vat_number, '')), ''),
    cs.default_vat_treatment,
    cs.default_vat_rate
  INTO v_supplier_vat_number, v_default_treatment, v_default_rate
  FROM public.companies c
  LEFT JOIN public.company_settings cs ON cs.company_id = c.id
  WHERE c.id = NEW.supplier_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial agreement supplier company was not found.' USING ERRCODE = '23503';
  END IF;

  v_treatment := lower(btrim(COALESCE(NEW.vat_treatment, '')));
  IF v_treatment = '' THEN
    IF v_supplier_vat_number IS NULL THEN
      v_treatment := 'not_registered';
    ELSIF v_default_treatment IN ('standard', 'reduced', 'zero_rated') THEN
      v_treatment := v_default_treatment;
    ELSE
      -- Fail-safe platform default for a VAT-registered supplier that has not
      -- saved finance settings yet. Reverse charge is never inferred here.
      v_treatment := 'standard';
    END IF;
  END IF;

  IF v_treatment NOT IN ('standard', 'reduced', 'zero_rated', 'reverse_charge', 'not_registered') THEN
    RAISE EXCEPTION 'Unsupported commercial VAT treatment: %', COALESCE(NULLIF(v_treatment, ''), '<empty>')
      USING ERRCODE = '23514';
  END IF;

  IF v_treatment = 'not_registered' THEN
    IF v_supplier_vat_number IS NOT NULL THEN
      RAISE EXCEPTION 'A supplier with a VAT registration number cannot use not_registered VAT treatment.'
        USING ERRCODE = '23514';
    END IF;
    v_rate := 0;
  ELSE
    IF v_supplier_vat_number IS NULL THEN
      RAISE EXCEPTION 'VAT treatment % requires a supplier VAT registration number.', v_treatment
        USING ERRCODE = '23514';
    END IF;

    v_rate := CASE v_treatment
      WHEN 'standard' THEN 20
      WHEN 'reduced' THEN 5
      WHEN 'zero_rated' THEN 0
      WHEN 'reverse_charge' THEN CASE
        WHEN NEW.vat_rate IN (5, 20) THEN NEW.vat_rate
        WHEN v_default_rate IN (5, 20) THEN v_default_rate::smallint
        ELSE NULL
      END
    END;

    IF v_rate IS NULL THEN
      RAISE EXCEPTION 'Reverse charge requires an underlying VAT rate of 5%% or 20%%.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  v_expected_vat := round((NEW.agreed_amount * v_rate) / 100.0, 2);
  v_expected_total := CASE
    WHEN v_treatment = 'reverse_charge' THEN round(NEW.agreed_amount, 2)
    ELSE round(NEW.agreed_amount + v_expected_vat, 2)
  END;

  NEW.vat_treatment := v_treatment;
  NEW.vat_rate := v_rate;
  NEW.vat_amount := v_expected_vat;
  NEW.agreed_gross_amount := v_expected_total;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zzz_trg_guard_xdrive_commercial_vat_contract
  ON public.job_commercial_agreements;
CREATE TRIGGER zzz_trg_guard_xdrive_commercial_vat_contract
BEFORE INSERT OR UPDATE OF
  vat_treatment,
  vat_rate,
  vat_amount,
  agreed_amount,
  agreed_gross_amount,
  supplier_company_id
ON public.job_commercial_agreements
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_xdrive_commercial_vat_contract();

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
  amount
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_guard_xdrive_invoice_vat_contract();

COMMENT ON COLUMN public.company_settings.default_vat_treatment IS
  'Ordinary supplier default only: standard, reduced, zero_rated or not_registered. Reverse charge is transaction-specific and cannot be a company default.';
COMMENT ON COLUMN public.invoices.vat_treatment IS
  'Explicit VAT semantics: standard, reduced, zero_rated, reverse_charge or not_registered. Reverse-charge VAT is calculated for disclosure but excluded from amount payable.';
COMMENT ON COLUMN public.invoices.issuer_vat_number_snapshot IS
  'VAT registration number snapshotted from the issuer when the invoice VAT contract is written.';
COMMENT ON COLUMN public.invoices.customer_vat_number_snapshot IS
  'Customer VAT number snapshotted where a canonical buyer company exists; used for VAT evidence/reverse-charge disclosure.';

NOTIFY pgrst, 'reload schema';

COMMIT;
