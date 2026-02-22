-- ============================================================
-- Fix: ensure all expected columns exist on the quotes table.
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

  -- Ensure the vehicle_type enum exists before using it
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'vehicle_type'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.vehicle_type AS ENUM (
      'bicycle', 'motorbike', 'car', 'van_small', 'van_large',
      'luton', 'truck_7_5t', 'truck_18t', 'artic'
    );
  END IF;

  ALTER TABLE public.quotes
    ADD COLUMN IF NOT EXISTS vehicle_type public.vehicle_type,
    ADD COLUMN IF NOT EXISTS cargo_type   public.cargo_type,
    ADD COLUMN IF NOT EXISTS currency     text DEFAULT 'GBP',
    ADD COLUMN IF NOT EXISTS status       text DEFAULT 'draft';
EXCEPTION WHEN undefined_table THEN
  NULL; -- quotes table doesn't exist yet; migration 003_auto_fix.sql creates it
        -- with all required columns, so no action needed here.
END
$$;
