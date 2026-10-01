import fs from 'node:fs';
import path from 'node:path';

describe('legacy invites fresh-schema guard', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260929195813_canonicalize_company_membership_authority.sql'),
    'utf8',
  );

  it('does not require hosted-only legacy tables on canonical fresh schemas', () => {
    expect(migration).toContain("to_regclass('public.invites') IS NOT NULL");
    expect(migration).toContain("to_regclass('public.workspace_switch_audit') IS NOT NULL");
    expect(migration).toContain('CREATE POLICY invites_insert_company_admin');
    expect(migration).toContain('CREATE POLICY invites_select_owner_or_company_admin');
    expect(migration).toContain('CREATE POLICY invites_update_owner_or_company_admin');
    expect(migration).toContain('CREATE POLICY workspace_audit_select_company_member');
  });
});
