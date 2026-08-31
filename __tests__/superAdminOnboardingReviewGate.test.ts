import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('Super Admin onboarding review gate', () => {
  it('removes created_by company inference and keeps company authority explicit', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260830212500_harden_onboarding_review_company_binding.sql',
    );

    expect(migration).toContain('v_company_id := v_app.company_id');
    expect(migration).toContain('explicit canonical company binding before approval');
    expect(migration).not.toContain('WHERE c.created_by = v_app.user_id');
    expect(migration).not.toContain('ORDER BY c.created_at DESC');
  });

  it('makes already-active company approval idempotent and governance blocked states fail closed', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260830212500_harden_onboarding_review_company_binding.sql',
    );

    expect(migration).toContain("v_company_status = 'active'");
    expect(migration).toContain('assert_company_compliance_ready(v_company_id)');
    expect(migration).toContain("v_company_status IN ('rejected', 'suspended', 'inactive')");
    expect(migration).toContain('set_company_status_governance');
  });

  it('exposes only a Platform Owner review queue and derives approval readiness conservatively', () => {
    const route = readRepoFile('app/api/super-admin/onboarding/route.ts');

    expect(route).toContain("profile?.role !== 'owner'");
    expect(route).toContain(".in('status', ['submitted', 'under_review', 'request_changes'])");
    expect(route).toContain('COMPANY_BOUND_ACCOUNT_TYPES');
    expect(route).toContain('APPROVABLE_COMPANY_STATUSES');
    expect(route).toContain("'get_missing_onboarding_documents'");
    expect(route).toContain("normalized(application.risk_status, 'unknown')");
    expect(route).toContain("riskStatus !== 'clear'");
    expect(route).toContain('approvalBlockers.length === 0');
  });

  it('uses the existing owner-only atomic mutation endpoint rather than direct client writes', () => {
    const queue = readRepoFile('app/super-admin/compliance/documents/OnboardingReviewQueue.tsx');
    const patchRoute = readRepoFile('app/api/super-admin/onboarding/[id]/route.ts');
    const page = readRepoFile('app/super-admin/compliance/documents/page.tsx');

    expect(queue).toContain("fetch(`/api/super-admin/onboarding/${row.id}`");
    expect(queue).toContain("method: 'PATCH'");
    expect(queue).not.toContain(".from('onboarding_applications')");
    expect(patchRoute).toContain("rpc('review_onboarding_application_atomic'");
    expect(page).toContain("import OnboardingReviewQueue from './OnboardingReviewQueue'");
    expect(page).toContain('<OnboardingReviewQueue');
  });

  it('keeps the internal authority base hidden from API roles', () => {
    const verification = readRepoFile(
      'supabase/migrations/20260830212600_verify_onboarding_review_company_binding.sql',
    );

    expect(verification).toContain('review_onboarding_application_atomic_authority_base_v1');
    expect(verification).toContain("'anon'");
    expect(verification).toContain("'authenticated'");
    expect(verification).toContain("'service_role'");
    expect(verification).toContain('Canonical onboarding review RPC execution boundary changed unexpectedly.');
  });
});
