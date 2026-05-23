-- ════════════════════════════════════════════════════════════════════════════
-- Migration 039 — Schema Reconciliation
-- Purpose: Ensure all runtime-critical functions exist in production.
--          This migration is fully idempotent (CREATE OR REPLACE / IF NOT EXISTS).
--          Safe to re-run against a database that already has all items.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. next_invoice_number ────────────────────────────────────────────────
-- Added in migrations 014/017 but absent from database/schema.sql.
-- Called by app/admin/invoices/[id]/page.tsx when saving an invoice.
-- Without this function invoice creation throws a 42883 error.
CREATE OR REPLACE FUNCTION public.next_invoice_number(p_company_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prefix text;
  v_count  int;
BEGIN
  -- Advisory lock prevents concurrent calls generating the same number.
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text));

  v_prefix := 'INV-' || to_char(now(), 'YYYYMM') || '-';
  SELECT COUNT(*) + 1
    INTO v_count
    FROM public.invoices
   WHERE company_id = p_company_id
     AND invoice_number LIKE v_prefix || '%';
  RETURN v_prefix || lpad(v_count::text, 3, '0');
END;
$$;

-- Unique constraint as safety net alongside the advisory lock.
ALTER TABLE public.invoices
  ADD CONSTRAINT IF NOT EXISTS invoices_company_invoice_number_unique
  UNIQUE (company_id, invoice_number);

-- ── 2. is_current_driver ─────────────────────────────────────────────────
-- Added in migration 035 but absent from database/schema.sql.
-- Referenced in RLS policies on driver_locations and job_bids.
-- Without this function those policies throw 42883 at query time.
CREATE OR REPLACE FUNCTION public.is_current_driver(did uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = did
      AND d.user_id = auth.uid()
  );
$$;

-- ── 3. Verify vehicles.reg_plate exists ──────────────────────────────────
-- Column is in schema.sql and migration 001 — confirmed present.
-- This DO block is a runtime assertion; it raises if the column is somehow
-- missing so the migration fails loudly rather than silently.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vehicles'
      AND column_name  = 'reg_plate'
  ) THEN
    RAISE EXCEPTION 'vehicles.reg_plate is missing — manual repair required before proceeding.';
  END IF;
END;
$$;

-- ── 4. Orphaned column documentation ─────────────────────────────────────
-- companies.legal_name and companies.trading_name were added to the
-- companies table via manual production repair.  These columns are NOT read
-- or written by any frontend page (settings writes to company_settings, not
-- companies).  They are dead columns.
-- Action: after confirming both columns are always NULL in production, drop
-- them with a follow-up migration.  For now, add comments so the intent is
-- recorded in the schema history.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'companies'
      AND column_name  = 'legal_name'
  ) THEN
    COMMENT ON COLUMN public.companies.legal_name IS
      'Orphaned column added via manual repair. Not read/written by any frontend page. '
      'Drop once confirmed always NULL in production.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'companies'
      AND column_name  = 'trading_name'
  ) THEN
    COMMENT ON COLUMN public.companies.trading_name IS
      'Orphaned column added via manual repair. Not read/written by any frontend page. '
      'Drop once confirmed always NULL in production.';
  END IF;
END;
$$;

-- ── 5. Grant execute permissions ─────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_driver(uuid)   TO authenticated;

COMMIT;
