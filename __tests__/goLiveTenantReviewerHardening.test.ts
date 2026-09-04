import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

const BROKER_RPC_MIGRATION =
  'supabase/migrations/20260904233000_restrict_hosted_legacy_broker_governance_rpcs.sql';
const REVIEWER_RLS_MIGRATION =
  'supabase/migrations/20260904233500_harden_onboarding_reviewer_rls_scope.sql';
const COMPANY_SELECT_RLS_MIGRATION =
  'supabase/migrations/20260905012000_reconcile_companies_select_rls.sql';

describe('PR follow-up tenant reviewer and legacy broker hardening', () => {
  it('keeps hosted legacy broker approval RPCs service-only when they exist', () => {
    const migration = readRepoFile(BROKER_RPC_MIGRATION);

    expect(migration).toContain("'public.approve_broker(uuid,text)'");
    expect(migration).toContain("'public.reject_broker(uuid,text)'");
    expect(migration).toContain(
      "'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated'",
    );
    expect(migration).toContain("'GRANT EXECUTE ON FUNCTION %s TO service_role'");
    expect(migration).toContain('to_regprocedure(v_signature)');
    expect(migration).not.toContain('DROP FUNCTION');
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION');
  });

  it('removes global generic-admin reviewer visibility and scopes company review by active membership', () => {
    const migration = readRepoFile(REVIEWER_RLS_MIGRATION);

    expect(migration).toContain(
      'DROP POLICY IF EXISTS reviewers_read_onboarding_applications',
    );
    expect(migration).toContain('DROP POLICY IF EXISTS reviewers_read_company_documents');
    expect(migration).toContain(
      'DROP POLICY IF EXISTS reviewers_read_driver_identity_documents',
    );

    expect(migration).toContain('CREATE POLICY onboarding_applications_select_tenant_reviewer');
    expect(migration).toContain('CREATE POLICY company_documents_select_tenant_reviewer');
    expect(migration).toContain('CREATE POLICY driver_identity_documents_select_tenant_reviewer');

    expect(migration).toContain("p.role = 'owner'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
    expect(migration).toContain('FROM public.company_memberships cm');
    expect(migration).toContain("COALESCE(cm.status::text, '') = 'active'");
    expect(migration).toContain(
      "COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin')",
    );
    expect(migration).toContain('cm.company_id = onboarding_applications.company_id');
    expect(migration).toContain('cm.company_id = company_documents.company_id');
    expect(migration).toContain(
      'oa.id = driver_identity_documents.onboarding_application_id',
    );

    expect(migration).not.toContain("p.role = ANY (ARRAY['owner'::text, 'admin'::text])");
    expect(migration).not.toContain('UPDATE public.onboarding_applications');
    expect(migration).not.toContain('UPDATE public.company_documents');
    expect(migration).not.toContain('UPDATE public.driver_identity_documents');
    expect(migration).not.toContain('DELETE FROM public.onboarding_applications');
    expect(migration).not.toContain('DELETE FROM public.company_documents');
    expect(migration).not.toContain('DELETE FROM public.driver_identity_documents');
  });

  it('reconciles company SELECT access to creator, active member, or platform owner only', () => {
    const migration = readRepoFile(COMPANY_SELECT_RLS_MIGRATION);

    expect(migration).toContain(
      'DROP POLICY IF EXISTS companies_select_member_or_creator ON public.companies;',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS companies_select_owner_all ON public.companies;',
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS companies_select_owner_or_member_safe ON public.companies;',
    );
    expect(migration).toContain('CREATE POLICY companies_select_authorized');
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain('companies.created_by = (SELECT auth.uid())');
    expect(migration).toContain('public.is_company_member(companies.id)');
    expect(migration).toContain('public.is_owner((SELECT auth.uid()))');
    expect(migration).not.toContain('company_id = id');
  });
});
