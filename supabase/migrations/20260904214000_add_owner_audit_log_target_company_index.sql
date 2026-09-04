-- Go-live hardening: index owner_audit_log.target_company_id.
-- Forward-only, no business data mutation.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE INDEX IF NOT EXISTS idx_owner_audit_log_target_company_id
  ON public.owner_audit_log (target_company_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'owner_audit_log'
      AND indexname = 'idx_owner_audit_log_target_company_id'
  ) THEN
    RAISE EXCEPTION 'owner_audit_log target_company_id index was not created.';
  END IF;
END;
$$;

COMMIT;
