-- ============================================================
-- 018_add_drivers_email.sql
--
-- Ensures the email column exists on the drivers table.
-- Fixes "Could not find the 'email' column of 'drivers' in
-- the schema cache" error when adding a driver.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is idempotent.
-- ============================================================

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS email text;

-- Reload the PostgREST schema cache so the column is visible
-- immediately without restarting the project.
NOTIFY pgrst, 'reload schema';
