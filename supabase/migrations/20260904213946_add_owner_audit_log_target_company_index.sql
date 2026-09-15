-- Hosted migration-history reconciliation for the owner_audit_log FK index.
--
-- Production received this exact forward-only index migration at version
-- 20260904213946 before the repository copy was committed as 20260904214000.
-- Keep this idempotent file so Supabase Preview/branch replay can reconcile the
-- real hosted migration ledger without rewriting Production migration history.
-- The later 20260904214000 migration remains intentionally idempotent.

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
