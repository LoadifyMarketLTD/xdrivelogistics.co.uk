-- PR #357-compatible removal of the legacy completion-side invoice generator.
--
-- Current Marketplace invoices are generated idempotently by the application
-- server from the immutable job_commercial_agreements snapshot. Some historical
-- live databases can still contain trg_generate_invoice_on_job_completion,
-- which generates a competing draft from mutable job data. Clean PR #357
-- rebuilds do not define that trigger, so this migration is a safe no-op there.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP TRIGGER IF EXISTS trg_generate_invoice_on_job_completion ON public.jobs;

DO $$
BEGIN
  IF to_regprocedure('public.fn_generate_invoice_on_job_completion()') IS NOT NULL THEN
    COMMENT ON FUNCTION public.fn_generate_invoice_on_job_completion() IS
      'Legacy completion invoice function retained for audit/history only. Its trigger is disabled; canonical Marketplace invoice generation is application-owned and uses the immutable commercial agreement snapshot.';
  END IF;
END
$$;

COMMIT;
