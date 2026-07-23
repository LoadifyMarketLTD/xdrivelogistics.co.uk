-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 127 — Finance Foundation Phase 0C
--
-- Completes the remaining Phase 0 finance blockers:
--   1. commercial-agreement immutable snapshot fields
--   2. canonical payment_status settlement flow
--   3. finance-role payment authorisation
--   4. dispute linkage + bilateral visibility
--   5. invoice-origin safeguards
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS payment_terms text NOT NULL DEFAULT '14 days',
  ADD COLUMN IF NOT EXISTS pod_required boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.fn_parse_payment_due_days(p_payment_terms text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_match text;
BEGIN
  IF p_payment_terms IS NULL OR btrim(p_payment_terms) = '' THEN
    RETURN 14;
  END IF;

  IF lower(btrim(p_payment_terms)) IN ('pay now', 'immediate', 'due on receipt') THEN
    RETURN 0;
  END IF;

  v_match := substring(p_payment_terms FROM '([0-9]+)');
  IF v_match IS NOT NULL AND v_match <> '' THEN
    RETURN v_match::integer;
  END IF;

  RETURN 14;
END;
$$;

ALTER TABLE public.job_commercial_agreements
  ADD COLUMN IF NOT EXISTS vat_rate smallint,
  ADD COLUMN IF NOT EXISTS vat_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS agreed_gross_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS payment_due_days integer,
  ADD COLUMN IF NOT EXISTS pod_required boolean,
  ADD COLUMN IF NOT EXISTS agreement_status text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

ALTER TABLE public.job_commercial_agreements
  ALTER COLUMN vat_rate SET DEFAULT 0,
  ALTER COLUMN vat_amount SET DEFAULT 0,
  ALTER COLUMN agreed_gross_amount SET DEFAULT 0,
  ALTER COLUMN payment_terms SET DEFAULT '14 days',
  ALTER COLUMN payment_due_days SET DEFAULT 14,
  ALTER COLUMN pod_required SET DEFAULT true,
  ALTER COLUMN agreement_status SET DEFAULT 'accepted',
  ALTER COLUMN accepted_at SET DEFAULT now();

ALTER TABLE public.job_commercial_agreements
  DROP CONSTRAINT IF EXISTS job_commercial_agreements_vat_rate_check;
ALTER TABLE public.job_commercial_agreements
  ADD CONSTRAINT job_commercial_agreements_vat_rate_check
  CHECK (vat_rate IN (0, 5, 20));

ALTER TABLE public.job_commercial_agreements
  DROP CONSTRAINT IF EXISTS job_commercial_agreements_payment_due_days_check;
ALTER TABLE public.job_commercial_agreements
  ADD CONSTRAINT job_commercial_agreements_payment_due_days_check
  CHECK (payment_due_days >= 0);

ALTER TABLE public.job_commercial_agreements
  DROP CONSTRAINT IF EXISTS job_commercial_agreements_agreement_status_check;
ALTER TABLE public.job_commercial_agreements
  ADD CONSTRAINT job_commercial_agreements_agreement_status_check
  CHECK (agreement_status IN ('accepted'));

CREATE OR REPLACE FUNCTION public.fn_complete_commercial_agreement_snapshot()
RETURNS TRIGGER
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
  FROM public.jobs j
  LEFT JOIN public.company_settings cs
    ON cs.company_id = NEW.supplier_company_id
  WHERE j.id = NEW.job_id;

  v_resolved_payment_terms :=
    COALESCE(NULLIF(NEW.payment_terms, ''), v_job_payment_terms, v_supplier_default_payment_terms, '14 days');
  v_resolved_vat_rate :=
    CASE
      WHEN NEW.vat_rate IN (0, 5, 20) THEN NEW.vat_rate
      WHEN v_supplier_default_vat_rate IN (0, 5, 20) THEN v_supplier_default_vat_rate::smallint
      ELSE 0
    END;

  NEW.accepted_at := COALESCE(NEW.accepted_at, NEW.agreed_at, NEW.created_at, now());
  NEW.agreement_status := COALESCE(NULLIF(NEW.agreement_status, ''), 'accepted');
  NEW.payment_terms := v_resolved_payment_terms;
  NEW.payment_due_days := COALESCE(NEW.payment_due_days, public.fn_parse_payment_due_days(v_resolved_payment_terms));
  NEW.pod_required := COALESCE(NEW.pod_required, v_job_pod_required, true);
  NEW.vat_rate := v_resolved_vat_rate;
  NEW.vat_amount := COALESCE(NEW.vat_amount, round((NEW.agreed_amount * v_resolved_vat_rate) / 100.0, 2));
  NEW.agreed_gross_amount := COALESCE(NEW.agreed_gross_amount, round(NEW.agreed_amount + NEW.vat_amount, 2));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complete_commercial_agreement_snapshot
  ON public.job_commercial_agreements;
CREATE TRIGGER trg_complete_commercial_agreement_snapshot
BEFORE INSERT ON public.job_commercial_agreements
FOR EACH ROW
EXECUTE FUNCTION public.fn_complete_commercial_agreement_snapshot();

WITH snapshot_defaults AS (
  SELECT
    jca.id,
    jca.agreed_amount,
    CASE
      WHEN cs.default_vat_rate IN (0, 5, 20) THEN cs.default_vat_rate::smallint
      ELSE 0::smallint
    END AS vat_rate,
    COALESCE(j.payment_terms, cs.default_payment_terms, '14 days') AS payment_terms,
    COALESCE(j.pod_required, true) AS pod_required
  FROM public.job_commercial_agreements jca
  JOIN public.jobs j ON j.id = jca.job_id
  LEFT JOIN public.company_settings cs
    ON cs.company_id = jca.supplier_company_id
)
UPDATE public.job_commercial_agreements jca
SET
  vat_rate = d.vat_rate,
  vat_amount = round((d.agreed_amount * d.vat_rate) / 100.0, 2),
  agreed_gross_amount = round(
    d.agreed_amount + round((d.agreed_amount * d.vat_rate) / 100.0, 2),
    2
  ),
  payment_terms = d.payment_terms,
  payment_due_days = public.fn_parse_payment_due_days(d.payment_terms),
  pod_required = d.pod_required,
  agreement_status = 'accepted',
  accepted_at = COALESCE(jca.accepted_at, jca.agreed_at, jca.created_at, now())
FROM snapshot_defaults d
WHERE d.id = jca.id;

ALTER TABLE public.job_commercial_agreements
  ALTER COLUMN vat_rate SET NOT NULL,
  ALTER COLUMN vat_amount SET NOT NULL,
  ALTER COLUMN agreed_gross_amount SET NOT NULL,
  ALTER COLUMN payment_terms SET NOT NULL,
  ALTER COLUMN payment_due_days SET NOT NULL,
  ALTER COLUMN pod_required SET NOT NULL,
  ALTER COLUMN agreement_status SET NOT NULL,
  ALTER COLUMN accepted_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_calculate_invoice_payment_status(
  p_invoice_amount numeric,
  p_total_paid numeric
)
RETURNS public.invoice_payment_status
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF COALESCE(p_total_paid, 0) >= COALESCE(p_invoice_amount, 0)
     AND COALESCE(p_invoice_amount, 0) > 0 THEN
    RETURN 'paid'::public.invoice_payment_status;
  END IF;

  IF COALESCE(p_total_paid, 0) > 0 THEN
    RETURN 'partially_paid'::public.invoice_payment_status;
  END IF;

  RETURN 'unpaid'::public.invoice_payment_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_normalize_invoice_payment_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.status_after := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_invoice_payment_history
  ON public.invoice_payment_history;
CREATE TRIGGER trg_normalize_invoice_payment_history
BEFORE INSERT ON public.invoice_payment_history
FOR EACH ROW
EXECUTE FUNCTION public.fn_normalize_invoice_payment_history();

CREATE OR REPLACE FUNCTION public.fn_apply_invoice_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice_amount numeric(12,2);
  v_total_paid numeric(12,2);
  v_payment_status public.invoice_payment_status;
  v_paid_at timestamptz;
BEGIN
  SELECT amount
  INTO v_invoice_amount
  FROM public.invoices
  WHERE id = NEW.invoice_id
    AND company_id = NEW.company_id
  FOR UPDATE;

  IF v_invoice_amount IS NULL THEN
    RAISE EXCEPTION 'Invoice % not found for company %', NEW.invoice_id, NEW.company_id;
  END IF;

  SELECT
    COALESCE(sum(amount), 0),
    max(paid_at)
  INTO
    v_total_paid,
    v_paid_at
  FROM public.invoice_payment_history
  WHERE invoice_id = NEW.invoice_id
    AND company_id = NEW.company_id;

  v_payment_status := public.fn_calculate_invoice_payment_status(v_invoice_amount, v_total_paid);

  UPDATE public.invoices
  SET
    payment_status = v_payment_status,
    paid_at = CASE
      WHEN v_payment_status = 'paid'::public.invoice_payment_status THEN COALESCE(v_paid_at, NEW.paid_at, now())
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = NEW.invoice_id
    AND company_id = NEW.company_id;

  RETURN NEW;
END;
$$;

UPDATE public.invoices i
SET
  payment_status = public.fn_calculate_invoice_payment_status(
    i.amount,
    COALESCE((
      SELECT sum(ph.amount)
      FROM public.invoice_payment_history ph
      WHERE ph.invoice_id = i.id
        AND ph.company_id = i.company_id
    ), 0)
  ),
  paid_at = CASE
    WHEN public.fn_calculate_invoice_payment_status(
      i.amount,
      COALESCE((
        SELECT sum(ph.amount)
        FROM public.invoice_payment_history ph
        WHERE ph.invoice_id = i.id
          AND ph.company_id = i.company_id
      ), 0)
    ) = 'paid'::public.invoice_payment_status
      THEN COALESCE((
        SELECT max(ph.paid_at)
        FROM public.invoice_payment_history ph
        WHERE ph.invoice_id = i.id
          AND ph.company_id = i.company_id
      ), i.paid_at)
    ELSE NULL
  END;

DROP POLICY IF EXISTS invoice_payment_history_insert ON public.invoice_payment_history;
CREATE POLICY invoice_payment_history_insert ON public.invoice_payment_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_memberships cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id = invoice_payment_history.company_id
        AND cm.status = 'active'
        AND cm.role_in_company IN ('owner', 'admin', 'dispatcher')
    )
  );

