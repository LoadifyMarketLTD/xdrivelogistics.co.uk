-- Canonical driver availability flag used by compliance, award and lifecycle RPCs.
-- Earlier migrations referenced drivers.is_active but never materialized the
-- column on a clean installation.

BEGIN;

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS is_active boolean;

UPDATE public.drivers
SET is_active = true
WHERE is_active IS NULL;

ALTER TABLE public.drivers
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

COMMENT ON COLUMN public.drivers.is_active IS
  'Operational activation flag. A driver must be active, approved and have app access to execute jobs.';

NOTIFY pgrst, 'reload schema';

COMMIT;
