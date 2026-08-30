-- Fresh/live vehicle readiness physical-contract reconciliation.
--
-- The owner-approved driver_operational_eligibility() contract requires an
-- assigned vehicle to be active. Production already has vehicles.status and
-- vehicles.is_available, but clean replay history can omit both columns.
--
-- Clean replay reconstructs public.status_enum from migration 001 because that
-- is the hosted lifecycle type shared by drivers.status and vehicles.status.
-- Materialise a missing vehicle status column directly with that canonical type
-- rather than creating text drift that would need a late conversion under RLS.
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
  IF to_regtype('public.status_enum') IS NULL THEN
    RAISE EXCEPTION 'Canonical public.status_enum is missing before vehicle readiness reconciliation.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicles'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.vehicles
      ADD COLUMN status public.status_enum DEFAULT 'active'::public.status_enum;
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