-- Migration 106: Deduplicate jobs updated_at triggers
BEGIN;

DROP TRIGGER IF EXISTS jobs_updated_at ON public.jobs;
DROP TRIGGER IF EXISTS set_jobs_updated_at ON public.jobs;

CREATE TRIGGER trg_jobs_set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMIT;
