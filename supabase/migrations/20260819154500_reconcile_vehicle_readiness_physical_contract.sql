-- Fresh/live vehicle readiness physical-contract reconciliation.
--
-- The owner-approved driver_operational_eligibility() contract requires an
-- assigned vehicle to be active. Production already has vehicles.status and
-- vehicles.is_available, but clean replay history can omit both columns.
--
-- This migration is intentionally narrow and forward-only:
-- - existing Production columns and values are untouched;
-- - missing clean-replay columns are materialised with live-compatible defaults;
-- - no vehicle rows are rewritten;
-- - no UI, RLS, award, Finance, or lifecycle semantics are changed.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicles'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.vehicles
      ADD COLUMN status text DEFAULT 'active';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicles'
      AND column_name = 'is_available'
  ) THEN
    ALTER TABLE public.vehicles
      ADD COLUMN is_available boolean DEFAULT true;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
