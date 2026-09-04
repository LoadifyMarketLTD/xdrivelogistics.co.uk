-- Go-live hardening: close clean-replay anonymous RPC exposure on selected
-- SECURITY DEFINER functions while preserving only the execution roles required
-- by each canonical contract.
--
-- Production already has the sensitive service-only functions locked down, while
-- a clean Supabase preview replay exposed several of them to anon/authenticated.
-- Every function is treated as optional here so the migration is safe across the
-- current hosted schema and clean repository replay; missing legacy/branch-only
-- functions are not recreated.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
DECLARE
  v_signature text;
BEGIN
  -- Service-only helpers. Their source/runtime contract is internal composition
  -- or server/service-role execution; no browser RPC caller needs EXECUTE.
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
    IF to_regprocedure(v_signature) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        v_signature
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO service_role',
        v_signature
      );
    END IF;
  END LOOP;

  -- Authenticated/RLS helpers whose arguments are bound to the current caller or
  -- whose canonical client flow intentionally invokes them. Anonymous execution
  -- is not required; authenticated/service_role execution is reasserted.
  FOREACH v_signature IN ARRAY ARRAY[
    'public.auth_company_id()',
    'public.bootstrap_owner_driver_workspace()',
    'public.can_admin_manage_job(uuid)',
    'public.can_driver_access_job(uuid)',
    'public.can_driver_update_job(uuid)',
    'public.can_non_driver_access_job(uuid)',
    'public.can_operator_access_job(uuid)',
    'public.can_read_marketplace_execution_job(uuid)',
    'public.is_company_admin(uuid)',
    'public.is_company_member(uuid)',
    'public.is_company_non_driver(uuid)',
    'public.is_company_operator(uuid)',
    'public.is_current_driver(uuid)'
  ] LOOP
    IF to_regprocedure(v_signature) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
        v_signature
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
        v_signature
      );
    END IF;
  END LOOP;

  -- Trigger-only functions are invoked by PostgreSQL triggers, never as browser
  -- RPCs. Keep service_role available for controlled diagnostics only.
  FOREACH v_signature IN ARRAY ARRAY[
    'public.enforce_onboarding_approval_compliance()',
    'public.fn_apply_invoice_payment()',
    'public.fn_assign_invoice_origin()',
    'public.fn_auto_allocate_on_driver_assign()',
    'public.fn_complete_commercial_agreement_snapshot()',
    'public.fn_guard_invoice_overpayment()',
    'public.fn_job_bids_autofill()',
    'public.fn_job_bids_compliance_guard()',
    'public.fn_jobs_mvp_guardrails()',
    'public.fn_lock_accepted_bid()',
    'public.fn_lock_commercial_agreement()',
    'public.fn_log_invoice_status_change()',
    'public.fn_normalize_invoice_payment_history()',
    'public.fn_notify_bid_accepted()',
    'public.fn_notify_invoice_created()',
    'public.fn_notify_job_assigned()',
    'public.fn_notify_pod_uploaded()',
    'public.fn_sync_job_status_from_invoice()',
    'public.guard_company_status_update()',
    'public.guard_direct_invite_bid_acceptance()',
    'public.trigger_notify_operational_event()'
  ] LOOP
    IF to_regprocedure(v_signature) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
        v_signature
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO service_role',
        v_signature
      );
    END IF;
  END LOOP;
END;
$$;

-- Close search_path warnings on legacy RLS helpers without changing their bodies.
DO $$
DECLARE
  v_signature text;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.can_admin_manage_job(uuid)',
    'public.can_driver_access_job(uuid)',
    'public.can_driver_update_job(uuid)',
    'public.can_non_driver_access_job(uuid)',
    'public.can_operator_access_job(uuid)',
    'public.is_current_driver(uuid)'
  ] LOOP
    IF to_regprocedure(v_signature) IS NOT NULL THEN
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = public, pg_temp',
        v_signature
      );
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  v_bad_anon integer;
  v_signature text;
  v_proc regprocedure;
BEGIN
  SELECT count(*)
  INTO v_bad_anon
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.proname <> 'st_estimatedextent'
    AND has_function_privilege('anon', p.oid, 'EXECUTE');

  IF v_bad_anon <> 0 THEN
    RAISE EXCEPTION 'Non-PostGIS anonymous SECURITY DEFINER RPCs remain: %', v_bad_anon;
  END IF;

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
      RAISE EXCEPTION 'Service-only SECURITY DEFINER privilege contract failed for %.', v_signature;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
