import fs from 'node:fs';
import path from 'node:path';

describe('legacy authenticated RPC fresh-schema contract', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260927124500_revoke_unused_legacy_authenticated_rpcs.sql'),
    'utf8',
  );

  it('guards optional legacy functions before privilege changes', () => {
    expect(migration).toContain("to_regprocedure('public.get_my_role_status()') IS NOT NULL");
    expect(migration).toContain("to_regprocedure('public.is_company_members_admin(uuid)') IS NOT NULL");
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('TO service_role');
  });
});
