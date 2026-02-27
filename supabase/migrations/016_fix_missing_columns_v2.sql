-- ============================================================
-- 016_fix_missing_columns_v2.sql
--
-- Ensures the columns that cause "Could not find … in the
-- schema cache" errors are present:
--
--   • drivers.display_name  — required by the Add Driver form
--   • vehicles.company_id   — required by the Add Vehicle form
--   • quotes.company_id     — required by the New Quote form
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.
-- On a database created from migration 001 onwards these
-- columns already exist and the statements become no-ops.
-- ============================================================

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS company_id uuid
    REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS company_id uuid
    REFERENCES public.companies(id) ON DELETE CASCADE;

-- Force PostgREST to rebuild its schema cache so the columns
-- are visible immediately without restarting the project.
NOTIFY pgrst, 'reload schema';
