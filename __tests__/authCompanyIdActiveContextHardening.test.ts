import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927142000_harden_auth_company_id_active_context.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('auth_company_id active company context hardening', () => {
  it('resolves company context from active membership and active company state', () => {
    expect(migration).toContain('FROM public.company_memberships cm');
    expect(migration).toContain("cm.status::text = 'active'");
    expect(migration).toContain("c.status::text = 'active'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });

  it('does not trust profiles.company_id as standalone authority', () => {
    expect(migration).toContain('AND p.company_id = cm.company_id');
    expect(migration).not.toContain('p.company_id IS NULL');
    expect(migration).not.toContain('SELECT company_id::uuid\n    FROM public.profiles');
  });

  it('keeps the helper unavailable to anonymous callers', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.auth_company_id()\nFROM PUBLIC, anon',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.auth_company_id()\nTO authenticated, service_role',
    );
  });

  it('uses a locked search path because it is SECURITY DEFINER', () => {
    expect(migration).toContain('SET search_path = pg_catalog, public');
  });
});
