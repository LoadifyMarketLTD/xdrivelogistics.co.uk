-- Canonical text lifecycle state used alongside jobs.status by web, native driver,
-- allocation, POD and invoice workflows. Historical clean installs did not
-- materialize this column even though later RPCs and API routes require it.

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS current_status text;

UPDATE public.jobs
SET current_status = COALESCE(NULLIF(btrim(status::text), ''), 'draft')
WHERE current_status IS NULL
   OR btrim(current_status) = '';

ALTER TABLE public.jobs
  ALTER COLUMN current_status SET DEFAULT 'draft',
  ALTER COLUMN current_status SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_company_current_status
  ON public.jobs (company_id, current_status);

COMMENT ON COLUMN public.jobs.current_status IS
  'Canonical operational lifecycle state mirrored by job creation, award, driver execution, POD and completion workflows.';

NOTIFY pgrst, 'reload schema';

COMMIT;
