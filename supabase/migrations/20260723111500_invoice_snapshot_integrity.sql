-- Repair legacy invoice snapshots and prevent customer workspaces from seeing
-- incomplete or state-only invoices as payable documents.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Legacy award paths could pre-date the immutable agreement table. Recover an
-- agreement only where one positive accepted bid exists and it matches the
-- awarded carrier. Ambiguous jobs remain untouched for manual investigation.
WITH deterministic_agreements AS (
  SELECT
    j.id AS job_id,
    jb.id AS bid_id,
    j.company_id AS buyer_company_id,
    jb.company_id AS supplier_company_id,
    jb.amount::numeric(12,2) AS agreed_amount,
    COALESCE(jb.currency, j.currency, 'GBP') AS currency,
    COALESCE(j.updated_at, jb.created_at, now()) AS agreed_at,
    j.created_by AS created_by
  FROM public.jobs j
  JOIN public.job_bids jb
    ON jb.job_id = j.id
   AND jb.status::text = 'accepted'
   AND jb.company_id = j.awarded_carrier_company_id
   AND jb.amount > 0
  WHERE j.awarded_carrier_company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.job_commercial_agreements existing
      WHERE existing.job_id = j.id
    )
    AND 1 = (
      SELECT count(*)
      FROM public.job_bids accepted_bid
      WHERE accepted_bid.job_id = j.id
        AND accepted_bid.status::text = 'accepted'
        AND accepted_bid.company_id = j.awarded_carrier_company_id
        AND accepted_bid.amount > 0
    )
)
INSERT INTO public.job_commercial_agreements (
  job_id,
  bid_id,
  buyer_company_id,
  supplier_company_id,
  agreed_amount,
  currency,
  agreed_at,
  created_by
)
SELECT
  job_id,
  bid_id,
  buyer_company_id,
  supplier_company_id,
  agreed_amount,
  currency,
  agreed_at,
  created_by
FROM deterministic_agreements
ON CONFLICT (job_id) DO NOTHING;

CREATE TEMP TABLE invoice_snapshot_repair_targets
ON COMMIT DROP
AS
SELECT i.id
FROM public.invoices i
JOIN public.job_commercial_agreements agreement
  ON agreement.job_id = i.job_id
 AND agreement.supplier_company_id = i.company_id
WHERE i.commercial_agreement_id IS DISTINCT FROM agreement.id
   OR i.buyer_company_id IS DISTINCT FROM agreement.buyer_company_id
   OR i.supplier_company_id IS DISTINCT FROM agreement.supplier_company_id
   OR i.invoice_origin IS DISTINCT FROM 'marketplace'
   OR COALESCE(i.amount, 0) <= 0
   OR COALESCE(i.net_amount, 0) <= 0
   OR abs(COALESCE(i.net_amount, 0) - agreement.agreed_amount) > 0.01
   OR abs(COALESCE(i.vat_amount, 0) - agreement.vat_amount) > 0.01
   OR abs(COALESCE(i.amount, 0) - agreement.agreed_gross_amount) > 0.01
   OR NULLIF(btrim(COALESCE(i.client_name, '')), '') IS NULL
   OR NULLIF(btrim(COALESCE(i.pickup_location, '')), '') IS NULL
   OR NULLIF(btrim(COALESCE(i.delivery_location, '')), '') IS NULL;

-- Rebuild marketplace invoice data from the accepted commercial agreement and
-- the immutable transport record. Existing non-empty counterparty data is kept.
UPDATE public.invoices invoice
SET
  commercial_agreement_id = agreement.id,
  buyer_company_id = agreement.buyer_company_id,
  supplier_company_id = agreement.supplier_company_id,
  invoice_origin = 'marketplace',
  client_name = COALESCE(
    NULLIF(btrim(invoice.client_name), ''),
    NULLIF(btrim(job.client_name), ''),
    NULLIF(btrim(buyer.name), ''),
    'Customer'
  ),
  client_email = COALESCE(
    NULLIF(btrim(invoice.client_email), ''),
    NULLIF(btrim(job.client_email), ''),
    NULLIF(btrim(buyer.email), '')
  ),
  pickup_location = COALESCE(NULLIF(btrim(invoice.pickup_location), ''), job.pickup_location),
  pickup_datetime = COALESCE(invoice.pickup_datetime, job.pickup_datetime),
  delivery_location = COALESCE(NULLIF(btrim(invoice.delivery_location), ''), job.delivery_location),
  delivery_datetime = COALESCE(invoice.delivery_datetime, job.delivery_datetime),
  service_description = COALESCE(
    NULLIF(btrim(invoice.service_description), ''),
    NULLIF(btrim(job.load_details::text), ''),
    'Transport service'
  ),
  job_ref = COALESCE(
    NULLIF(btrim(invoice.job_ref), ''),
    NULLIF(btrim(job.customer_reference), ''),
    'JOB-' || upper(left(job.id::text, 8))
  ),
  net_amount = agreement.agreed_amount,
  vat_rate = agreement.vat_rate,
  vat_amount = agreement.vat_amount,
  amount = agreement.agreed_gross_amount,
  currency = agreement.currency,
  payment_terms = agreement.payment_terms,
  due_date = invoice.invoice_date + agreement.payment_due_days,
  updated_at = now()
