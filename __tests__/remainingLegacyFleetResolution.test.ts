import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('remaining legacy Fleet resolution', () => {
  it('classifies unbound historical Fleet applications from provenance without inferred bindings', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260830211000_resolve_remaining_legacy_fleet_company_shells.sql',
    );

    expect(migration).toContain("'KEEP'");
    expect(migration).toContain("'keep_unbound_no_company'");
    expect(migration).toContain("'MIGRATE'");
    expect(migration).toContain("'quarantine_legacy_active_shell'");
    expect(migration).toContain("oa.payload->>'legacy_persisted_account_type' = 'fleet_operator'");
    expect(migration).toContain('(SELECT count(*) FROM public.companies c2 WHERE c2.created_by = oa.user_id) = 1');
    expect(migration).toContain('P0-12 found a legacy Fleet application without sufficient provenance');
    expect(migration).not.toContain('DELETE FROM public.companies');
    expect(migration).not.toContain('DELETE FROM public.onboarding_applications');
    expect(migration).not.toContain("SET status = 'approved'");
  });

  it('keeps hosted-only legacy dependency evidence conditional instead of recreating retired tables', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260830211000_resolve_remaining_legacy_fleet_company_shells.sql',
    );

    expect(migration).toContain('p0_12_optional_dependency_exists');
    expect(migration).toContain("to_regclass(format('public.%I', p_relation)) IS NULL");
    expect(migration).toContain("p0_12_optional_dependency_exists('company_members', 'company_id', c.id, 'user_id', oa.user_id)");
    expect(migration).toContain("p0_12_optional_dependency_exists('company_business_types', 'company_id', c.id)");
    expect(migration).toContain("p0_12_optional_dependency_exists('invites', 'company_id', c.id)");
    expect(migration).toContain("p0_12_optional_dependency_exists('workspace_switch_audit', 'target_company_id', c.id)");
    expect(migration).toContain('DROP FUNCTION IF EXISTS public.p0_12_optional_dependency_exists');
    expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS public.company_members');
    expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS public.invites');
    expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS public.company_business_types');
    expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS public.workspace_switch_audit');
  });

  it('quarantines only dependency-free legacy active shells through canonical governance', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260830211000_resolve_remaining_legacy_fleet_company_shells.sql',
    );

    expect(migration).toContain('NOT EXISTS (SELECT 1 FROM public.company_memberships');
    expect(migration).toContain('NOT EXISTS (SELECT 1 FROM public.company_documents');
    expect(migration).toContain('NOT EXISTS (SELECT 1 FROM public.vehicles');
    expect(migration).toContain('NOT EXISTS (SELECT 1 FROM public.drivers');
    expect(migration).toContain('NOT EXISTS (SELECT 1 FROM public.job_commercial_agreements');
    expect(migration).toContain('NOT EXISTS (SELECT 1 FROM public.job_cancellation_requests');
    expect(migration).toContain('NOT EXISTS (SELECT 1 FROM public.company_registration_claims');
    expect(migration).toContain('public.set_company_status_governance');
    expect(migration).toContain("'suspended'");
    expect(migration).toContain("'owner_audit_rows_before'");
    expect(migration).not.toContain("SET status = 'suspended'");
  });

  it('restricts creator bootstrap and excludes quarantined shells from verified registration', () => {
    const resolution = readRepoFile(
      'supabase/migrations/20260830211000_resolve_remaining_legacy_fleet_company_shells.sql',
    );
    const registration = readRepoFile(
      'supabase/migrations/20260830211030_harden_verified_company_registration_after_legacy_fleet_quarantine.sql',
    );

    expect(resolution).toContain("AND c.status::text = 'pending_approval'");
    expect(registration).toContain("v_company.status::text = 'pending_approval' AND v_company.created_by = p_actor_user_id");
    expect(registration).toContain('legacy_fleet_onboarding_resolutions');
    expect(registration).toContain("r.resolution_code = 'quarantine_legacy_active_shell'");
    expect(registration).toContain('REVOKE ALL ON FUNCTION public.register_validated_company_atomic');
    expect(registration).toContain('TO service_role;');
  });

  it('keeps a read-only durable verifier for every resolved application', () => {
    const verification = readRepoFile(
      'supabase/migrations/20260830211100_verify_remaining_legacy_fleet_resolution.sql',
    );

    expect(verification).toContain('A remaining legacy Fleet application has no explicit P0-12 resolution.');
    expect(verification).toContain('A quarantined legacy Fleet company shell still carries company authority.');
    expect(verification).toContain('Creator membership bootstrap is not restricted to pending-approval companies.');
    expect(verification).toContain('Client roles can execute the service-controlled verified company registration RPC.');
    expect(verification).not.toContain('UPDATE public.');
    expect(verification).not.toContain('DELETE FROM public.');
  });
});
