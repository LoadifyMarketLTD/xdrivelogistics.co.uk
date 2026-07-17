-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 128 — Finance Foundation Final
--
-- Purpose:
--   1) Enforce marketplace invoice idempotency at DB level
--   2) Harden invoice_origin defaults and non-null guarantees
--   3) Backfill NULL/legacy invoice_origin values where classification is safe
--
-- Rollback notes (manual):
--   - DROP INDEX public.invoices_marketplace_commercial_agreement_unique;
--   - DROP INDEX public.invoices_marketplace_generation_idempotency_unique;
--   - ALTER TABLE public.invoices DROP CONSTRAINT invoices_marketplace_generation_idempotency_required;
--   - ALTER TABLE public.invoices ALTER COLUMN invoice_origin DROP NOT NULL;
--   - ALTER TABLE public.invoices ALTER COLUMN invoice_origin DROP DEFAULT;
--   - Optional: ALTER TABLE public.invoices DROP COLUMN invoice_generation_idempotency_key;
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_generation_idempotency_key text;

-- Keep the classifier deterministic for new rows.
ALTER TABLE public.invoices
  ALTER COLUMN invoice_origin SET DEFAULT 'manual';

-- Ensure trigger also classifies non-marketplace job invoices as direct.
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
    IF NEW.job_id IS NOT NULL THEN
      NEW.invoice_origin := 'direct';
    ELSE
      NEW.invoice_origin := 'manual';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Safe backfill for origin classification.
UPDATE public.invoices
SET invoice_origin = 'marketplace'
WHERE invoice_origin IS NULL
  AND (
    commercial_agreement_id IS NOT NULL
    OR (buyer_company_id IS NOT NULL AND supplier_company_id IS NOT NULL)
  );

UPDATE public.invoices
SET invoice_origin = 'direct'
WHERE invoice_origin IS NULL
  AND job_id IS NOT NULL;

UPDATE public.invoices
SET invoice_origin = 'manual'
WHERE invoice_origin IS NULL;

ALTER TABLE public.invoices
  ALTER COLUMN invoice_origin SET NOT NULL;

-- Backfill marketplace keys to satisfy required/not-null-for-marketplace enforcement.
UPDATE public.invoices
SET invoice_generation_idempotency_key = id::text
WHERE invoice_origin = 'marketplace'
  AND invoice_generation_idempotency_key IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_marketplace_generation_idempotency_required'
      AND conrelid = 'public.invoices'::regclass
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_marketplace_generation_idempotency_required
      CHECK (
        invoice_origin <> 'marketplace'
        OR invoice_generation_idempotency_key IS NOT NULL
      );
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_marketplace_commercial_agreement_unique
  ON public.invoices (commercial_agreement_id)
  WHERE invoice_origin = 'marketplace' AND commercial_agreement_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_marketplace_generation_idempotency_unique
  ON public.invoices (invoice_generation_idempotency_key)
  WHERE invoice_origin = 'marketplace' AND invoice_generation_idempotency_key IS NOT NULL;

COMMIT;
