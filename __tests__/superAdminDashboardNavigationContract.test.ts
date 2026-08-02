import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'app/super-admin/page.tsx'), 'utf8');

describe('super admin dashboard navigation contract', () => {
  it('keeps owner-only protection on the live dashboard surface', () => {
    expect(source).toContain("<ProtectedRoute allowedRoles={['owner']}>");
  });

  it('preserves the real priority-action routes behind OperationalLinkList rows', () => {
    for (const [label, route] of [
      ['Review approvals', '/super-admin/companies/approvals'],
      ['Platform health', '/super-admin/health'],
      ['Notifications queue', '/super-admin/notifications'],
      ['Audit events', '/super-admin/settings/audit-logs'],
      ['Feature flags', '/super-admin/settings/feature-flags'],
      ['Review onboarding', '/super-admin/companies/verification'],
      ['Review compliance', '/super-admin/companies/compliance'],
      ['Review disputes', '/super-admin/operations/disputes'],
    ]) {
      expect(source).toMatch(new RegExp(`label: '${label}'[\\s\\S]*?router\\.push\\('${route.replace(/\//g, '\\/')}'\\)`));
    }
  });

  it('keeps workspace register modules wired to their live route destinations', () => {
    for (const href of [
      '/super-admin/marketplace',
      '/super-admin/operations/jobs',
      '/super-admin/companies',
      '/super-admin/users/drivers',
      '/super-admin/finance/invoices',
      '/super-admin/compliance/documents',
    ]) {
      expect(source).toContain(`href: '${href}'`);
    }
  });
});
