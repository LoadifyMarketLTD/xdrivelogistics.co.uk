-- PR #301 — Driver schema convergence for the production mobile API.
--
-- The application and mobile API use drivers.driver_type and
-- drivers.can_commercial_bid, but some existing Supabase environments were
-- created before those columns were applied. This migration is intentionally
-- idempotent and preserves an explicit false can_commercial_bid value.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS driver_type text;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS can_commercial_bid boolean;

-- Canonical XDrive driver identity:
--   owner_driver   = self-operated identity without an employer company
--   company_driver = driver operating for one linked carrier company
-- Retired or unknown values are normalised before the constraint is applied.
UPDATE public.drivers
SET driver_type = CASE
  WHEN company_id IS NULL THEN 'owner_driver'
  ELSE 'company_driver'
END
WHERE driver_type IS NULL
   OR driver_type NOT IN ('owner_driver', 'company_driver');

-- Only fill missing values. A deliberate false value is an explicit revocation
-- and must not be silently changed by this compatibility migration.
UPDATE public.drivers
SET can_commercial_bid = true
WHERE can_commercial_bid IS NULL;

ALTER TABLE public.drivers
  DROP CONSTRAINT IF EXISTS drivers_driver_type_check;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_driver_type_check
  CHECK (driver_type IN ('owner_driver', 'company_driver'));

ALTER TABLE public.drivers
  ALTER COLUMN driver_type SET DEFAULT 'company_driver',
  ALTER COLUMN driver_type SET NOT NULL,
  ALTER COLUMN can_commercial_bid SET DEFAULT true,
  ALTER COLUMN can_commercial_bid SET NOT NULL;

COMMENT ON COLUMN public.drivers.driver_type IS
  'Canonical driver identity: owner_driver or company_driver.';

COMMENT ON COLUMN public.drivers.can_commercial_bid IS
  'Explicit permission for the driver to submit marketplace quotations for their canonical commercial identity.';

NOTIFY pgrst, 'reload schema';

COMMIT;
