-- Canonical carrier-company assignment for marketplace jobs.
-- Driver APIs, allocation RPCs and native clients already consume this field,
-- but historical clean installs did not materialize it.

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS assigned_company_id uuid
    REFERENCES public.companies(id) ON DELETE SET NULL;

UPDATE public.jobs
SET assigned_company_id = awarded_carrier_company_id
WHERE assigned_company_id IS NULL
  AND awarded_carrier_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_company_status
  ON public.jobs (assigned_company_id, status)
  WHERE assigned_company_id IS NOT NULL;

COMMENT ON COLUMN public.jobs.assigned_company_id IS
  'Carrier company responsible for the allocated job; distinct from the buyer company in jobs.company_id.';

NOTIFY pgrst, 'reload schema';

COMMIT;
