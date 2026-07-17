-- Migration 054: vehicles manufacture_year column
--
-- Purpose:
--   Add a manufacture_year column to the vehicles table so the admin UI
--   can store and display the manufacturing year of each vehicle.
--   The column was missing from the original schema.
--
--   Column: manufacture_year  integer  (e.g. 2019)
--   Nullable so existing vehicle records are unaffected.
--
--   Reload PostgREST schema cache at end.

BEGIN;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS manufacture_year integer;

-- Optional: a lightweight sanity check — values should be 4-digit years.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  c.conname = 'vehicles_manufacture_year_range'
      AND  n.nspname = 'public'
      AND  t.relname = 'vehicles'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_manufacture_year_range
        CHECK (manufacture_year IS NULL OR (manufacture_year >= 1900 AND manufacture_year <= 2100));
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
