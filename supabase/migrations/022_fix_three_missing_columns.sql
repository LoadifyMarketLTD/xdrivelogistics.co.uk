-- ============================================================
-- 022_fix_three_missing_columns.sql
--
-- Targeted, idempotent fix for the three columns confirmed
-- MISSING by the live schema verification query:
--
--   • company_memberships.updated_at
--   • drivers.app_access
--   • profiles.is_driver
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is a no-op when the
-- column already exists.  No FK references, no CREATE TABLE,
-- no dependencies that can fail on a partial schema.
-- ============================================================

ALTER TABLE public.company_memberships
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS app_access boolean DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_driver boolean DEFAULT false;

-- Reload the PostgREST schema cache so all three columns are
-- immediately visible without restarting the project.
NOTIFY pgrst, 'reload schema';
