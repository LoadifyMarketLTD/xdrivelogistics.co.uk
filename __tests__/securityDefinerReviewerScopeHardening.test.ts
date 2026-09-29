import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927131500_harden_reviewer_and_member_management_scope.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('reviewer and member-management SECURITY DEFINER hardening', () => {
  it('requires canonical active Platform Owner or active tenant reviewer authority', () => {
    expect(migration).toContain('SELECT public.is_owner(actor.user_id) AS allowed');
    expect(migration).toContain("COALESCE(cm.status::text, '') = 'active'");
    expect(migration).toContain("COALESCE(cm.role_in_company::text, '') IN ('owner', 'admin')");
    expect(migration).toContain("COALESCE(company.status::text, '') = 'active'");
    expect(migration).not.toContain("p.role IN ('owner', 'admin')");
  });

  it('binds onboarding evidence review to the evidence company', () => {
    expect(migration).toContain('JOIN public.onboarding_applications oa');
    expect(migration).toContain('COALESCE(c.company_id, oa.company_id) AS company_id');
    expect(migration).toContain('ON cm.company_id = evidence.company_id');
  });

  it('requires active company authority for legacy company member management', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.can_manage_company_members');
    expect(migration).toContain("COALESCE(c.status::text, '') = 'active'");
    expect(migration).toContain('OR public.is_owner(auth.uid())');
    expect(migration).not.toContain("and p.role = 'owner'");
  });

  it('preserves authenticated execution only for helpers that enforce actor scope', () => {
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.can_review_onboarding_storage_object(text, text)\nTO authenticated, service_role',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.can_manage_company_members(uuid)\nTO authenticated, service_role',
    );
  });
});
