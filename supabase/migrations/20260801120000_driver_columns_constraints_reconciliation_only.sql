BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'drivers'
      AND column_name = 'driver_type'
  ) THEN
    RAISE EXCEPTION 'driver_type column must already exist before applying this reconciliation unit.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'drivers'
      AND column_name = 'can_commercial_bid'
  ) THEN
    RAISE EXCEPTION 'can_commercial_bid column must already exist before applying this reconciliation unit.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.drivers
    WHERE driver_type IS NULL
       OR driver_type NOT IN ('owner_driver', 'company_driver')
  ) THEN
    RAISE EXCEPTION 'drivers.driver_type contains NULL or non-canonical values; fix data before applying constraint-only reconciliation.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.drivers
    WHERE can_commercial_bid IS NULL
  ) THEN
    RAISE EXCEPTION 'drivers.can_commercial_bid contains NULL values; fix data before applying constraint-only reconciliation.';
  END IF;
END
$$;

ALTER TABLE public.drivers
  ALTER COLUMN driver_type SET DEFAULT 'company_driver';

ALTER TABLE public.drivers
  ALTER COLUMN driver_type SET NOT NULL;

ALTER TABLE public.drivers
  DROP CONSTRAINT IF EXISTS drivers_driver_type_check;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_driver_type_check
  CHECK (driver_type IN ('owner_driver', 'company_driver'));

ALTER TABLE public.drivers
  ALTER COLUMN can_commercial_bid SET DEFAULT true;

ALTER TABLE public.drivers
  ALTER COLUMN can_commercial_bid SET NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
