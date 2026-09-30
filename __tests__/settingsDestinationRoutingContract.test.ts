import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('workspace destination routing contract', () => {
  const settings = read('app/components/workspace/RoleSettingsWorkspace.tsx');
  const postLoad = read('app/components/workspace/LoadPostingForm.tsx');

  it('keeps customer settings actions inside dedicated customer destinations', () => {
    expect(settings).toContain("billing: '/customer/settings/billing'");
    expect(settings).toContain("support: '/customer/support'");
    expect(settings).toContain("finance: '/customer/invoices'");
    expect(settings).toContain("legal: '/customer/account/legal-agreements'");
    expect(settings).toContain("notifications: '/customer/notifications'");
    expect(settings).toContain("audit: '/customer/event-log'");
    expect(settings).toContain("team: '/customer/team'");
    expect(settings).toContain("documents: '/customer/documents'");
    expect(settings).not.toContain("router.push('/settings/billing')");
    expect(settings).not.toContain("router.push('/help')");
  });

  it('separates company finance settings from finance and invoices', () => {
    expect(settings).toContain("label: 'Company Finance Settings'");
    expect(settings).toContain("label: role === 'finance' ? 'Finance Workspace' : 'Finance & Invoices'");
    expect(settings).toContain("router.push(routes.finance!)");
  });

  it('provides role-scoped billing and support pages', () => {
    for (const page of [
      'app/customer/settings/billing/page.tsx',
      'app/broker/settings/billing/page.tsx',
      'app/driver/settings/billing/page.tsx',
      'app/admin/settings/billing/page.tsx',
      'app/customer/support/page.tsx',
      'app/broker/support/page.tsx',
      'app/driver/support/page.tsx',
      'app/admin/support/page.tsx',
    ]) {
      expect(existsSync(join(process.cwd(), page)), page).toBe(true);
    }
  });

  it('turns legal publish blocking into an actionable remediation route', () => {
    expect(postLoad).toContain('setupUrl?: string');
    expect(postLoad).toContain("payload?.code === 'COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED'");
    expect(postLoad).toContain('setLegalRemediationUrl(resolveLegalRemediationUrl(payload.setupUrl, mode))');
    expect(postLoad).toContain('Review & accept legal agreements');
    expect(postLoad).toContain('router.push(legalRemediationUrl)');
  });
});
