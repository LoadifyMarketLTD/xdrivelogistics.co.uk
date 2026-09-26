import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Driver finance endpoint role boundary', () => {
  const helper = read('app/api/driver/finance/_lib/financeAccess.ts');

  it('requires an active driver identity and owner/admin company membership', () => {
    expect(helper).toContain(".select('id,company_id,status,app_access')");
    expect(helper).toContain("driver.status !== 'active'");
    expect(helper).toContain("driver.app_access !== true");
    expect(helper).toContain(".select('role_in_company')");
    expect(helper).toContain("role !== 'owner' && role !== 'admin'");
  });

  it('protects direct owner-driver invoice endpoints with the canonical finance authority helper', () => {
    const routes = [
      'app/api/driver/finance/invoices/[id]/route.ts',
      'app/api/driver/finance/invoices/[id]/disputes/route.ts',
      'app/api/driver/finance/invoices/[id]/documents/route.ts',
      'app/api/driver/finance/invoices/[id]/payment-history/route.ts',
      'app/api/driver/finance/invoices/[id]/draft/route.ts',
      'app/api/driver/finance/invoices/[id]/email-defaults/route.ts',
      'app/api/driver/finance/invoices/[id]/submit/route.ts',
    ];
    for (const route of routes) {
      const source = read(route);
      expect(source).toContain('requireDriverFinanceAccess(request)');
      expect(source).toContain('if (!access.ok) return access.response');
    }
  });

  it('does not let a regular driver preview company invoices', () => {
    const preview = read('app/api/driver/finance/invoices/[id]/preview/route.ts');
    expect(preview).toContain("if (!['owner', 'admin'].includes(role)) return null");
    expect(preview).not.toContain("'driver'].includes(role)");
  });
});
