-- Canonical operational status for fleet vehicles.
-- Required by company_compliance_issues() and staging operations validation.

BEGIN;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.vehicles
SET status = 'active'
WHERE status IS NULL
   OR btrim(status) = '';

ALTER TABLE public.vehicles
  ALTER COLUMN status SET DEFAULT 'active',
  ALTER COLUMN status SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_company_status
  ON public.vehicles (company_id, status);

COMMENT ON COLUMN public.vehicles.status IS
  'Operational vehicle status used for compliance and fleet eligibility.';

NOTIFY pgrst, 'reload schema';

COMMIT;
