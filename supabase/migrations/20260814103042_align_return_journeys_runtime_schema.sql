-- XDrive Logistics — Return Journeys runtime schema alignment
-- Purpose: reconcile the pre-existing legacy return_journeys table with the
-- runtime contract used by the Driver Return Journeys APIs.
--
-- Deliberate compatibility decisions:
--   * legacy from_location / to_location / available_date columns are retained;
--   * vehicle_type remains TEXT for now because the live public.vehicle_type
--     enum is not yet fully aligned with the canonical application slugs;
--   * RLS policies are retained unchanged; the API uses the authenticated
--     driver context and service-role server client for exchange reads/writes.

DO $$
BEGIN
  IF to_regclass('public.return_journeys') IS NULL THEN
    RAISE EXCEPTION 'public.return_journeys does not exist';
  END IF;
  IF to_regclass('public.drivers') IS NULL THEN
    RAISE EXCEPTION 'public.drivers does not exist';
  END IF;
  IF to_regclass('public.companies') IS NULL THEN
    RAISE EXCEPTION 'public.companies does not exist';
  END IF;
END
$$;

ALTER TABLE public.return_journeys
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS vehicle_type text,
  ADD COLUMN IF NOT EXISTS from_postcode text,
  ADD COLUMN IF NOT EXISTS to_postcode text,
  ADD COLUMN IF NOT EXISTS available_from timestamptz,
  ADD COLUMN IF NOT EXISTS available_to timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text;

-- Preserve any legacy rows if this migration is ever replayed against a
-- database that contains historical return journeys.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'return_journeys'
      AND column_name = 'from_location'
  ) THEN
    EXECUTE $sql$
      UPDATE public.return_journeys
      SET from_postcode = COALESCE(from_postcode, from_location)
      WHERE from_postcode IS NULL AND from_location IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'return_journeys'
      AND column_name = 'to_location'
  ) THEN
    EXECUTE $sql$
      UPDATE public.return_journeys
      SET to_postcode = COALESCE(to_postcode, to_location)
      WHERE to_postcode IS NULL AND to_location IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'return_journeys'
      AND column_name = 'available_date'
  ) THEN
    EXECUTE $sql$
      UPDATE public.return_journeys
      SET available_from = COALESCE(available_from, available_date)
      WHERE available_from IS NULL AND available_date IS NOT NULL
    $sql$;
  END IF;
END
$$;

-- Recover company ownership from the linked driver when possible.
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

-- company_id is part of the canonical runtime ownership contract. Abort rather
-- than silently inventing ownership if an unrecoverable historical row exists.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.return_journeys WHERE company_id IS NULL) THEN
    RAISE EXCEPTION 'return_journeys contains rows without recoverable company_id';
  END IF;
END
$$;

ALTER TABLE public.return_journeys
  ALTER COLUMN company_id SET NOT NULL;

-- Canonical ownership FK: a company deletion removes its exchange declarations.
ALTER TABLE public.return_journeys
  DROP CONSTRAINT IF EXISTS return_journeys_company_id_fkey;
ALTER TABLE public.return_journeys
  ADD CONSTRAINT return_journeys_company_id_fkey
  FOREIGN KEY (company_id)
  REFERENCES public.companies(id)
  ON DELETE CASCADE;

-- Canonical driver FK: the company journey can survive driver removal and be
-- reconciled operationally instead of being deleted implicitly.
ALTER TABLE public.return_journeys
  DROP CONSTRAINT IF EXISTS return_journeys_driver_id_fkey;
ALTER TABLE public.return_journeys
  ADD CONSTRAINT return_journeys_driver_id_fkey
  FOREIGN KEY (driver_id)
  REFERENCES public.drivers(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_return_journeys_company_id
  ON public.return_journeys (company_id);
CREATE INDEX IF NOT EXISTS idx_return_journeys_driver_id
  ON public.return_journeys (driver_id);
CREATE INDEX IF NOT EXISTS idx_return_journeys_available_from
  ON public.return_journeys (available_from);
CREATE INDEX IF NOT EXISTS idx_return_journeys_status
  ON public.return_journeys (status);

COMMENT ON COLUMN public.return_journeys.vehicle_type IS
  'Canonical XDrive vehicle slug stored as text pending global public.vehicle_type enum reconciliation.';
