-- PR #357-compatible Return Journeys runtime schema reconciliation.
--
-- The approved PR #357 UI/API already consumes the canonical Return Journeys
-- fields. This migration only makes older database shapes compatible with that
-- existing runtime contract; it does not alter routes, RLS or workspace UI.
--
-- Existing rows are preserved. Recoverable legacy values are copied forward,
-- company ownership is derived only from the linked driver, and unrecoverable
-- historical NULL ownership is left intact rather than invented. A NOT VALID
-- check enforces company ownership for new/updated rows while allowing old data
-- to be reconciled separately.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF to_regclass('public.return_journeys') IS NULL THEN
    RAISE EXCEPTION 'public.return_journeys does not exist';
  END IF;
END
$$;

ALTER TABLE public.return_journeys
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS from_postcode text,
  ADD COLUMN IF NOT EXISTS to_postcode text,
  ADD COLUMN IF NOT EXISTS available_from timestamptz,
  ADD COLUMN IF NOT EXISTS available_to timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text;

-- The clean bootstrap historically used public.vehicle_type while the runtime
-- accepts canonical application slugs as text. Preserve values and remove that
-- enum coupling where an older database still has it.
DO $$
DECLARE
  v_data_type text;
BEGIN
  SELECT c.data_type
  INTO v_data_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'return_journeys'
    AND c.column_name = 'vehicle_type';

  IF v_data_type IS NULL THEN
    ALTER TABLE public.return_journeys ADD COLUMN vehicle_type text;
  ELSIF v_data_type = 'USER-DEFINED' THEN
    ALTER TABLE public.return_journeys
      ALTER COLUMN vehicle_type TYPE text USING vehicle_type::text;
  ELSIF v_data_type <> 'text' THEN
    RAISE EXCEPTION 'Unsupported return_journeys.vehicle_type type: %', v_data_type
      USING ERRCODE = '42804';
  END IF;
END
$$;

-- Preserve legacy location/date fields when they exist. Dynamic SQL ensures a
-- clean PR #357 database that never had those columns remains a no-op.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'return_journeys' AND column_name = 'from_location'
  ) THEN
    EXECUTE 'UPDATE public.return_journeys SET from_postcode = COALESCE(from_postcode, from_location) WHERE from_postcode IS NULL AND from_location IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'return_journeys' AND column_name = 'to_location'
  ) THEN
    EXECUTE 'UPDATE public.return_journeys SET to_postcode = COALESCE(to_postcode, to_location) WHERE to_postcode IS NULL AND to_location IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'return_journeys' AND column_name = 'available_date'
  ) THEN
    EXECUTE 'UPDATE public.return_journeys SET available_from = COALESCE(available_from, available_date::timestamptz) WHERE available_from IS NULL AND available_date IS NOT NULL';
  END IF;
END
$$;

-- Recover ownership only from an existing canonical driver relationship.
UPDATE public.return_journeys rj
SET company_id = d.company_id
FROM public.drivers d
WHERE rj.company_id IS NULL
  AND rj.driver_id = d.id
  AND d.company_id IS NOT NULL;

UPDATE public.return_journeys
SET status = 'available'
WHERE status IS NULL OR btrim(status) = '';

ALTER TABLE public.return_journeys
  ALTER COLUMN status SET DEFAULT 'available';

-- Do not invent ownership for unrecoverable historical rows. New and touched
-- rows must, however, satisfy the runtime ownership contract.
ALTER TABLE public.return_journeys
  DROP CONSTRAINT IF EXISTS return_journeys_company_required;
ALTER TABLE public.return_journeys
  ADD CONSTRAINT return_journeys_company_required
  CHECK (company_id IS NOT NULL) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_return_journeys_company_id
  ON public.return_journeys (company_id);
CREATE INDEX IF NOT EXISTS idx_return_journeys_driver_id
  ON public.return_journeys (driver_id);
CREATE INDEX IF NOT EXISTS idx_return_journeys_available_from
  ON public.return_journeys (available_from);
CREATE INDEX IF NOT EXISTS idx_return_journeys_status
  ON public.return_journeys (status);

COMMENT ON COLUMN public.return_journeys.vehicle_type IS
  'Canonical XDrive vehicle slug stored as text so Return Journeys is not coupled to the historical vehicle_type enum.';

COMMIT;
