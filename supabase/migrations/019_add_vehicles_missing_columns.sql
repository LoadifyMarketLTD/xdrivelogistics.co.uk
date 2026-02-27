-- ============================================================
-- 019_add_vehicles_missing_columns.sql
--
-- Ensures the vehicles table has all columns required by the
-- Add Vehicle form, fixing "Could not find … in the schema
-- cache" errors:
--
--   • vehicles.has_tail_lift    — checkbox on the Add Vehicle form
--   • vehicles.has_straps       — related capability column
--   • vehicles.has_blankets     — related capability column
--   • vehicles.pallets_capacity — capacity field
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.
-- On a database created from migration 001 onwards these
-- columns already exist and the statements become no-ops.
-- ============================================================

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS has_tail_lift      boolean DEFAULT false;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS has_straps         boolean DEFAULT false;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS has_blankets       boolean DEFAULT false;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS pallets_capacity   int;

-- Reload the PostgREST schema cache so the columns are visible
-- immediately without restarting the project.
NOTIFY pgrst, 'reload schema';
