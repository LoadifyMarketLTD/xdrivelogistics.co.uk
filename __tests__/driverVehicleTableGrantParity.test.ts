import fs from 'node:fs';
import path from 'node:path';

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260830184550_canonicalize_driver_vehicle_authenticated_grants.sql',
  ),
  'utf8',
);

describe('driver/vehicle table grant parity', () => {
  it('restores the authenticated table privileges required by RLS-backed reads and writes', () => {
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE');
    expect(migration).toContain('ON TABLE public.drivers, public.vehicles');
    expect(migration).toContain('TO authenticated;');
  });

  it('removes dangerous fresh-branch privileges that are not present in Production', () => {
    expect(migration).toContain('REVOKE TRUNCATE, REFERENCES, TRIGGER');
    expect(migration).toContain('FROM anon, authenticated;');
  });

  it('keeps service-role authority explicit', () => {
    expect(migration).toContain('GRANT ALL');
    expect(migration).toContain('TO service_role;');
  });
});
