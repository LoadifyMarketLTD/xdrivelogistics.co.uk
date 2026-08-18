-- Remove the legacy completion-side invoice generator from the live job table.
-- It creates buyer/supplier draft rows from mutable job pricing without the
-- immutable commercial_agreement_id required by the current invoice integrity
-- contract, so it can roll back a valid delivered -> completed transition.
-- Automatic Marketplace invoicing remains owned by autoGenerateMarketplaceInvoice
-- after canonical driver delivery; manual/direct invoice routes remain unchanged.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP TRIGGER IF EXISTS trg_generate_invoice_on_job_completion ON public.jobs;

DO $$
BEGIN
  IF to_regprocedure('public.fn_generate_invoice_on_job_completion()') IS NOT NULL THEN
    COMMENT ON FUNCTION public.fn_generate_invoice_on_job_completion() IS
      'Legacy completion invoice function retained for audit/history only. The trigger is intentionally disabled; canonical Marketplace invoice generation uses the immutable commercial agreement through the application server boundary.';
  END IF;
END;
$$;

COMMIT;
