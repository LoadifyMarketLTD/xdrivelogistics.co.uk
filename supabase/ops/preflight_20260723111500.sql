-- Preflight check for 20260723111500_invoice_snapshot_integrity.sql
--
-- Run this BEFORE applying migration 20260723111500.
--
-- Returns one row per invoice that will be affected by the migration.
-- Columns:
--   snapshot_will_be_rebuilt        → invoice amounts, parties, location, dates will be overwritten
--   status_will_be_reset_to_pending → status reset from 'submitted'/'approved' to 'Pending';
--                                     submitted_at, submitted_by, delivery fields will be nullified
--
-- GATE: Review every row where status_will_be_reset_to_pending = true.
-- Confirm each is acceptable before proceeding with the migration.
--
-- Safe to run read-only at any time.
-- Note: deterministic_agreements CTE mirrors the INSERT logic in the migration but does
-- not modify data — it only identifies jobs that would receive a new agreement row.

WITH deterministic_agreements AS (
  SELECT
    j.id                                               AS job_id,
    jb.id                                              AS bid_id,
    j.company_id                                       AS buyer_company_id,
    jb.company_id                                      AS supplier_company_id,
    jb.amount::numeric(12, 2)                          AS agreed_amount,
    COALESCE(jb.currency, j.currency, 'GBP')           AS currency,
    COALESCE(j.updated_at, jb.created_at, now())       AS agreed_at,
    j.created_by                                       AS created_by
  FROM public.jobs j
  JOIN public.job_bids jb
    ON  jb.job_id  = j.id
    AND jb.status::text = 'accepted'
    AND jb.company_id = j.awarded_carrier_company_id
    AND jb.amount > 0
  WHERE j.awarded_carrier_company_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.job_commercial_agreements e
      WHERE e.job_id = j.id
    )
    AND 1 = (
      SELECT count(*)
      FROM public.job_bids ab
      WHERE ab.job_id  = j.id
        AND ab.status::text = 'accepted'
        AND ab.company_id = j.awarded_carrier_company_id
        AND ab.amount > 0
    )
),
-- Combine existing agreements with those that would be created by the migration
all_agreements AS (
  SELECT job_id, supplier_company_id, id,
         agreed_amount, vat_amount, agreed_gross_amount
  FROM public.job_commercial_agreements
  UNION ALL
  SELECT da.job_id, da.supplier_company_id, NULL::uuid,
         da.agreed_amount, 0.00, da.agreed_amount  -- vat_amount/agreed_gross_amount approximation
  FROM deterministic_agreements da
),
repair_targets AS (
  SELECT i.id
  FROM public.invoices i
  JOIN public.job_commercial_agreements a
    ON  a.job_id            = i.job_id
    AND a.supplier_company_id = i.company_id
  WHERE i.commercial_agreement_id IS DISTINCT FROM a.id
     OR i.buyer_company_id        IS DISTINCT FROM a.buyer_company_id
     OR i.supplier_company_id     IS DISTINCT FROM a.supplier_company_id
     OR i.invoice_origin          IS DISTINCT FROM 'marketplace'
     OR COALESCE(i.amount, 0)     <= 0
     OR COALESCE(i.net_amount, 0) <= 0
     OR abs(COALESCE(i.net_amount, 0)  - a.agreed_amount)       > 0.01
     OR abs(COALESCE(i.vat_amount, 0)  - a.vat_amount)          > 0.01
     OR abs(COALESCE(i.amount, 0)      - a.agreed_gross_amount)  > 0.01
     OR NULLIF(btrim(COALESCE(i.client_name,      '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(i.pickup_location,  '')), '') IS NULL
     OR NULLIF(btrim(COALESCE(i.delivery_location,'')), '') IS NULL
),
status_reset_targets AS (
  SELECT i.id
  FROM public.invoices i
  WHERE i.id IN (SELECT id FROM repair_targets)
    AND lower(i.status::text) IN ('submitted', 'approved')
    AND (
      i.delivery_state IS DISTINCT FROM 'sent'
      OR NULLIF(btrim(COALESCE(i.delivery_provider,          '')), '') IS NULL
      OR NULLIF(btrim(COALESCE(i.delivery_message_id,        '')), '') IS NULL
      OR NULLIF(btrim(COALESCE(i.delivery_recipient_email,   '')), '') IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.invoice_documents doc
        WHERE doc.invoice_id  = i.id
          AND doc.doc_type    = 'invoice_pdf'
          AND NULLIF(btrim(doc.file_url), '') IS NOT NULL
      )
    )
)
SELECT
  i.id                                              AS invoice_id,
  i.invoice_number,
  i.status::text                                    AS current_status,
  i.amount,
  i.net_amount,
  i.company_id                                      AS supplier_company_id,
  i.buyer_company_id,
  i.job_id,
  i.created_at,
  (i.id IN (SELECT id FROM repair_targets))         AS snapshot_will_be_rebuilt,
  (i.id IN (SELECT id FROM status_reset_targets))   AS status_will_be_reset_to_pending
FROM public.invoices i
WHERE i.id IN (SELECT id FROM repair_targets)
ORDER BY i.created_at, i.id;
