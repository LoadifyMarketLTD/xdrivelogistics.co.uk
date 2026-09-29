import fs from 'node:fs';
import path from 'node:path';

describe('core table grant parity', () => {
  const migration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260929220948_canonicalize_core_authenticated_table_grants.sql'),
    'utf8',
  );

  it('canonicalizes drivers, vehicles, profiles and jobs to hosted authenticated grants', () => {
    expect(migration).toContain('REVOKE ALL PRIVILEGES');
    expect(migration).toContain('public.drivers, public.vehicles, public.profiles, public.jobs');
    expect(migration).toContain('GRANT SELECT, INSERT, UPDATE');
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain('GRANT ALL PRIVILEGES');
    expect(migration).toContain('TO service_role');
  });

  it('preserves only the hosted anon drivers SELECT surface and relies on fail-closed RLS', () => {
    expect(migration).toContain('GRANT SELECT ON TABLE public.drivers TO anon');
    expect(migration).not.toContain('GRANT INSERT');
    expect(migration).not.toContain('GRANT UPDATE ON TABLE public.drivers TO anon');
    expect(migration).not.toContain('GRANT DELETE');
  });
});