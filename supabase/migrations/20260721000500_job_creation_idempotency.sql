-- Prevent browser retries and repeated button presses from creating duplicate jobs.
-- Apply on staging before deploying the server-side job creation route.

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS creation_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_company_creation_idempotency_uidx
  ON public.jobs (company_id, creation_idempotency_key)
  WHERE creation_idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.jobs.creation_idempotency_key IS
  'Client-generated UUID reused for retries of the same create-job action.';

COMMIT;
