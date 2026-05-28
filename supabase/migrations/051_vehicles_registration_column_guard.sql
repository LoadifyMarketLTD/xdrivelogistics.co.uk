-- Migration 051: vehicles.registration column guard
--
-- Problem:
--   The production database has a `registration TEXT NOT NULL` column on
--   the vehicles table that was never added via a migration. When the Add
--   Vehicle or Edit Vehicle form submits it only sends `reg_plate`, leaving
--   `registration` as NULL which violates the constraint:
--
--     "null value in column "registration" of relation "vehicles"
--      violates not-null constraint"
--
-- Fix:
--   1. Add `registration text` idempotently (no-op on fresh DBs built from
--      migration 001 if the column is already absent; adds it as nullable on
--      production where it existed with NOT NULL).
--   2. Drop the NOT NULL constraint if it is present — `reg_plate` is the
--      canonical column; `registration` is a legacy alias kept for
--      back-compatibility.
--   3. Back-fill `registration` from `reg_plate` for any existing rows.
--   4. Reload the PostgREST schema cache.

BEGIN;

-- Step 1: ensure the column exists (nullable by default when added here)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS registration text;

-- Step 2: drop NOT NULL constraint if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'vehicles'
      AND  column_name  = 'registration'
      AND  is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.vehicles
      ALTER COLUMN registration DROP NOT NULL;
  END IF;
END;
$$;

-- Step 3: back-fill any rows that have reg_plate set but registration NULL
UPDATE public.vehicles
SET    registration = reg_plate
WHERE  registration IS NULL
  AND  reg_plate    IS NOT NULL;

-- Step 4: reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
