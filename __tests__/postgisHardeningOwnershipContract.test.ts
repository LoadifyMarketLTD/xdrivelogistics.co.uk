import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260818172000_harden_postgis_spatial_ref_sys.sql'),
  'utf8',
);

describe('PostGIS spatial_ref_sys hardening ownership boundary', () => {
  it('does not block production when spatial_ref_sys is owned by an inaccessible Supabase-managed role', () => {
    expect(source).toContain("pg_get_userbyid(c.relowner)");
    expect(source).toContain("pg_has_role(current_user, v_owner, 'MEMBER')");
    expect(source).toContain('IF NOT v_can_act_as_owner THEN');
    expect(source).toContain('Skipping spatial_ref_sys hardening');
    expect(source).toContain('RETURN;');
  });

  it('still applies read-only hardening when the migration role can act as the relation owner', () => {
    expect(source).toContain('ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY');
    expect(source).toContain('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER');
    expect(source).toContain('GRANT SELECT ON TABLE public.spatial_ref_sys TO anon, authenticated');
    expect(source).toContain('CREATE POLICY spatial_ref_sys_read_only');
  });

  it('never changes spatial_ref_sys data or relocates/drops PostGIS', () => {
    expect(source).not.toMatch(/\bDELETE\s+FROM\s+public\.spatial_ref_sys/i);
    expect(source).not.toMatch(/\bUPDATE\s+public\.spatial_ref_sys\s+SET\b/i);
    expect(source).not.toMatch(/\bDROP\s+EXTENSION\s+postgis\b/i);
    expect(source).not.toMatch(/\bALTER\s+EXTENSION\s+postgis\b/i);
  });
});
