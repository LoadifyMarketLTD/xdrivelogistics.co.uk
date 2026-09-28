import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927173500_harden_marketplace_execution_visibility.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('marketplace execution visibility hardening', () => {
  it('preserves the pre-award restrictive privacy contract', () => {
    expect(migration).toContain("IN ('posted', 'quoted')");
    expect(migration).toContain('j.awarded_carrier_company_id IS NULL');
    expect(migration).toContain("IN ('exchange', 'direct')");
  });

  it('requires active membership, company and profile for tenant visibility', () => {
    expect(migration).toContain("cm.status::text = 'active'");
    expect(migration).toContain("c.status::text = 'active'");
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });

  it('preserves creator visibility', () => {
    expect(migration).toContain('OR j.created_by = auth.uid()');
  });

  it('keeps anonymous execution closed', () => {
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.can_read_marketplace_execution_job(uuid)\nFROM PUBLIC, anon',
    );
  });
});
