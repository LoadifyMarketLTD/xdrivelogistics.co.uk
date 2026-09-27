import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927145000_harden_company_capability_actor_state.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('company capability actor-state hardening', () => {
  it('binds company settings capability to active company and profile state', () => {
    expect(migration).toContain('JOIN public.companies c');
    expect(migration).toContain('JOIN public.profiles p');
    expect(migration).toContain("COALESCE(c.status::text, '') = 'active'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });

  it('retains the existing member capability override model', () => {
    expect(migration).toContain('public.company_role_capabilities');
    expect(migration).toContain('public.member_capability_overrides');
    expect(migration).toContain('SELECT is_allowed FROM override_decision');
  });

  it('keeps anonymous execution closed', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.has_capability(uuid, text)\nFROM PUBLIC, anon',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.has_capability(uuid, text)\nTO authenticated, service_role',
    );
  });
});
