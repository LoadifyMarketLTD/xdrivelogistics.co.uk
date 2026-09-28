import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
const file = fs.readdirSync(migrationsDir)
  .find((name) => name.endsWith('_harden_cx_operational_settings_grants.sql'));

if (!file) throw new Error('CX operational settings grant hardening migration is missing.');

const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

describe('CX operational settings grant hardening', () => {
  it('revokes all anonymous table privileges on sensitive operational settings', () => {
    expect(sql).toContain('REVOKE ALL ON TABLE public.company_specialist_capabilities FROM anon');
    expect(sql).toContain('REVOKE ALL ON TABLE public.company_member_blocks FROM anon');
    expect(sql).toContain('REVOKE ALL ON TABLE public.company_settings FROM anon');
  });

  it('regrants only the authenticated operations each surface needs', () => {
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE');
    expect(sql).toContain('GRANT SELECT, INSERT, DELETE');
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE');
  });

  it('narrows company settings read policy from public to authenticated', () => {
    expect(sql).toContain('DROP POLICY IF EXISTS company_settings_select_member');
    expect(sql).toContain('TO authenticated');
    expect(sql).toContain('USING (public.is_company_member(company_id))');
  });

  it('fails the migration if anonymous read access remains', () => {
    expect(sql).toContain("has_table_privilege('anon', 'public.company_settings', 'SELECT')");
    expect(sql).toContain('Anonymous access remains on CX operational settings tables.');
  });
});
