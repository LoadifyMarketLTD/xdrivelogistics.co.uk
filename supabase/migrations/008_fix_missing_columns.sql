-- ============================================================
-- Fix: ensure the three columns reported missing in the
-- PostgREST schema cache actually exist on their tables.
-- Idempotent — safe to run on any database state.
-- ============================================================

DO $$
BEGIN
  -- Ensure the cargo_type enum exists before using it
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'cargo_type'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.cargo_type AS ENUM (
      'documents', 'packages', 'pallets', 'furniture', 'equipment', 'other'
    );
  END IF;

  -- ── drivers.display_name ─────────────────────────────────
  -- Required by the "Add Driver" form. If the table was
  -- created from an older schema it may be absent.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'drivers'
      AND column_name  = 'display_name'
  ) THEN
    ALTER TABLE public.drivers ADD COLUMN display_name text;
  END IF;

  -- ── vehicles.company_id ──────────────────────────────────
  -- Required by the "Add Vehicle" form. If the table was
  -- created from an older schema it may be absent.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vehicles'
      AND column_name  = 'company_id'
  ) THEN
    ALTER TABLE public.vehicles
      ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;

  -- ── quotes.cargo_type ────────────────────────────────────
  -- Required by the "New Quote" form. Covered by migration
  -- 005 but repeated here in case that migration was not run.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'quotes'
      AND column_name  = 'cargo_type'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN cargo_type public.cargo_type;
  END IF;
END
$$;

-- Notify PostgREST to reload its schema cache immediately so
-- the new columns are visible without a server restart.
NOTIFY pgrst, 'reload schema';
