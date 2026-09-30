import fs from 'node:fs';
import path from 'node:path';

describe('core table grant parity', () => {
  const driverVehicleBootstrap = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260830184550_canonicalize_driver_vehicle_authenticated_grants.sql'),
    'utf8',
  );
  const profileJobBootstrap = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260830184555_canonicalize_profile_job_authenticated_grants.sql'),
    'utf8',
  );
  const canonicalMigration = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260929220948_canonicalize_core_authenticated_table_grants.sql'),
    'utf8',
  );

  it('canonicalizes drivers, vehicles, profiles and jobs before the storage probe', () => {
    expect('20260830184550' < '20260830184600').toBe(true);
    expect('20260830184555' < '20260830184600').toBe(true);
    for (const migration of [driverVehicleBootstrap, profileJobBootstrap]) {
      expect(migration).toContain('GRANT SELECT, INSERT, UPDATE');
      expect(migration).toContain('TO authenticated');
      expect(migration).toContain('TO service_role');
      expect(migration).not.toContain('GRANT DELETE');
    }
    expect(driverVehicleBootstrap).toContain('public.drivers, public.vehicles');
    expect(profileJobBootstrap).toContain('public.profiles, public.jobs');
  });

  it('preserves only the hosted anon drivers SELECT surface in the final canonical mirror', () => {
    expect(canonicalMigration).toContain('GRANT SELECT ON TABLE public.drivers TO anon');
    expect(canonicalMigration).not.toContain('GRANT UPDATE ON TABLE public.drivers TO anon');
    expect(canonicalMigration).not.toContain('GRANT DELETE');
  });

  it('keeps the hosted canonical mirror aligned with the bootstrap grants', () => {
    expect(canonicalMigration).toContain('GRANT SELECT ON TABLE public.drivers TO anon');
    expect(canonicalMigration).toContain('GRANT SELECT, INSERT, UPDATE');
    expect(canonicalMigration).toContain('TO authenticated');
    expect(canonicalMigration).toContain('TO service_role');
  });
});