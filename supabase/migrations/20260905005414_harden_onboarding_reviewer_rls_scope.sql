-- Hosted migration-history reconciliation alias.
-- Production recorded harden_onboarding_reviewer_rls_scope at 20260905005414
-- while the canonical repository migration is 20260904233500. The canonical
-- migration runs first on fresh replay; this file verifies the converged policy
-- set rather than re-creating non-idempotent policies a second time.

BEGIN;

DO $$
DECLARE
  v_legacy integer;
  v_canonical integer;
BEGIN
  SELECT count(*)
  INTO v_legacy
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (tablename = 'onboarding_applications' AND policyname = 'reviewers_read_onboarding_applications')
      OR (tablename = 'company_documents' AND policyname = 'reviewers_read_company_documents')
      OR (tablename = 'driver_identity_documents' AND policyname = 'reviewers_read_driver_identity_documents')
    );

  SELECT count(*)
  INTO v_canonical
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (tablename = 'onboarding_applications' AND policyname = 'onboarding_applications_select_tenant_reviewer')
      OR (tablename = 'company_documents' AND policyname = 'company_documents_select_tenant_reviewer')
      OR (tablename = 'driver_identity_documents' AND policyname = 'driver_identity_documents_select_tenant_reviewer')
    );

  IF v_legacy <> 0 OR v_canonical <> 3 THEN
    RAISE EXCEPTION 'Onboarding reviewer RLS convergence failed: legacy %, canonical %.', v_legacy, v_canonical;
  END IF;
END;
$$;

COMMIT;
