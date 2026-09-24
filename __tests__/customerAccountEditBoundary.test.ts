import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/components/workspace/RoleSettingsWorkspace.tsx'),
  'utf8',
);
const customerAccount = fs.readFileSync(
  path.join(process.cwd(), 'app/customer/account/page.tsx'),
  'utf8',
);
const authMigration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260724152500_canonical_company_membership_authorization.sql'),
  'utf8',
);

describe('customer account edit boundary', () => {
  it('uses the canonical company membership role source in the shared Settings workspace', () => {
    expect(source).toContain("supabase.rpc('active_company_membership_role'");
    expect(authMigration).toContain('CREATE OR REPLACE FUNCTION public.active_company_membership_role');
  });

  it('keeps canonical company profile editing owner-only and ordinary admins operational only', () => {
    expect(source).toContain("const canEditCompany = membershipRole === 'owner';");
    expect(source).toContain("const canManageCompanyOperations = membershipRole === 'owner' || membershipRole === 'admin';");
    expect(source).toContain('disabled={!canEditCompany}');
  });

  it('eliminates the duplicate customer Account editor in favour of Settings', () => {
    expect(customerAccount).toContain("redirect('/customer/settings?section=company')");
    expect(fs.existsSync(path.join(process.cwd(), 'app/components/workspace/CustomerCompanySettingsPage.tsx'))).toBe(false);
  });
});
