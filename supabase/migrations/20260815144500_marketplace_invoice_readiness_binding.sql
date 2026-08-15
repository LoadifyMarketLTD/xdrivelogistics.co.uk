-- Launch-closure hardening for marketplace invoicing.
-- A job-backed carrier invoice must bind to the accepted commercial agreement
-- and cannot be created before delivery/POD readiness is satisfied.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.fn_bind_marketplace_invoice_and_require_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_agreement public.job_commercial_agreements%ROWTYPE;
  v_status text;
  v_delivery_photos jsonb;
  v_pod_documents jsonb;
  v_signature text;
  v_evidence_count integer := 0;
BEGIN
  IF NEW.job_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_job
  FROM public.jobs j
  WHERE j.id = NEW.job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice job was not found.' USING ERRCODE = '23514';
  END IF;

  -- Only convert a job-backed invoice into a marketplace invoice when this
  -- invoice company is the accepted supplier for that immutable agreement.
  SELECT * INTO v_agreement
  FROM public.job_commercial_agreements agreement
  WHERE agreement.job_id = NEW.job_id
    AND agreement.supplier_company_id = NEW.company_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  NEW.invoice_origin := 'marketplace';
  NEW.commercial_agreement_id := v_agreement.id;
  NEW.buyer_company_id := v_agreement.buyer_company_id;
  NEW.supplier_company_id := v_agreement.supplier_company_id;
  NEW.net_amount := v_agreement.agreed_amount;
  NEW.vat_rate := v_agreement.vat_rate;
  NEW.vat_amount := v_agreement.vat_amount;
  NEW.amount := v_agreement.agreed_gross_amount;
  NEW.currency := v_agreement.currency;
  NEW.payment_terms := v_agreement.payment_terms;
  NEW.due_date := NEW.invoice_date + v_agreement.payment_due_days;

  v_status := lower(coalesce(nullif(v_job.current_status, ''), nullif(v_job.status, ''), ''));
  v_status := CASE v_status
    WHEN 'arrived_delivery' THEN 'on_site_delivery'
    ELSE v_status
  END;

  IF v_status NOT IN ('delivered', 'completed', 'invoiced', 'paid') THEN
    RAISE EXCEPTION 'Marketplace invoice is not ready: the job must be delivered first.'
      USING ERRCODE = '23514';
  END IF;

  IF coalesce(v_agreement.pod_required, v_job.pod_required, true) THEN
    v_delivery_photos := coalesce(v_job.delivery_photos, '[]'::jsonb);
    v_pod_documents := coalesce(v_job.pod_photos, '[]'::jsonb);
    v_evidence_count :=
      CASE WHEN jsonb_typeof(v_delivery_photos) = 'array' THEN jsonb_array_length(v_delivery_photos) ELSE 0 END
      + CASE WHEN jsonb_typeof(v_pod_documents) = 'array' THEN jsonb_array_length(v_pod_documents) ELSE 0 END;

    v_signature := CASE jsonb_typeof(v_job.delivery_signature_data)
      WHEN 'string' THEN nullif(btrim(v_job.delivery_signature_data #>> '{}'), '')
      WHEN 'object' THEN nullif(btrim(v_job.delivery_signature_data ->> 'value'), '')
      ELSE NULL
    END;

    -- Readiness is evidence-based. pod_generated/pod_generated_at remain useful
    -- presentation/audit fields, but older valid POD rows are not rejected just
    -- because those derived flags pre-date the canonical driver lifecycle.
    IF v_evidence_count = 0
       OR v_signature IS NULL
       OR nullif(btrim(coalesce(v_job.client_signature_name, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Marketplace invoice is not ready: required POD evidence is incomplete.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_marketplace_binding_readiness ON public.invoices;
CREATE TRIGGER trg_invoice_marketplace_binding_readiness
BEFORE INSERT OR UPDATE OF
  job_id,
  company_id,
  invoice_date,
  invoice_origin,
  commercial_agreement_id,
  buyer_company_id,
  supplier_company_id,
  amount,
  net_amount,
  vat_amount,
  vat_rate,
  currency,
  payment_terms,
  due_date
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_bind_marketplace_invoice_and_require_readiness();

REVOKE ALL ON FUNCTION public.fn_bind_marketplace_invoice_and_require_readiness() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_bind_marketplace_invoice_and_require_readiness() TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_bind_marketplace_invoice_and_require_readiness() IS
  'Binds job-backed supplier invoices to the immutable marketplace agreement and blocks invoicing until delivered with complete required POD evidence.';

NOTIFY pgrst, 'reload schema';
COMMIT;
