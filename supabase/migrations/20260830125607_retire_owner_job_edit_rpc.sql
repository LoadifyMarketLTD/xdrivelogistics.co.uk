BEGIN;
DROP FUNCTION IF EXISTS public.update_unbid_exchange_job_atomic(uuid, uuid, jsonb, jsonb, boolean, integer);
COMMIT;
