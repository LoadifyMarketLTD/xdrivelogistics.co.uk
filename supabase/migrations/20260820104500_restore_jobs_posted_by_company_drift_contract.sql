BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Clean-replay bridge for historical production drift.
-- Production already has this nullable UUID column and index, but the repository
-- migration chain did not create them before 20260820105000 first references
-- jobs.posted_by_company_id. Reproduce only the observed structural contract;
-- do not backfill data, add authority semantics, or invent a foreign key.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS posted_by_company_id uuid;

CREATE INDEX IF NOT EXISTS idx_jobs_posted_by_company
  ON public.jobs (posted_by_company_id);

COMMIT;
