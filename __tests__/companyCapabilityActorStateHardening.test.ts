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
  it('binds company settings capability to canonical active membership, company and profile state', () => {
    expect(migration).toContain('FROM public.company_memberships cm');
    expect(migration).toContain('cm.role_in_company::text AS company_role');
    expect(migration).toContain("COALESCE(cm.status::text, '') = 'active'");
    expect(migration).toContain('JOIN public.companies c');
    expect(migration).toContain('JOIN public.profiles p');
    expect(migration).toContain("COALESCE(c.status::text, '') = 'active'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
    expect(migration).not.toContain('FROM public.company_members cm');
  });

  it('replays the hosted default role capability map without hosted-only tables', () => {
    for (const entry of [
      "('admin', 'company.manage_members')",
      "('admin', 'jobs.create')",
      "('admin', 'jobs.track')",
      "('broker_admin', 'jobs.create')",
      "('dispatcher', 'jobs.allocate')",
      "('dispatcher', 'jobs.track')",
      "('driver', 'jobs.update_driver_status')",
      "('owner', 'company.manage_members')",
      "('owner', 'company.manage_settings')",
      "('owner', 'jobs.create')",
      "('viewer', 'loads.view_own')",
    ]) expect(migration).toContain(entry);
    expect(migration).not.toContain('FROM public.company_role_capabilities');
    expect(migration).not.toContain('FROM public.member_capability_overrides');
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
