import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/components/workspace/CustomerCompanySettingsPage.tsx'),
  'utf8',
);

const authMigration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260724152500_canonical_company_membership_authorization.sql'),
  'utf8',
);

describe('customer account edit boundary', () => {
  it('uses the canonical company membership role source', () => {
    expect(source).toContain("supabase.rpc('active_company_membership_role'");
    expect(authMigration).toContain('CREATE OR REPLACE FUNCTION public.active_company_membership_role');
  });

  it('keeps company profile editing owner/admin only in the UI', () => {
    expect(source).toContain("membershipRole === 'owner' || membershipRole === 'admin'");
    expect(source).toContain('disabled={!canEdit}');
    expect(source).toContain("'Read-only profile'");
  });
});
