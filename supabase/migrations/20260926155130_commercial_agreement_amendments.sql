BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.job_commercial_agreement_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.job_commercial_agreements(id) ON DELETE RESTRICT,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  version_number integer NOT NULL CHECK (version_number >= 2),
  proposed_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  proposed_by_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  counterparty_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 2000),
  change_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  base_snapshot_hash text NOT NULL CHECK (base_snapshot_hash ~ '^[0-9a-f]{64}$'),
  effective_agreed_amount numeric(12,2) NOT NULL CHECK (effective_agreed_amount > 0),
  currency text NOT NULL DEFAULT 'GBP',
  vat_treatment text NOT NULL CHECK (vat_treatment IN ('standard','reduced','zero_rated','reverse_charge','not_registered')),
  vat_rate smallint NOT NULL CHECK (vat_rate IN (0,5,20)),
  vat_amount numeric(12,2) NOT NULL CHECK (vat_amount >= 0),
  effective_gross_amount numeric(12,2) NOT NULL CHECK (effective_gross_amount > 0),
  payment_terms text NOT NULL,
  payment_due_days integer NOT NULL CHECK (payment_due_days >= 0),
  pod_required boolean NOT NULL DEFAULT true,
  effective_job_snapshot jsonb NOT NULL,
  effective_snapshot_hash text NOT NULL CHECK (effective_snapshot_hash ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','rejected','cancelled')),
  proposed_at timestamptz NOT NULL DEFAULT now(),
  decided_by_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  decided_by_company_id uuid REFERENCES public.companies(id) ON DELETE RESTRICT,
  decision_note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_commercial_agreement_amendments_version_unique
  ON public.job_commercial_agreement_amendments(agreement_id, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS job_commercial_agreement_amendments_one_open
  ON public.job_commercial_agreement_amendments(agreement_id)
  WHERE status = 'proposed';
CREATE INDEX IF NOT EXISTS job_commercial_agreement_amendments_job_idx
  ON public.job_commercial_agreement_amendments(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_commercial_agreement_amendments_counterparty_idx
  ON public.job_commercial_agreement_amendments(counterparty_company_id, status, created_at DESC);

ALTER TABLE public.job_commercial_agreement_amendments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS jca_amendments_participant_select ON public.job_commercial_agreement_amendments;
CREATE POLICY jca_amendments_participant_select ON public.job_commercial_agreement_amendments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_commercial_agreements agreement
      WHERE agreement.id = agreement_id
        AND (
          public.is_company_member(agreement.buyer_company_id)
          OR public.is_company_member(agreement.supplier_company_id)
        )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.job_commercial_agreement_amendments FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_prepare_commercial_agreement_amendment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_agreement public.job_commercial_agreements%ROWTYPE;
  v_latest public.job_commercial_agreement_amendments%ROWTYPE;
  v_expected_vat numeric(12,2);
  v_expected_total numeric(12,2);
  v_payload jsonb;
BEGIN
  SELECT * INTO v_agreement
  FROM public.job_commercial_agreements
  WHERE id = NEW.agreement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Commercial agreement was not found.' USING ERRCODE = '23503';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoices invoice
    WHERE invoice.commercial_agreement_id = v_agreement.id
      AND lower(invoice.status::text) <> 'void'
  ) THEN
    RAISE EXCEPTION 'Commercial agreement cannot be materially amended after invoicing.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.jobs job
    WHERE job.id = v_agreement.job_id
      AND lower(COALESCE(NULLIF(job.current_status::text,''), NULLIF(job.status::text,''), '')) IN
        ('delivered','completed','cancelled','cancelled_by_customer','cancelled_by_driver','failed')
  ) THEN
    RAISE EXCEPTION 'Commercial agreement cannot be materially amended after the job is closed.' USING ERRCODE = '23514';
  END IF;
  IF NEW.proposed_by_company_id = v_agreement.buyer_company_id THEN
    NEW.counterparty_company_id := v_agreement.supplier_company_id;
  ELSIF NEW.proposed_by_company_id = v_agreement.supplier_company_id THEN
    NEW.counterparty_company_id := v_agreement.buyer_company_id;
  ELSE
    RAISE EXCEPTION 'Amendment proposer must be one of the contractual companies.' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.job_commercial_agreement_amendments existing
    WHERE existing.agreement_id = NEW.agreement_id
      AND existing.status = 'proposed'
  ) THEN
    RAISE EXCEPTION 'A commercial amendment is already awaiting a decision.' USING ERRCODE = '23505';
  END IF;

  SELECT * INTO v_latest
  FROM public.job_commercial_agreement_amendments amendment
  WHERE amendment.agreement_id = NEW.agreement_id
    AND amendment.status = 'accepted'
  ORDER BY amendment.version_number DESC
  LIMIT 1;

  NEW.job_id := v_agreement.job_id;
  NEW.version_number := COALESCE((
    SELECT max(amendment.version_number)
    FROM public.job_commercial_agreement_amendments amendment
    WHERE amendment.agreement_id = NEW.agreement_id
  ), 1) + 1;
  NEW.base_snapshot_hash := COALESCE(v_latest.effective_snapshot_hash, v_agreement.contract_snapshot_hash);
  IF NEW.base_snapshot_hash IS NULL OR NEW.base_snapshot_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Commercial agreement has no valid immutable base snapshot hash.' USING ERRCODE = '23514';
  END IF;

  NEW.currency := COALESCE(NULLIF(btrim(NEW.currency), ''), v_latest.currency, v_agreement.currency, 'GBP');
  NEW.vat_treatment := COALESCE(NULLIF(btrim(NEW.vat_treatment), ''), v_latest.vat_treatment, v_agreement.vat_treatment);
  NEW.vat_rate := COALESCE(NEW.vat_rate, v_latest.vat_rate, v_agreement.vat_rate);
  NEW.payment_terms := public.fn_canonical_xdrive_payment_terms(COALESCE(NULLIF(btrim(NEW.payment_terms), ''), v_latest.payment_terms, v_agreement.payment_terms));
  NEW.payment_due_days := public.fn_xdrive_payment_due_days(NEW.payment_terms);
  NEW.pod_required := COALESCE(NEW.pod_required, v_latest.pod_required, v_agreement.pod_required, true);
  NEW.effective_job_snapshot := COALESCE(NEW.effective_job_snapshot, v_latest.effective_job_snapshot, v_agreement.job_snapshot);

  IF NEW.effective_job_snapshot IS NULL THEN
    RAISE EXCEPTION 'Commercial amendment requires a complete effective job snapshot.' USING ERRCODE = '23514';
  END IF;
  IF NEW.effective_agreed_amount IS NULL OR NEW.effective_agreed_amount <= 0 THEN
    RAISE EXCEPTION 'Commercial amendment amount must be positive.' USING ERRCODE = '23514';
  END IF;

  IF NEW.vat_treatment = 'not_registered' AND NEW.vat_rate <> 0 THEN
    RAISE EXCEPTION 'Not-registered VAT treatment requires a zero rate.' USING ERRCODE = '23514';
  END IF;
  IF NEW.vat_treatment = 'standard' AND NEW.vat_rate <> 20 THEN
    RAISE EXCEPTION 'Standard VAT treatment requires a 20%% rate.' USING ERRCODE = '23514';
  END IF;
  IF NEW.vat_treatment = 'reduced' AND NEW.vat_rate <> 5 THEN
    RAISE EXCEPTION 'Reduced VAT treatment requires a 5%% rate.' USING ERRCODE = '23514';
  END IF;
  IF NEW.vat_treatment = 'zero_rated' AND NEW.vat_rate <> 0 THEN
    RAISE EXCEPTION 'Zero-rated VAT treatment requires a zero rate.' USING ERRCODE = '23514';
  END IF;
  IF NEW.vat_treatment = 'reverse_charge' AND NEW.vat_rate NOT IN (5,20) THEN
    RAISE EXCEPTION 'Reverse charge requires an underlying VAT rate of 5%% or 20%%.' USING ERRCODE = '23514';
  END IF;

  v_expected_vat := round((NEW.effective_agreed_amount * NEW.vat_rate) / 100.0, 2);
  v_expected_total := CASE
    WHEN NEW.vat_treatment = 'reverse_charge' THEN round(NEW.effective_agreed_amount, 2)
    ELSE round(NEW.effective_agreed_amount + v_expected_vat, 2)
  END;
  NEW.vat_amount := v_expected_vat;
  NEW.effective_gross_amount := v_expected_total;
  NEW.status := 'proposed';
  NEW.decided_by_user_id := NULL;
  NEW.decided_by_company_id := NULL;
  NEW.decision_note := NULL;
  NEW.decided_at := NULL;
  NEW.proposed_at := COALESCE(NEW.proposed_at, now());
  NEW.created_at := COALESCE(NEW.created_at, NEW.proposed_at, now());

  v_payload := jsonb_build_object(
    'agreement_id', NEW.agreement_id,
    'job_id', NEW.job_id,
    'version_number', NEW.version_number,
    'base_snapshot_hash', NEW.base_snapshot_hash,
    'buyer_company_id', v_agreement.buyer_company_id,
    'supplier_company_id', v_agreement.supplier_company_id,
    'commercial', jsonb_build_object(
      'net_amount', NEW.effective_agreed_amount,
      'currency', NEW.currency,
      'vat_treatment', NEW.vat_treatment,
      'vat_rate', NEW.vat_rate,
      'vat_amount', NEW.vat_amount,
      'gross_amount', NEW.effective_gross_amount,
      'payment_terms', NEW.payment_terms,
      'payment_due_days', NEW.payment_due_days,
      'pod_required', NEW.pod_required
    ),
    'job', NEW.effective_job_snapshot,
    'reason', btrim(NEW.reason),
    'change_summary', COALESCE(NEW.change_summary, '{}'::jsonb)
  );
  NEW.effective_snapshot_hash := encode(digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_commercial_agreement_amendment ON public.job_commercial_agreement_amendments;
CREATE TRIGGER trg_prepare_commercial_agreement_amendment
BEFORE INSERT ON public.job_commercial_agreement_amendments
FOR EACH ROW EXECUTE FUNCTION public.fn_prepare_commercial_agreement_amendment();

CREATE OR REPLACE FUNCTION public.fn_guard_commercial_agreement_amendment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF ROW(
    NEW.agreement_id, NEW.job_id, NEW.version_number, NEW.proposed_by_user_id,
    NEW.proposed_by_company_id, NEW.counterparty_company_id, NEW.reason,
    NEW.change_summary, NEW.base_snapshot_hash, NEW.effective_agreed_amount,
    NEW.currency, NEW.vat_treatment, NEW.vat_rate, NEW.vat_amount,
    NEW.effective_gross_amount, NEW.payment_terms, NEW.payment_due_days,
    NEW.pod_required, NEW.effective_job_snapshot, NEW.effective_snapshot_hash,
    NEW.proposed_at, NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.agreement_id, OLD.job_id, OLD.version_number, OLD.proposed_by_user_id,
    OLD.proposed_by_company_id, OLD.counterparty_company_id, OLD.reason,
    OLD.change_summary, OLD.base_snapshot_hash, OLD.effective_agreed_amount,
    OLD.currency, OLD.vat_treatment, OLD.vat_rate, OLD.vat_amount,
    OLD.effective_gross_amount, OLD.payment_terms, OLD.payment_due_days,
    OLD.pod_required, OLD.effective_job_snapshot, OLD.effective_snapshot_hash,
    OLD.proposed_at, OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Commercial amendment proposal content is immutable.' USING ERRCODE = '23514';
  END IF;

  IF OLD.status <> 'proposed' THEN
    RAISE EXCEPTION 'A decided commercial amendment is immutable.' USING ERRCODE = '23514';
  END IF;
  IF NEW.status NOT IN ('accepted','rejected','cancelled') THEN
    RAISE EXCEPTION 'Commercial amendment may only transition from proposed to accepted, rejected, or cancelled.' USING ERRCODE = '23514';
  END IF;
  IF NEW.decided_by_user_id IS NULL OR NEW.decided_by_company_id IS NULL OR NEW.decided_at IS NULL THEN
    RAISE EXCEPTION 'Commercial amendment decision identity and timestamp are required.' USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'accepted' AND EXISTS (
    SELECT 1 FROM public.invoices invoice
    WHERE invoice.commercial_agreement_id = OLD.agreement_id
      AND lower(invoice.status::text) <> 'void'
  ) THEN
    RAISE EXCEPTION 'Commercial amendment cannot be accepted after invoicing.' USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'accepted' AND EXISTS (
    SELECT 1 FROM public.jobs job
    WHERE job.id = OLD.job_id
      AND lower(COALESCE(NULLIF(job.current_status::text,''), NULLIF(job.status::text,''), '')) IN
        ('delivered','completed','cancelled','cancelled_by_customer','cancelled_by_driver','failed')
  ) THEN
    RAISE EXCEPTION 'Commercial amendment cannot be accepted after the job is closed.' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IN ('accepted','rejected') AND NEW.decided_by_company_id <> OLD.counterparty_company_id THEN
    RAISE EXCEPTION 'Only the contractual counterparty may accept or reject the amendment.' USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'cancelled' AND NEW.decided_by_company_id <> OLD.proposed_by_company_id THEN
    RAISE EXCEPTION 'Only the proposing company may cancel its pending amendment.' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_commercial_agreement_amendment_update ON public.job_commercial_agreement_amendments;
CREATE TRIGGER trg_guard_commercial_agreement_amendment_update
BEFORE UPDATE ON public.job_commercial_agreement_amendments
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_commercial_agreement_amendment_update();

CREATE OR REPLACE FUNCTION public.fn_block_commercial_agreement_amendment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Commercial amendment records are append-only and cannot be deleted.' USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_commercial_agreement_amendment_delete ON public.job_commercial_agreement_amendments;
CREATE TRIGGER trg_block_commercial_agreement_amendment_delete
BEFORE DELETE ON public.job_commercial_agreement_amendments
FOR EACH ROW EXECUTE FUNCTION public.fn_block_commercial_agreement_amendment_delete();

DROP VIEW IF EXISTS public.job_commercial_agreements_effective;
CREATE VIEW public.job_commercial_agreements_effective
WITH (security_invoker = true)
AS
SELECT
  agreement.id,
  agreement.job_id,
  agreement.bid_id,
  agreement.buyer_company_id,
  agreement.supplier_company_id,
  COALESCE(amendment.effective_agreed_amount, agreement.agreed_amount) AS agreed_amount,
  COALESCE(amendment.currency, agreement.currency) AS currency,
  COALESCE(amendment.vat_treatment, agreement.vat_treatment) AS vat_treatment,
  COALESCE(amendment.vat_rate, agreement.vat_rate) AS vat_rate,
  COALESCE(amendment.vat_amount, agreement.vat_amount) AS vat_amount,
  COALESCE(amendment.effective_gross_amount, agreement.agreed_gross_amount) AS agreed_gross_amount,
  COALESCE(amendment.payment_terms, agreement.payment_terms) AS payment_terms,
  COALESCE(amendment.payment_due_days, agreement.payment_due_days) AS payment_due_days,
  COALESCE(amendment.pod_required, agreement.pod_required) AS pod_required,
  agreement.agreement_status,
  agreement.accepted_at,
  agreement.agreed_at,
  agreement.created_by,
  agreement.created_at,
  agreement.snapshot_schema_version,
  agreement.buyer_snapshot,
  agreement.supplier_snapshot,
  COALESCE(amendment.effective_job_snapshot, agreement.job_snapshot) AS job_snapshot,
  agreement.contract_snapshot_hash AS base_contract_snapshot_hash,
  COALESCE(amendment.effective_snapshot_hash, agreement.contract_snapshot_hash) AS contract_snapshot_hash,
  COALESCE(amendment.version_number, 1) AS contract_version,
  amendment.id AS active_amendment_id,
  amendment.proposed_at AS active_amendment_proposed_at,
  amendment.decided_at AS active_amendment_accepted_at
FROM public.job_commercial_agreements agreement
LEFT JOIN LATERAL (
  SELECT amendment.*
  FROM public.job_commercial_agreement_amendments amendment
  WHERE amendment.agreement_id = agreement.id
    AND amendment.status = 'accepted'
  ORDER BY amendment.version_number DESC
  LIMIT 1
) amendment ON true;

REVOKE ALL ON public.job_commercial_agreements_effective FROM PUBLIC, anon;
GRANT SELECT ON public.job_commercial_agreements_effective TO authenticated, service_role;

-- Finance consumers must validate and generate from the effective contract version,
-- while the original accepted agreement remains immutable.
CREATE OR REPLACE FUNCTION public.fn_generate_invoice_on_job_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
  v_invoice_enabled boolean := true;
  v_agreement record;
  v_buyer public.companies%ROWTYPE;
  v_job_ref text;
  v_buyer_address text;
  v_idempotency_key text;
  v_due_date date;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  v_old_status := lower(COALESCE(NULLIF(OLD.current_status::text, ''), NULLIF(OLD.status::text, ''), ''));
  v_new_status := lower(COALESCE(NULLIF(NEW.current_status::text, ''), NULLIF(NEW.status::text, ''), ''));

  -- Generate as soon as canonical POD-backed delivery is reached. A later
  -- delivered -> completed update is harmless because the agreement is unique.
  IF v_new_status NOT IN ('delivered', 'completed')
     OR v_old_status IN ('delivered', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT pff.is_enabled
  INTO v_invoice_enabled
  FROM public.platform_feature_flags pff
  WHERE pff.key = 'invoice_generation'
  LIMIT 1;
  v_invoice_enabled := COALESCE(v_invoice_enabled, true);
  IF NOT v_invoice_enabled THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_agreement
  FROM public.job_commercial_agreements_effective agreement
  WHERE agreement.job_id = NEW.id
    AND agreement.agreement_status = 'accepted'
  ORDER BY agreement.accepted_at DESC, agreement.created_at DESC
  LIMIT 1;

  -- No accepted Marketplace agreement means this is not an automatic
  -- Marketplace invoice path. Direct/manual invoicing remains unchanged.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.invoices invoice
    WHERE invoice.invoice_origin = 'marketplace'
      AND invoice.commercial_agreement_id = v_agreement.id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_buyer
  FROM public.companies company
  WHERE company.id = v_agreement.buyer_company_id;

  IF NOT FOUND OR NULLIF(btrim(COALESCE(v_buyer.name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Marketplace invoice buyer company identity is incomplete.' USING ERRCODE = '23514';
  END IF;

  v_buyer_address := NULLIF(concat_ws(', ',
    NULLIF(btrim(COALESCE(v_buyer.address_line1, '')), ''),
    NULLIF(btrim(COALESCE(v_buyer.address_line2, '')), ''),
    NULLIF(btrim(COALESCE(v_buyer.city, '')), ''),
    NULLIF(btrim(COALESCE(v_buyer.postcode, '')), '')
  ), '');

  v_job_ref := COALESCE(
    NULLIF(btrim(COALESCE(NEW.customer_reference, '')), ''),
    'JOB-' || upper(substr(NEW.id::text, 1, 8))
  );
  v_idempotency_key := 'marketplace-agreement:' || v_agreement.id::text;
  v_due_date := CURRENT_DATE + v_agreement.payment_due_days;

  INSERT INTO public.invoices (
    company_id,
    job_id,
    invoice_number,
    status,
    currency,
    subtotal,
    vat_rate,
    vat_amount,
    total,
    amount,
    net_amount,
    issue_date,
    invoice_date,
    due_date,
    payment_terms,
    payment_due_days,
    payment_status,
    job_ref,
    client_name,
    client_email,
    client_address,
    pickup_location,
    pickup_datetime,
    delivery_location,
    delivery_datetime,
    service_description,
    commercial_agreement_id,
    buyer_company_id,
    supplier_company_id,
    invoice_origin,
    invoice_generation_idempotency_key,
    agreed_gross_amount,
    created_by
  ) VALUES (
    v_agreement.supplier_company_id,
    NEW.id,
    NULL,
    'draft'::public.invoice_status,
    v_agreement.currency,
    v_agreement.agreed_amount,
    v_agreement.vat_rate,
    v_agreement.vat_amount,
    v_agreement.agreed_gross_amount,
    v_agreement.agreed_gross_amount,
    v_agreement.agreed_amount,
    CURRENT_DATE,
    CURRENT_DATE,
    v_due_date,
    v_agreement.payment_terms,
    v_agreement.payment_due_days,
    'unpaid'::public.invoice_payment_status,
    v_job_ref,
    v_buyer.name,
    v_buyer.email,
    v_buyer_address,
    NEW.pickup_location,
    NEW.pickup_datetime,
    NEW.delivery_location,
    NEW.delivery_datetime,
    'Transport service',
    v_agreement.id,
    v_agreement.buyer_company_id,
    v_agreement.supplier_company_id,
    'marketplace',
    v_idempotency_key,
    v_agreement.agreed_gross_amount,
    auth.uid()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.fn_validate_invoice_snapshot_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  agreement record;
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
    FROM public.job_commercial_agreements_effective
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
      RAISE EXCEPTION 'Marketplace invoice does not match the effective accepted commercial agreement.' USING ERRCODE = '23514';
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


REVOKE ALL ON FUNCTION public.fn_prepare_commercial_agreement_amendment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_guard_commercial_agreement_amendment_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_block_commercial_agreement_amendment_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_prepare_commercial_agreement_amendment() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_guard_commercial_agreement_amendment_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_block_commercial_agreement_amendment_delete() TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
