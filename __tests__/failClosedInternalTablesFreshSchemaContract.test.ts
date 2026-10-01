import fs from 'node:fs';
import path from 'node:path';

describe('fail-closed internal tables fresh-schema contract', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260927122500_harden_fail_closed_internal_tables.sql'),
    'utf8',
  );

  it('guards production-only internal tables before privilege changes', () => {
    expect(migration).toContain("to_regclass(format('public.%I', relation_name)) IS NOT NULL");
    expect(migration).toContain("'backup_20260721221000_auth_users_metadata'");
    expect(migration).toContain("'company_membership_workspace_access'");
    expect(migration).toContain("'platform_feature_flags'");
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated');
    expect(migration).toContain('TO service_role');
  });
});
