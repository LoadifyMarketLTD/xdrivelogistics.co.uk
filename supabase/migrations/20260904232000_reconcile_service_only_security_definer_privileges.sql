-- Corrective convergence for preview/hosted environments that may already have
-- replayed an earlier privilege grant. Keep these sensitive SECURITY DEFINER
-- helpers service-only. Missing branch/legacy functions remain untouched.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

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
    IF v_proc IS NOT NULL THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        v_signature
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO service_role',
        v_signature
      );

      IF has_function_privilege('anon', v_proc, 'EXECUTE')
         OR has_function_privilege('authenticated', v_proc, 'EXECUTE')
         OR NOT has_function_privilege('service_role', v_proc, 'EXECUTE') THEN
        RAISE EXCEPTION 'Service-only SECURITY DEFINER privilege contract failed for %.', v_signature;
      END IF;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
