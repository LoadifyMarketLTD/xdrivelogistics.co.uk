-- Go-live hardening: close clean-replay anonymous RPC exposure on selected
-- SECURITY DEFINER functions without removing authenticated execution from the
-- helpers that RLS/client flows legitimately compose.
--
-- Production already has the three service-only functions below locked to
-- service_role, but a clean Supabase preview replay revealed explicit anon grants.
-- This migration makes repository replay converge to the production authority
-- boundary and also removes direct client EXECUTE from trigger-only functions.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Platform/operational functions whose source contract is service-only.
REVOKE EXECUTE ON FUNCTION public.promote_to_platform_owner(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_platform_owner(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.driver_operational_eligibility(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_operational_eligibility(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.register_duplicate_document_fraud_case(uuid, uuid, uuid, uuid, uuid, text, text, uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_duplicate_document_fraud_case(uuid, uuid, uuid, uuid, uuid, text, text, uuid, text, uuid) TO service_role;

-- Authenticated/RLS helpers: anonymous RPC execution is never required. Remove
-- PUBLIC/anon inheritance explicitly, then reassert the authenticated contract.
REVOKE EXECUTE ON FUNCTION public.assert_onboarding_compliance_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_onboarding_compliance_ready(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.auth_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_company_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.bootstrap_owner_driver_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_owner_driver_workspace() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_admin_manage_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_admin_manage_job(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_driver_access_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_driver_access_job(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_driver_update_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_driver_update_job(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_non_driver_access_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_non_driver_access_job(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_operator_access_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_operator_access_job(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_read_marketplace_execution_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_marketplace_execution_job(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.ensure_company_driver_onboarding(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_company_driver_onboarding(uuid, uuid, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_active_company_membership(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_company_membership(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.identity_registry_allows_driver_access(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.identity_registry_allows_driver_access(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_company_non_driver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_non_driver(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_company_operator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_current_driver(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_driver(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.submit_individual_driver_onboarding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_individual_driver_onboarding(uuid) TO authenticated, service_role;

-- Trigger-only functions are invoked by PostgreSQL triggers, never as browser RPCs.
REVOKE EXECUTE ON FUNCTION public.enforce_onboarding_approval_compliance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_apply_invoice_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_assign_invoice_origin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_auto_allocate_on_driver_assign() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_complete_commercial_agreement_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_guard_invoice_overpayment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_job_bids_autofill() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_job_bids_compliance_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_jobs_mvp_guardrails() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_lock_accepted_bid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_lock_commercial_agreement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_log_invoice_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_normalize_invoice_payment_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_notify_bid_accepted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_notify_invoice_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_notify_job_assigned() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_notify_pod_uploaded() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_job_status_from_invoice() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_company_status_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_direct_invite_bid_acceptance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_notify_operational_event() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enforce_onboarding_approval_compliance() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_apply_invoice_payment() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_assign_invoice_origin() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_auto_allocate_on_driver_assign() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_complete_commercial_agreement_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_guard_invoice_overpayment() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_job_bids_autofill() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_job_bids_compliance_guard() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_jobs_mvp_guardrails() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_lock_accepted_bid() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_lock_commercial_agreement() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_log_invoice_status_change() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_normalize_invoice_payment_history() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_notify_bid_accepted() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_notify_invoice_created() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_notify_job_assigned() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_notify_pod_uploaded() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_sync_job_status_from_invoice() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_company_status_update() TO service_role;
GRANT EXECUTE ON FUNCTION public.guard_direct_invite_bid_acceptance() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_notify_operational_event() TO service_role;

-- Close search_path warnings on legacy RLS helpers without changing their bodies.
ALTER FUNCTION public.can_admin_manage_job(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_driver_access_job(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_driver_update_job(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_non_driver_access_job(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_operator_access_job(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_current_driver(uuid) SET search_path = public, pg_temp;

DO $$
DECLARE
  v_bad_anon integer;
  v_bad_service integer;
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

  SELECT count(*)
  INTO v_bad_service
  FROM (VALUES
    ('promote_to_platform_owner(text)'::regprocedure),
    ('driver_operational_eligibility(uuid)'::regprocedure),
    ('register_duplicate_document_fraud_case(uuid,uuid,uuid,uuid,uuid,text,text,uuid,text,uuid)'::regprocedure)
  ) expected(proc_oid)
  WHERE has_function_privilege('anon', expected.proc_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', expected.proc_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', expected.proc_oid, 'EXECUTE');

  IF v_bad_service <> 0 THEN
    RAISE EXCEPTION 'Service-only SECURITY DEFINER privilege contract failed for % function(s).', v_bad_service;
  END IF;
END;
$$;

COMMIT;
