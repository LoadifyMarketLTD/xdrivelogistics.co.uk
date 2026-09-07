import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

const intelligence = source('app/api/super-admin/_lib/secureLoadIntelligence.ts');
const route = source('app/api/super-admin/secure-loads/route.ts');
const page = source('app/super-admin/operations/secure-loads/page.tsx');
const workspace = source('app/super-admin/_components/SuperAdminWorkspaceShell.tsx');
const inspector = source('app/api/super-admin/inspect/[entityType]/[entityId]/route.ts');

describe('Super Admin Secure Operations v3', () => {
  it('exposes Secure Loads inside the canonical Secure Operations domain', () => {
    expect(workspace).toContain("label: 'Secure Loads'");
    expect(workspace).toContain("href: '/super-admin/operations/secure-loads'");
  });

  it('keeps the Secure Loads API owner-only and GET/read-only', () => {
    expect(route).toContain('export async function GET');
    expect(route).toContain('verifyPlatformOwner(request)');
    for (const mutation of ['export async function POST', 'export async function PATCH', 'export async function PUT', 'export async function DELETE']) {
      expect(route).not.toContain(mutation);
    }
  });
  it('uses the shared intelligence derivation in both ledger and inspector', () => {
    expect(route).toContain('deriveSecureLoadIntelligence');
    expect(inspector).toContain('deriveSecureLoadIntelligence');
    expect(inspector).toContain("id: 'secure-load'");
    expect(inspector).toContain("title: 'Secure Load / Security'");
  });

  it('does not infer POD required from null or missing values', () => {
    expect(intelligence).toContain('const podRequired = job.pod_required === true;');
    expect(intelligence).not.toContain("job.pod_required !== false");
  });

  it('keeps marketplace bidding permission out of execution credential blocking', () => {
    expect(intelligence).toContain("MARKETPLACE_ONLY_BLOCKERS = new Set(['commercial_bidding_not_permitted'])");
    expect(intelligence).toContain('executionCredentialBlockers');
  });

  it('fails closed on unavailable credentials and evidence sources', () => {
    expect(intelligence).toContain("blockers.push('credential_verification_unavailable')");
    expect(route).toContain('const trackingFailure = trackingResults.find');
    expect(inspector).toContain('secureEvidenceUnavailable');
    expect(page).toContain('SuperAdminUnavailableState');
  });
  it('keeps attention counts explicitly page-local while total_records remains exact', () => {
    expect(route).toContain('blocked_on_page');
    expect(route).toContain('review_on_page');
    expect(route).toContain('awaiting_assignment_on_page');
    expect(route).toContain('clear_on_page');
    expect(route).toContain("attention_counts: 'Blocked, review, awaiting-assignment and clear counts apply only to the current page.'");
  });

  it('does not introduce automatic sanctions or financial mutations', () => {
    for (const forbidden of ['refund', 'payout', 'suspendCompany', 'cancelJob', 'update({', '.delete()']) {
      expect(route).not.toContain(forbidden);
      expect(page).not.toContain(forbidden);
    }
  });
});