ALTER TABLE public.invoice_disputes
  ADD COLUMN IF NOT EXISTS commercial_agreement_id uuid
    REFERENCES public.job_commercial_agreements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buyer_company_id uuid
    REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_company_id uuid
    REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_id uuid
    REFERENCES public.jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS invoice_disputes_commercial_agreement_idx
  ON public.invoice_disputes (commercial_agreement_id)
  WHERE commercial_agreement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoice_disputes_buyer_company_idx
  ON public.invoice_disputes (buyer_company_id)
  WHERE buyer_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoice_disputes_supplier_company_idx
  ON public.invoice_disputes (supplier_company_id)
  WHERE supplier_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoice_disputes_job_idx
  ON public.invoice_disputes (job_id)
  WHERE job_id IS NOT NULL;

UPDATE public.invoice_disputes d
SET
  commercial_agreement_id = i.commercial_agreement_id,
  buyer_company_id = i.buyer_company_id,
  supplier_company_id = i.supplier_company_id,
  job_id = i.job_id
FROM public.invoices i
WHERE i.id = d.invoice_id
  AND (
    d.commercial_agreement_id IS NULL OR
    d.buyer_company_id IS NULL OR
    d.supplier_company_id IS NULL OR
    d.job_id IS NULL
  );

DROP POLICY IF EXISTS invoice_disputes_member_access ON public.invoice_disputes;
DROP POLICY IF EXISTS invoice_disputes_select ON public.invoice_disputes;
DROP POLICY IF EXISTS invoice_disputes_insert ON public.invoice_disputes;

