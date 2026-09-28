import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927152500_harden_company_compliance_authority.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('company compliance authority hardening', () => {
  it('uses the JWT role claim instead of deprecated auth.role()', () => {
    expect(migration).toContain("auth.jwt() ->> 'role'");
    expect(migration).not.toContain('auth.role()');
  });

  it('requires active tenant authority for authenticated callers', () => {
    expect(migration).toContain("cm.status::text = 'active'");
    expect(migration).toContain("c.status::text = 'active'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });

  it('preserves Platform Owner and service-role review semantics', () => {
    expect(migration).toContain('NOT public.is_owner(v_actor)');
    expect(migration).toContain("v_jwt_role <> 'service_role'");
  });

  it('preserves the existing compliance evidence contract', () => {
    expect(migration).toContain("ARRAY['drivinglicence', 'insurance']");
    expect(migration).toContain("ARRAY['mot', 'insurance']");
    expect(migration).toContain("verification_status::text, '')) = 'verified'");
  });
});
