import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927162500_harden_membership_role_and_driver_invite.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('membership role and driver invite hardening', () => {
  it('replaces deprecated auth.role() with the JWT role claim', () => {
    expect(migration).toContain("auth.jwt() ->> 'role'");
    expect(migration).not.toContain('auth.role()');
  });

  it('requires active membership, active company and active profile for role lookup', () => {
    expect(migration).toContain("cm.status::text = 'active'");
    expect(migration).toContain("c.status::text = 'active'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });

  it('rejects driver invites whose target company is not active', () => {
    expect(migration).toContain("v_company_status IS DISTINCT FROM 'active'");
    expect(migration).toContain('Invite company is not active.');
  });

  it('preserves invite identity binding and expiry checks', () => {
    expect(migration).toContain('This invite belongs to a different email address.');
    expect(migration).toContain('This invite belongs to a different phone number.');
    expect(migration).toContain('Invite expired');
  });
});
