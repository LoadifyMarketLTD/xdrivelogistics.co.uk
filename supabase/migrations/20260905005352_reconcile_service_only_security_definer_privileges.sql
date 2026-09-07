-- Hosted migration-history reconciliation alias.
-- Production recorded reconcile_service_only_security_definer_privileges at
-- 20260905005352 while the canonical repository migration is 20260904232000.
-- Fresh replay executes the canonical privilege convergence first; this file
-- verifies the hosted-version effect without rewriting Production history.

BEGIN;

DO $$
DECLARE
  v_signature text;
  v_proc regprocedure;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.promote_to_platform_owner(text)',
    'public.driver_operational_eligibility(uuid)',
    'public.register_duplicate_document_fraud_case(uuid,uuid,uuid,uuid,uuid,text,text,uuid,text,uuid)',
    'public.assert_onboarding_compliance_ready(uuid)',
    'public.ensure_company_driver_onboarding(uuid,uuid,text,text)',
    'public.has_active_company_membership(uuid,uuid)',
    'public.identity_registry_allows_driver_access(uuid,uuid)',
    'public.submit_individual_driver_onboarding(uuid)'
  ] LOOP
    v_proc := to_regprocedure(v_signature);
    IF v_proc IS NOT NULL AND (
      has_function_privilege('anon', v_proc, 'EXECUTE')
      OR has_function_privilege('authenticated', v_proc, 'EXECUTE')
      OR NOT has_function_privilege('service_role', v_proc, 'EXECUTE')
    ) THEN
      RAISE EXCEPTION 'Service-only SECURITY DEFINER privilege contract is not converged for %.', v_signature;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
