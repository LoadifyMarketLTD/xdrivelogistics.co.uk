import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260927124500_revoke_unused_legacy_authenticated_rpcs.sql',
  ),
  'utf8',
).replace(/\r\n/g, '\n');

describe('legacy authenticated RPC exposure hardening', () => {
  it('removes direct signed-in execution from unused SECURITY DEFINER helpers', () => {
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.get_my_role_status()');
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.is_company_members_admin(uuid)',
    );
    expect(migration).toContain('FROM PUBLIC, anon, authenticated');
  });

  it('keeps service-role execution for controlled server-side compatibility', () => {
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_my_role_status()\nTO service_role',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.is_company_members_admin(uuid)\nTO service_role',
    );
  });
});
