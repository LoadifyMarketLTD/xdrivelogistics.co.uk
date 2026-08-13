-- Atomic Delivered -> Invoice Draft invariant
--
-- Canonical XDrive lifecycle for commercially awarded work:
--   valid POD -> Delivered -> Invoice Draft
--
-- The Android native client currently completes delivery through the database RPC,
-- while web/mobile server routes also have a TypeScript best-effort invoice helper.
-- This migration makes the invariant client-independent and transactional: an awarded
-- job cannot enter Delivered unless its accepted commercial agreement can produce the
-- issuer-owned Draft invoice in the same database transaction.
--
-- This migration does not issue/send invoices. It creates Draft only.

BEGIN;

CREATE OR REPLACE FUNCTION public.ensure_delivered_invoice_draft(
  p_job_id uuid,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_agreement public.job_commercial_agreements%ROWTYPE;
  v_buyer public.companies%ROWTYPE;
  v_pod public.proof_of_delivery%ROWTYPE;
  v_existing_id uuid;
  v_invoice_id uuid;
  v_invoice_number text;
  v_actor uuid;
  v_bill_to_name text;
  v_bill_to_address text;
  v_service_description text;
  v_due_days integer;
  v_due_date date;
  v_pod_paths text[];
BEGIN
  SELECT *
  INTO v_job
  FROM public.jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: job not found.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Only commercially awarded work is covered by this invariant. Jobs that are not
  -- yet tied to an awarded carrier are not invoiceable through this marketplace path.
  IF v_job.awarded_carrier_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF lower(coalesce(v_job.current_status, v_job.status, '')) NOT IN ('delivered', 'completed')
     AND lower(coalesce(v_job.status, '')) NOT IN ('delivered', 'completed')
  THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: job is not Delivered.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT public.is_job_pod_valid(p_job_id) THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: a valid POD is required.'
      USING ERRCODE = '23514';
  END IF;

  IF nullif(btrim(coalesce(v_job.customer_ref, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: canonical XDrive Job Ref is missing.'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_agreement
  FROM public.job_commercial_agreements a
  WHERE a.job_id = p_job_id
    AND a.supplier_company_id = v_job.awarded_carrier_company_id
    AND lower(coalesce(a.agreement_status, '')) = 'accepted'
  ORDER BY a.accepted_at DESC, a.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: accepted commercial agreement is missing for the awarded carrier.'
      USING ERRCODE = '23514';
  END IF;

  SELECT i.id
  INTO v_existing_id
  FROM public.invoices i
  WHERE i.commercial_agreement_id = v_agreement.id
    AND i.invoice_origin = 'marketplace'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  IF v_agreement.agreed_amount IS NULL OR v_agreement.agreed_amount <= 0
     OR v_agreement.agreed_gross_amount IS NULL OR v_agreement.agreed_gross_amount <= 0
     OR v_agreement.vat_amount IS NULL OR v_agreement.vat_amount < 0
     OR v_agreement.vat_rate IS NULL OR v_agreement.vat_rate < 0 OR v_agreement.vat_rate > 100
     OR abs(v_agreement.agreed_gross_amount - (v_agreement.agreed_amount + v_agreement.vat_amount)) > 0.01
  THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: accepted commercial agreement totals are invalid.'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO v_buyer
  FROM public.companies
  WHERE id = v_agreement.buyer_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: bill-to company is missing.'
      USING ERRCODE = '23514';
  END IF;

  v_bill_to_name := coalesce(
    nullif(btrim(v_buyer.legal_name), ''),
    nullif(btrim(v_buyer.trading_name), ''),
    nullif(btrim(v_buyer.name), '')
  );

  IF v_bill_to_name IS NULL THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: bill-to company name is missing.'
      USING ERRCODE = '23514';
  END IF;

  v_bill_to_address := nullif(
    concat_ws(', ',
      nullif(btrim(v_buyer.address_line1), ''),
      nullif(btrim(v_buyer.address_line2), ''),
      nullif(btrim(v_buyer.city), ''),
      nullif(btrim(v_buyer.postcode), '')
    ),
    ''
  );

  SELECT *
  INTO v_pod
  FROM public.proof_of_delivery
  WHERE job_id = p_job_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: structured POD row is missing.'
      USING ERRCODE = '23514';
  END IF;

  v_pod_paths := coalesce(v_pod.photo_urls, '{}'::text[])
    || coalesce(v_pod.document_urls, '{}'::text[]);

  v_due_days := coalesce(v_agreement.payment_due_days, 14);
  IF v_due_days < 0 OR v_due_days > 365 THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: payment due days are invalid.'
      USING ERRCODE = '23514';
  END IF;
  v_due_date := current_date + v_due_days;

  v_actor := coalesce(
    p_actor_user_id,
    auth.uid(),
    v_pod.completed_by_user_id,
    v_agreement.created_by,
    v_job.created_by
  );

  v_service_description := coalesce(
    nullif(btrim(v_job.description), ''),
    nullif(btrim(v_job.title), ''),
    'Transport service'
  );

  -- Serialize invoice numbering and draft creation per issuer. next_invoice_number()
  -- also takes the same transaction advisory lock; PostgreSQL advisory xact locks are
  -- re-entrant for the same session.
  PERFORM pg_advisory_xact_lock(hashtext(v_agreement.supplier_company_id::text));

  -- Re-check after acquiring the issuer lock so concurrent delivery calls remain
  -- idempotent and do not consume/create a second commercial invoice.
  SELECT i.id
  INTO v_existing_id
  FROM public.invoices i
  WHERE i.commercial_agreement_id = v_agreement.id
    AND i.invoice_origin = 'marketplace'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_invoice_number := public.next_invoice_number(v_agreement.supplier_company_id);
  IF nullif(btrim(coalesce(v_invoice_number, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Invoice Draft invariant failed: invoice number generation returned empty.'
      USING ERRCODE = '23514';
  END IF;

  BEGIN
    INSERT INTO public.invoices (
      company_id,
      job_id,
      invoice_number,
      status,
      bill_to_name,
      bill_to_email,
      bill_to_address,
      currency,
      subtotal,
      vat_rate,
      vat_amount,
      total,
      issue_date,
      due_date,
      created_by,
      client_name,
      amount,
      net_amount,
      payment_terms,
      invoice_date,
      client_address,
      commercial_agreement_id,
      buyer_company_id,
      supplier_company_id,
      invoice_origin,
      payment_status,
      invoice_generation_idempotency_key,
      job_ref,
      client_email,
      pickup_location,
      delivery_location,
      pickup_datetime,
      delivery_datetime,
      customer_ref,
      delivery_recipient,
      pod_required,
      pod_generated,
      pod_generated_at,
      service_description,
      pod_photos,
      signature,
      recipient_name,
      payment_due_days,
      agreed_gross_amount
    )
    VALUES (
      v_agreement.supplier_company_id,
      p_job_id,
      v_invoice_number,
      'draft'::public.invoice_status,
      v_bill_to_name,
      nullif(btrim(v_buyer.email), ''),
      v_bill_to_address,
      coalesce(nullif(btrim(v_agreement.currency), ''), nullif(btrim(v_job.currency), ''), 'GBP'),
      v_agreement.agreed_amount,
      v_agreement.vat_rate,
      v_agreement.vat_amount,
      v_agreement.agreed_gross_amount,
      NULL,
      v_due_date,
      v_actor,
      v_bill_to_name,
      v_agreement.agreed_gross_amount,
      v_agreement.agreed_amount,
      coalesce(nullif(btrim(v_agreement.payment_terms), ''), '14 days'),
      current_date,
      v_bill_to_address,
      v_agreement.id,
      v_agreement.buyer_company_id,
      v_agreement.supplier_company_id,
      'marketplace',
      'unpaid'::public.invoice_payment_status,
      'auto-pod-' || p_job_id::text,
      v_job.customer_ref,
      nullif(btrim(v_buyer.email), ''),
      v_job.pickup_location,
      v_job.delivery_location,
      v_job.pickup_datetime,
      coalesce(v_job.delivered_at, v_job.delivery_datetime),
      v_job.customer_ref,
      v_pod.received_by,
      true,
      true,
      coalesce(v_pod.completed_at, now()),
      v_service_description,
      to_jsonb(v_pod_paths),
      v_pod.signature_url,
      v_pod.received_by,
      v_due_days,
      v_agreement.agreed_gross_amount
    )
    RETURNING id INTO v_invoice_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT i.id
      INTO v_invoice_id
      FROM public.invoices i
      WHERE i.commercial_agreement_id = v_agreement.id
        AND i.invoice_origin = 'marketplace'
      LIMIT 1;

      IF v_invoice_id IS NULL THEN
        RAISE;
      END IF;
  END;

  RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_delivered_invoice_draft(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_delivered_invoice_draft(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_ensure_delivered_invoice_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_was_delivered boolean;
  v_is_delivered boolean;
BEGIN
  v_was_delivered := lower(coalesce(OLD.current_status, OLD.status, '')) IN ('delivered', 'completed')
    OR lower(coalesce(OLD.status, '')) IN ('delivered', 'completed');
  v_is_delivered := lower(coalesce(NEW.current_status, NEW.status, '')) IN ('delivered', 'completed')
    OR lower(coalesce(NEW.status, '')) IN ('delivered', 'completed');

  IF v_is_delivered
     AND NOT v_was_delivered
     AND NEW.awarded_carrier_company_id IS NOT NULL
  THEN
    PERFORM public.ensure_delivered_invoice_draft(NEW.id, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ensure_delivered_invoice_draft() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_ensure_delivered_invoice_draft ON public.jobs;
CREATE TRIGGER trg_ensure_delivered_invoice_draft
AFTER UPDATE OF status, current_status ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.fn_ensure_delivered_invoice_draft();

COMMENT ON FUNCTION public.ensure_delivered_invoice_draft(uuid, uuid) IS
  'Atomically ensures one issuer-owned marketplace Draft invoice exists for a Delivered awarded job with valid structured POD and accepted commercial agreement.';
COMMENT ON FUNCTION public.fn_ensure_delivered_invoice_draft() IS
  'Client-independent Delivered -> Invoice Draft invariant for commercially awarded jobs.';

NOTIFY pgrst, 'reload schema';

COMMIT;
