import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const readRepoFile = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf-8');

describe('identity compliance foundation', () => {
  it('enforces one active company membership and one driver identity per auth user', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260729161000_identity_compliance_and_fraud_foundation.sql',
    );

    expect(migration).toContain('company_memberships_one_active_company_per_user_uidx');
    expect(migration).toContain("WHERE user_id IS NOT NULL AND status::text = 'active'");
    expect(migration).toContain('drivers_one_identity_per_auth_user_uidx');
    expect(migration).toContain('Identity compliance preflight failed');
  });

  it('allows only one active marketplace quote per company or independent identity for a job', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260729162000_marketplace_single_active_quote_per_identity.sql',
    );

    expect(migration).toContain('job_bids_one_active_company_quote_per_job_uidx');
    expect(migration).toContain('job_bids_one_active_independent_quote_per_job_uidx');
    expect(migration).toContain("status IN ('submitted', 'accepted')");
    expect(migration).toContain('Marketplace fairness preflight failed');
  });

  it('fails closed when an onboarding application is held or mandatory documents are not approved', () => {
    const migration = readRepoFile(
      'supabase/migrations/20260729161000_identity_compliance_and_fraud_foundation.sql',
    );

    expect(migration).toContain('assert_onboarding_compliance_ready');
    expect(migration).toContain('assert_company_compliance_ready');
    expect(migration).toContain('trg_enforce_onboarding_approval_compliance');
    expect(migration).toContain("IF v_risk_status <> 'clear'");
    expect(migration).toContain('Required verified documents missing');
  });

  it('fingerprints onboarding documents before storage and places cross-account duplicates on hold', () => {
    const uploadRoute = readRepoFile('app/api/onboarding/documents/route.ts');

    expect(uploadRoute).toContain("createHash('sha256')");
    expect(uploadRoute).toContain(".from('document_fingerprints')");
    expect(uploadRoute).toContain("case_type: 'duplicate_file'");
    expect(uploadRoute).toContain("risk_status: 'on_hold'");
    expect(uploadRoute).toContain("code: 'duplicate_document_detected'");
  });

  it('gives only the Platform Owner a short-lived secure document preview and logs every view', () => {
    const documentRoute = readRepoFile(
      'app/api/super-admin/compliance/documents/route.ts',
    );

    expect(documentRoute).toContain("profile?.role !== 'owner'");
    expect(documentRoute).toContain('createSignedUrl(storageObject.objectPath, 300)');
    expect(documentRoute).toContain("action_type: 'document_viewed'");
    expect(documentRoute).toContain("document_family: 'company'");
    expect(documentRoute).toContain("document_family: 'identity'");
  });

  it('requires a recorded human decision before a fraud case blocks the user profile', () => {
    const fraudRoute = readRepoFile(
      'app/api/super-admin/compliance/fraud-cases/route.ts',
    );

    expect(fraudRoute).toContain("action: z.enum(['investigate', 'clear', 'confirm', 'dismiss'])");
    expect(fraudRoute).toContain("parsed.data.action === 'confirm'");
    expect(fraudRoute).toContain("risk_status: 'confirmed_fraud'");
    expect(fraudRoute).toContain(".update({ status: 'blocked' })");
    expect(fraudRoute).toContain('decision_reason: parsed.data.reason');
  });

  it('exposes document review and identity fraud review in the Platform Owner navigation', () => {
    const shell = readRepoFile(
      'app/super-admin/_components/SuperAdminWorkspaceShell.tsx',
    );

    expect(shell).toContain('/super-admin/compliance/documents');
    expect(shell).toContain('/super-admin/compliance/fraud-cases');
  });
});