FROM public.job_commercial_agreements agreement
JOIN public.jobs job ON job.id = agreement.job_id
JOIN public.companies buyer ON buyer.id = agreement.buyer_company_id
WHERE invoice.id IN (SELECT id FROM invoice_snapshot_repair_targets)
  AND invoice.job_id = agreement.job_id
  AND invoice.company_id = agreement.supplier_company_id;

-- A legacy state-only submit must not remain customer-visible. Real delivery is
-- proven by provider acceptance plus the stored private PDF. Reset only repaired
-- malformed rows; paid/disputed records are left for finance review.
UPDATE public.invoices invoice
SET
  status = 'Pending'::public.invoice_status,
  submitted_at = NULL,
  submitted_by = NULL,
  delivery_state = CASE
    WHEN invoice.delivery_state = 'sending' THEN 'failed'
    ELSE 'idle'
  END,
  delivery_error = CASE
    WHEN invoice.delivery_state = 'sending'
      THEN 'Legacy invoice delivery was interrupted and requires a controlled resend.'
    ELSE invoice.delivery_error
  END,
  delivery_provider = NULL,
  delivery_message_id = NULL,
  delivery_recipient_email = NULL,
  updated_at = now()
WHERE invoice.id IN (SELECT id FROM invoice_snapshot_repair_targets)
  AND lower(invoice.status::text) IN ('submitted', 'approved')
  AND (
    invoice.delivery_state IS DISTINCT FROM 'sent'
    OR NULLIF(btrim(COALESCE(invoice.delivery_provider, '')), '') IS NULL
    OR NULLIF(btrim(COALESCE(invoice.delivery_message_id, '')), '') IS NULL
    OR NULLIF(btrim(COALESCE(invoice.delivery_recipient_email, '')), '') IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.invoice_documents document
      WHERE document.invoice_id = invoice.id
        AND document.doc_type = 'invoice_pdf'
        AND NULLIF(btrim(document.file_url), '') IS NOT NULL
    )
  );

-- Customers may read a carrier invoice only after it leaves Draft, contains a
-- complete positive snapshot, and has proven provider delivery (or is already
-- recorded as paid). Carrier-side access remains governed by the member policy.
DROP POLICY IF EXISTS invoices_job_owner_read ON public.invoices;
CREATE POLICY invoices_job_owner_read ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    job_id IS NOT NULL
    AND lower(status::text) NOT IN ('pending', 'draft', 'cancelled')
    AND COALESCE(amount, 0) > 0
    AND COALESCE(net_amount, 0) > 0
    AND NULLIF(btrim(COALESCE(client_name, '')), '') IS NOT NULL
    AND (
      lower(status::text) = 'paid'
      OR lower(payment_status::text) = 'paid'
      OR (
        delivery_state = 'sent'
        AND NULLIF(btrim(COALESCE(delivery_provider, '')), '') IS NOT NULL
        AND NULLIF(btrim(COALESCE(delivery_message_id, '')), '') IS NOT NULL
        AND NULLIF(btrim(COALESCE(delivery_recipient_email, '')), '') IS NOT NULL
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.jobs job
      WHERE job.id = invoices.job_id
        AND public.is_company_member(job.company_id)
    )
  );

CREATE OR REPLACE FUNCTION public.fn_validate_invoice_snapshot_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  agreement public.job_commercial_agreements%ROWTYPE;
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
  IF abs(NEW.amount - (NEW.net_amount + NEW.vat_amount)) > 0.01 THEN
    RAISE EXCEPTION 'Invoice total must equal net amount plus VAT.' USING ERRCODE = '23514';
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

DROP TRIGGER IF EXISTS trg_validate_invoice_snapshot_integrity ON public.invoices;
CREATE TRIGGER trg_validate_invoice_snapshot_integrity
BEFORE INSERT OR UPDATE OF
  invoice_number,
  job_ref,
  job_id,
  company_id,
  client_name,
  amount,
  net_amount,
  vat_amount,
  vat_rate,
  currency,
  invoice_origin,
  commercial_agreement_id,
  buyer_company_id,
  supplier_company_id,
  status,
  delivery_state,
  delivery_provider,
  delivery_message_id,
  delivery_recipient_email
ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.fn_validate_invoice_snapshot_integrity();

COMMIT;

NOTIFY pgrst, 'reload schema';
