-- Backup: invoices rows that will be rebuilt by
-- migration 20260723111500_invoice_snapshot_integrity.sql
--
-- Run this BEFORE applying migration 20260723111500.
-- Table is created with IF NOT EXISTS — safe to re-run.
-- The backup captures the full invoice row as it exists right now.
-- To restore, query the backup table and UPDATE the live table manually.

CREATE TABLE IF NOT EXISTS public.backup_20260723111500_invoices AS
WITH repair_targets AS (
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
)
SELECT
  now() AS backed_up_at,
  i.*
FROM public.invoices i
WHERE i.id IN (SELECT id FROM repair_targets);
