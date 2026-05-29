-- Migration 053: driver columns guard
--
-- Purpose:
--   Ensure all driver columns expected by the admin UI exist in production.
--   Several columns were added in earlier migrations (015, 025) but may be
--   absent from databases that were provisioned from incomplete snapshots.
--
--   Columns guarded:
--     last_app_login         — used in drivers list (DRIVER_SELECT_COLUMNS)
--     temporary_password_seq — used in drivers list and temp-password flow
--     temp_password_generated_at — used in temp-password flow
--     must_change_password   — used in driver app-access gating
--     app_access             — used in driver app-access gating + middleware
--
--   This migration is fully idempotent (ADD COLUMN IF NOT EXISTS).
--   Safe to re-run on any database.

BEGIN;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS last_app_login            timestamptz,
  ADD COLUMN IF NOT EXISTS must_change_password      boolean     DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_access                boolean     DEFAULT true,
  ADD COLUMN IF NOT EXISTS temp_password_generated_at timestamptz;

-- temporary_password_seq depends on a sequence; add it only if absent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'drivers'
      AND  column_name  = 'temporary_password_seq'
  ) THEN
    -- Create backing sequence if missing
    IF NOT EXISTS (
      SELECT 1 FROM pg_sequences
      WHERE schemaname = 'public' AND sequencename = 'driver_temp_password_seq'
    ) THEN
      CREATE SEQUENCE public.driver_temp_password_seq;
    END IF;

    ALTER TABLE public.drivers
      ADD COLUMN temporary_password_seq integer DEFAULT nextval('public.driver_temp_password_seq');
  END IF;
END;
$$;

-- Reload PostgREST schema cache so new columns are immediately queryable.
NOTIFY pgrst, 'reload schema';

COMMIT;
