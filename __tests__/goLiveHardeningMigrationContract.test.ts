import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const OWNER_AUDIT_INDEX_MIGRATION =
  'supabase/migrations/20260904214000_add_owner_audit_log_target_company_index.sql';
const LEGACY_RPC_RESTRICTION_MIGRATION =
  'supabase/migrations/20260904222500_restrict_legacy_governance_security_definer_rpcs.sql';
const BROAD_RLS_DRIFT_MIGRATION =
  'supabase/migrations/20260904223500_remove_hosted_broad_invoice_company_rls_drift.sql';
const DRIVER_SELF_SERVICE_GUARD_MIGRATION =
  'supabase/migrations/20260904225000_guard_driver_self_service_protected_fields.sql';
const POD_STORAGE_OPERATOR_GUARD_MIGRATION =
  'supabase/migrations/20260904230000_harden_pod_storage_operator_insert.sql';
const ANON_SECURITY_DEFINER_MIGRATION =
  'supabase/migrations/20260904231500_close_anonymous_security_definer_rpc_surface.sql';
const SERVICE_ONLY_RECONCILIATION_MIGRATION =
  'supabase/migrations/20260904232000_reconcile_service_only_security_definer_privileges.sql';

const LEGACY_GOVERNANCE_FUNCTIONS = [
  'approve_company',
  'reject_company',
  'submit_company_for_review',
  'create_driver_invite',
] as const;

const BROAD_INVOICE_POLICIES = [
  'invoices_delete_member',
  'invoices_insert_authenticated',
  'invoices_insert_member',
  'invoices_select_authenticated',
  'invoices_select_member',
  'invoices_update_authenticated',
  'invoices_update_member',
] as const;

const BROAD_JOB_POLICIES = [
  'jobs_insert_authenticated',
  'jobs_update_authenticated',
] as const;

const BROAD_VEHICLE_POLICIES = [
  'vehicles_insert_authenticated',
  'vehicles_update_authenticated',
] as const;

const BROAD_ONBOARDING_POLICIES = [
  'onboarding_insert_own',
  'onboarding_update_own_limited',
] as const;

const PROTECTED_DRIVER_FIELDS = [
  'user_id',
  'company_id',
  'status',
  'app_access',
  'temporary_password_seq',
  'must_change_password',
  'temp_password_generated_at',
  'international_work_approved',
  'driver_type',
  'can_commercial_bid',
] as const;

const SERVICE_ONLY_SECURITY_DEFINERS = [
  'public.promote_to_platform_owner(text)',
  'public.driver_operational_eligibility(uuid)',
  'public.register_duplicate_document_fraud_case(uuid,uuid,uuid,uuid,uuid,text,text,uuid,text,uuid)',
  'public.assert_onboarding_compliance_ready(uuid)',
  'public.ensure_company_driver_onboarding(uuid,uuid,text,text)',
  'public.has_active_company_membership(uuid,uuid)',
  'public.identity_registry_allows_driver_access(uuid,uuid)',
  'public.submit_individual_driver_onboarding(uuid)',
] as const;

const AUTHENTICATED_SECURITY_DEFINER_HELPERS = [
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
  'public.is_current_driver(uuid)',
] as const;

const TRIGGER_ONLY_SECURITY_DEFINERS = [
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
  'public.trigger_notify_operational_event()',
] as const;

