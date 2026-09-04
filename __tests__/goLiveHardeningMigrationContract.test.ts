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
});
