import fs from 'node:fs';
import path from 'node:path';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Super Admin #431 screenshot regressions', () => {
  it('uses the canonical reviews reviewer_user_id column for complaints', () => {
    const supportRoute = read('app/api/super-admin/support/route.ts');

    expect(supportRoute).toContain(".select('id, company_id, reviewer_user_id, rating, comment, created_at')");
    expect(supportRoute).toContain('reviewer_id: row.reviewer_user_id');
    expect(supportRoute).not.toContain(".select('id, company_id, reviewer_id, rating, comment, created_at')");
  });

  it('makes the shared Platform Owner verifier fail closed for writes in Deploy Preview', () => {
    const verifier = read('app/api/super-admin/_lib/verifyPlatformOwner.ts');

    expect(verifier).toContain("process.env.CONTEXT === 'deploy-preview'");
    expect(verifier).toContain("DEPLOY_PRIME_URL?.includes('deploy-preview-')");
    expect(verifier).toContain("URL?.includes('deploy-preview-')");
    expect(verifier).toContain("const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])");
    expect(verifier).toContain("!READ_ONLY_METHODS.has(request.method.toUpperCase())");
  });

  it('does not present historical skipped notifications as delivery failures', () => {
    const notifications = read('app/super-admin/notifications/_lib/notificationsPage.tsx');

    expect(notifications).toContain("row.status === 'skipped' ? 'Skipped / quarantined'");
    expect(notifications).toContain('{row.last_error}');
    expect(notifications).toContain("previewReadOnly&&retryState?'Retry · preview':'Retry'");
  });

  it('treats company and member profile XDrive IDs as separate entity identifiers', () => {
    const governance = read('app/super-admin/_components/control-plane/CompanyGovernanceControls.tsx');

    expect(governance).toContain('Company XDrive ID: {companyXdId}');
    expect(governance).toContain('Member profile XDrive ID: {profileXdId}');
    expect(governance).toContain('identify different entity types and are not expected to match');
    expect(governance).not.toContain('Identity review: Company ID');
  });
});
