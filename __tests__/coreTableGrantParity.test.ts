import fs from 'node:fs';
import path from 'node:path';

describe('core table grant parity', () => {
  const bootstrapMigration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260830184550_bootstrap_core_table_grants_before_storage_rls_probe.sql'),
    'utf8',
  );
  const canonicalMigration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260929220948_canonicalize_core_authenticated_table_grants.sql'),
    'utf8',
  );

  it('canonicalizes drivers, vehicles, profiles and jobs to hosted authenticated grants before the storage probe', () => {
    expect('20260830184550' < '20260830184600').toBe(true);
    expect(bootstrapMigration).toContain('REVOKE ALL PRIVILEGES');
    expect(bootstrapMigration).toContain('public.drivers, public.vehicles, public.profiles, public.jobs');
    expect(bootstrapMigration).toContain('GRANT SELECT, INSERT, UPDATE');
    expect(bootstrapMigration).toContain('TO authenticated');
    expect(bootstrapMigration).toContain('GRANT ALL PRIVILEGES');
    expect(bootstrapMigration).toContain('TO service_role');
  });

  it('preserves only the hosted anon drivers SELECT surface and relies on fail-closed RLS', () => {
    expect(bootstrapMigration).toContain('GRANT SELECT ON TABLE public.drivers TO anon');
    expect(bootstrapMigration).not.toContain('GRANT UPDATE ON TABLE public.drivers TO anon');
    expect(bootstrapMigration).not.toContain('GRANT DELETE');
  });

  it('keeps the hosted canonical mirror aligned with the bootstrap grants', () => {
    expect(canonicalMigration).toContain('GRANT SELECT ON TABLE public.drivers TO anon');
    expect(canonicalMigration).toContain('GRANT SELECT, INSERT, UPDATE');
    expect(canonicalMigration).toContain('TO authenticated');
    expect(canonicalMigration).toContain('TO service_role');
  });
});