describe('PR #500 go-live hardening migration contracts', () => {
  it('adds the owner audit company index without mutating business data', () => {
    const migration = readRepoFile(OWNER_AUDIT_INDEX_MIGRATION);

    expect(migration).toContain('CREATE INDEX IF NOT EXISTS idx_owner_audit_log_target_company_id');
    expect(migration).toContain('ON public.owner_audit_log (target_company_id)');
    expect(migration).toContain("SET LOCAL lock_timeout = '10s'");
    expect(migration).toContain("SET LOCAL statement_timeout = '120s'");
    expect(migration).not.toContain('DELETE FROM public.owner_audit_log');
    expect(migration).not.toContain('UPDATE public.owner_audit_log');
  });

  it('restricts only the known legacy SECURITY DEFINER governance RPC names', () => {
    const migration = readRepoFile(LEGACY_RPC_RESTRICTION_MIGRATION);

    expect(migration).toContain("n.nspname = 'public'");
    expect(migration).toContain('AND p.prosecdef');

    for (const functionName of LEGACY_GOVERNANCE_FUNCTIONS) {
      expect(migration).toContain(`'${functionName}'`);
    }

    expect(migration).toContain(
      "'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated'",
    );
    expect(migration).toContain("'GRANT EXECUTE ON FUNCTION %s TO service_role'");
    expect(migration).not.toContain('DROP FUNCTION');
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION');
    expect(migration).not.toContain('TO authenticated');
  });

  it('removes only hosted broad mutation RLS drift and preserves canonical policies', () => {
    const migration = readRepoFile(BROAD_RLS_DRIFT_MIGRATION);

    for (const policyName of BROAD_INVOICE_POLICIES) {
      expect(migration).toContain(`DROP POLICY IF EXISTS ${policyName} ON public.invoices`);
    }
    for (const policyName of BROAD_JOB_POLICIES) {
      expect(migration).toContain(`DROP POLICY IF EXISTS ${policyName} ON public.jobs`);
    }
    for (const policyName of BROAD_VEHICLE_POLICIES) {
      expect(migration).toContain(`DROP POLICY IF EXISTS ${policyName} ON public.vehicles`);
    }
    for (const policyName of BROAD_ONBOARDING_POLICIES) {
      expect(migration).toContain(`DROP POLICY IF EXISTS ${policyName} ON public.onboarding_applications`);
    }
    expect(migration).toContain('DROP POLICY IF EXISTS companies_update_member ON public.companies');

    expect(migration).not.toContain('DROP POLICY IF EXISTS invoices_select_non_driver');
    expect(migration).not.toContain('DROP POLICY IF EXISTS invoices_insert_operator');
    expect(migration).not.toContain('DROP POLICY IF EXISTS invoices_update_creator_or_admin');
    expect(migration).not.toContain('DROP POLICY IF EXISTS invoices_delete_creator_or_admin');
    expect(migration).not.toContain('DROP POLICY IF EXISTS invoices_job_owner_read');
    expect(migration).not.toContain('DROP POLICY IF EXISTS owner_select_all_invoices');

    expect(migration).not.toContain('DROP POLICY IF EXISTS jobs_insert_operator');
    expect(migration).not.toContain('DROP POLICY IF EXISTS jobs_update_creator_or_admin');
    expect(migration).not.toContain('DROP POLICY IF EXISTS jobs_update_assigned_driver');
    expect(migration).not.toContain('DROP POLICY IF EXISTS jobs_awarded_update_only_awarded_carrier');

    expect(migration).not.toContain('DROP POLICY IF EXISTS vehicles_insert_operator');
    expect(migration).not.toContain('DROP POLICY IF EXISTS vehicles_insert_driver_or_operator');
    expect(migration).not.toContain('DROP POLICY IF EXISTS vehicles_update_driver_or_operator');
    expect(migration).not.toContain('DROP POLICY IF EXISTS vehicles_delete_driver_or_operator');

    expect(migration).not.toContain('DROP POLICY IF EXISTS onboarding_applications_owner_insert');
    expect(migration).not.toContain('DROP POLICY IF EXISTS onboarding_applications_owner_update');

    expect(migration).not.toContain('DELETE FROM public.invoices');
    expect(migration).not.toContain('UPDATE public.invoices');
    expect(migration).not.toContain('UPDATE public.companies');
    expect(migration).not.toContain('UPDATE public.jobs');
    expect(migration).not.toContain('UPDATE public.vehicles');
    expect(migration).not.toContain('UPDATE public.onboarding_applications');
  });

  it('blocks driver self-service privilege escalation while preserving safe preference writes', () => {
    const migration = readRepoFile(DRIVER_SELF_SERVICE_GUARD_MIGRATION);

    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.guard_driver_self_service_protected_fields()');
    expect(migration).toContain('SECURITY INVOKER');
    expect(migration).toContain('IF OLD.user_id = v_actor THEN');
    for (const fieldName of PROTECTED_DRIVER_FIELDS) {
      expect(migration).toContain(`NEW.${fieldName} IS DISTINCT FROM OLD.${fieldName}`);
    }

    expect(migration).toContain('BEFORE UPDATE ON public.drivers');
    expect(migration).toContain("USING ERRCODE = '42501'");
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.guard_driver_self_service_protected_fields() FROM PUBLIC, anon, authenticated');
    expect(migration).not.toContain('availability_status IS DISTINCT FROM');
    expect(migration).not.toContain('destination_priority_enabled IS DISTINCT FROM');
    expect(migration).not.toContain('destination_radius_miles IS DISTINCT FROM');
    expect(migration).not.toContain('UPDATE public.drivers');
  });

  it('requires company-operator authority for the non-driver POD upload path', () => {
    const migration = readRepoFile(POD_STORAGE_OPERATOR_GUARD_MIGRATION);

    expect(migration).toContain('DROP POLICY IF EXISTS "pod_photos_insert_operator_for_accessible_job" ON storage.objects');
    expect(migration).toContain('public.is_company_operator(public.auth_company_id())');
    expect(migration).toContain("bucket_id = 'pod-photos'");
    expect(migration).toContain('j.company_id = public.auth_company_id()');
    expect(migration).toContain('j.assigned_company_id = public.auth_company_id()');
    expect(migration).toContain('j.awarded_carrier_company_id = public.auth_company_id()');
    expect(migration).not.toContain('d.user_id = auth.uid()');
    expect(migration).not.toContain('UPDATE storage.objects');
    expect(migration).not.toContain('DELETE FROM storage.objects');
  });

  it('closes anonymous SECURITY DEFINER RPC access with production-safe optional reconciliation', () => {
    const migration = readRepoFile(ANON_SECURITY_DEFINER_MIGRATION);
    const reconciliation = readRepoFile(SERVICE_ONLY_RECONCILIATION_MIGRATION);

    expect(migration).toContain('IF to_regprocedure(v_signature) IS NOT NULL THEN');
    expect(migration).toContain("'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated'");
    expect(migration).toContain("'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon'");
    expect(migration).toContain("'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role'");
    expect(migration).toContain("'GRANT EXECUTE ON FUNCTION %s TO service_role'");

    for (const signature of SERVICE_ONLY_SECURITY_DEFINERS) {
      expect(migration).toContain(`'${signature}'`);
      expect(reconciliation).toContain(`'${signature}'`);
    }
    for (const signature of AUTHENTICATED_SECURITY_DEFINER_HELPERS) {
      expect(migration).toContain(`'${signature}'`);
    }
    for (const signature of TRIGGER_ONLY_SECURITY_DEFINERS) {
      expect(migration).toContain(`'${signature}'`);
    }

    expect(migration).toContain("p.proname <> 'st_estimatedextent'");
    expect(migration).toContain("'ALTER FUNCTION %s SET search_path = public, pg_temp'");
    expect(reconciliation).toContain("'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated'");
    expect(reconciliation).toContain("'GRANT EXECUTE ON FUNCTION %s TO service_role'");
    expect(migration).not.toContain('DROP FUNCTION');
    expect(reconciliation).not.toContain('DROP FUNCTION');
  });
});
