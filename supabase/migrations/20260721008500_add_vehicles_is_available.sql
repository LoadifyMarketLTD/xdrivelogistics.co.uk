-- Canonical vehicle availability flag used by allocation and marketplace compliance.
-- Earlier functions and staging fixtures referenced vehicles.is_available without
-- materializing the column on a clean installation.

BEGIN;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS is_available boolean;

UPDATE public.vehicles
SET is_available = true
WHERE is_available IS NULL;

ALTER TABLE public.vehicles
  ALTER COLUMN is_available SET DEFAULT true,
  ALTER COLUMN is_available SET NOT NULL;

COMMENT ON COLUMN public.vehicles.is_available IS
  'Operational availability flag used for allocation, compliance and marketplace visibility.';

NOTIFY pgrst, 'reload schema';

COMMIT;
