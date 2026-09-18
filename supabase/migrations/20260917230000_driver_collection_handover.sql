-- Structured collection handover for Driver app and multi-stop execution.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS collection_handover jsonb;

ALTER TABLE public.job_stops
  ADD COLUMN IF NOT EXISTS handover jsonb;

ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_collection_handover_object_chk;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_collection_handover_object_chk
  CHECK (collection_handover IS NULL OR jsonb_typeof(collection_handover) = 'object');

ALTER TABLE public.job_stops
  DROP CONSTRAINT IF EXISTS job_stops_handover_object_chk;
ALTER TABLE public.job_stops
  ADD CONSTRAINT job_stops_handover_object_chk
  CHECK (handover IS NULL OR jsonb_typeof(handover) = 'object');

COMMENT ON COLUMN public.jobs.collection_handover IS 'Server-authoritative structured collection handover snapshot captured by the assigned driver.';
COMMENT ON COLUMN public.job_stops.handover IS 'Server-authoritative structured handover snapshot for a multi-stop execution stop.';
NOTIFY pgrst, 'reload schema';
COMMIT;
