-- Prevent duplicate active quotes for the same carrier company on the same job.
--
-- Business rule:
--   A carrier may have at most one active quote per job at a time.
--   Active statuses are limited to the canonical bid lifecycle:
--     submitted, accepted
--
-- Why:
--   Application routes already reject duplicates, but service-role writes or
--   direct PostgREST inserts could still race and create duplicate active bids.
--   Enforce the rule at the database layer as the final backstop.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS job_bids_active_company_job_unique
  ON public.job_bids (job_id, company_id)
  WHERE company_id IS NOT NULL
    AND status IN ('submitted', 'accepted');

COMMIT;
