import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927150500_harden_invoice_number_authority.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('invoice number authority hardening', () => {
  it('uses the JWT role claim instead of deprecated auth.role()', () => {
    expect(migration).toContain("auth.jwt() ->> 'role'");
    expect(migration).not.toContain('auth.role()');
  });

  it('requires active member, active profile, and active company for user calls', () => {
    expect(migration).toContain("cm.status::text = 'active'");
    expect(migration).toContain("c.status::text = 'active'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });

  it('requires service-role numbering to target an active company', () => {
    expect(migration).toContain("v_jwt_role <> 'service_role'");
    expect(migration).toContain("Invoice company is not active.");
  });

  it('preserves advisory locking and authenticated/service-role execution', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.next_invoice_number(uuid)\nTO authenticated, service_role',
    );
  });
});