CREATE POLICY invoice_disputes_select ON public.invoice_disputes
  FOR SELECT
  USING (
    public.is_company_member(company_id)
    OR (buyer_company_id IS NOT NULL AND public.is_company_member(buyer_company_id))
    OR (supplier_company_id IS NOT NULL AND public.is_company_member(supplier_company_id))
  );

CREATE POLICY invoice_disputes_insert ON public.invoice_disputes
  FOR INSERT
  WITH CHECK (
    public.is_company_member(company_id)
    OR (buyer_company_id IS NOT NULL AND public.is_company_member(buyer_company_id))
    OR (supplier_company_id IS NOT NULL AND public.is_company_member(supplier_company_id))
  );

CREATE OR REPLACE FUNCTION public.fn_assign_invoice_origin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.commercial_agreement_id IS NOT NULL
     OR (NEW.buyer_company_id IS NOT NULL AND NEW.supplier_company_id IS NOT NULL) THEN
    NEW.invoice_origin := 'marketplace';
  ELSIF NEW.invoice_origin IS NULL THEN
    NEW.invoice_origin := 'manual';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_invoice_origin ON public.invoices;
CREATE TRIGGER trg_assign_invoice_origin
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_assign_invoice_origin();

UPDATE public.invoices
SET invoice_origin = 'marketplace'
WHERE commercial_agreement_id IS NOT NULL
   OR (buyer_company_id IS NOT NULL AND supplier_company_id IS NOT NULL);

UPDATE public.invoices
SET invoice_origin = 'manual'
WHERE invoice_origin IS NULL;

COMMIT;
