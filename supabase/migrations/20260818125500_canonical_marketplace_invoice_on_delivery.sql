-- Restore automatic Marketplace invoice generation on the current immutable
-- commercial-agreement contract. One supplier invoice is created; the buyer
-- receives it through the existing sent/paid job-owner read policy. Direct and
-- manual jobs remain owned by their existing Finance routes.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

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
  v_agreement public.job_commercial_agreements%ROWTYPE;
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
  FROM public.job_commercial_agreements agreement
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

DROP TRIGGER IF EXISTS trg_generate_invoice_on_job_completion ON public.jobs;
CREATE TRIGGER trg_generate_invoice_on_job_completion
AFTER UPDATE OF status, current_status, delivered_at, completed_at ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_generate_invoice_on_job_completion();

REVOKE ALL ON FUNCTION public.fn_generate_invoice_on_job_completion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_generate_invoice_on_job_completion() TO service_role;

COMMENT ON FUNCTION public.fn_generate_invoice_on_job_completion() IS
  'Canonical Marketplace invoice generator: on delivered/completed, create at most one supplier draft from the immutable accepted commercial agreement and buyer company identity; direct/manual Finance is unchanged.';

COMMIT;
