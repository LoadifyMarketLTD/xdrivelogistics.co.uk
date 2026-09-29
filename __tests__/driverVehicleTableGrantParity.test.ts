import fs from 'node:fs';
import path from 'node:path';

const driverVehicleMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260830184550_canonicalize_driver_vehicle_authenticated_grants.sql',
  ),
  'utf8',
);

const profileJobMigration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260830184555_canonicalize_profile_job_authenticated_grants.sql',
  ),
  'utf8',
);

describe('fresh-branch table grant parity', () => {
  it('restores authenticated Driver/Fleet table privileges required by RLS-backed reads and writes', () => {
    expect(driverVehicleMigration).toContain('GRANT SELECT, INSERT, UPDATE');
    expect(driverVehicleMigration).toContain('ON TABLE public.drivers, public.vehicles');
    expect(driverVehicleMigration).toContain('TO authenticated;');
  });

  it('restores authenticated profile/job privileges used by Storage policy dependencies', () => {
    expect(profileJobMigration).toContain('GRANT SELECT, INSERT, UPDATE');
    expect(profileJobMigration).toContain('ON TABLE public.profiles, public.jobs');
    expect(profileJobMigration).toContain('TO authenticated;');
  });

  it('removes dangerous fresh-branch privileges that are not present in Production', () => {
    expect(driverVehicleMigration).toContain('REVOKE TRUNCATE, REFERENCES, TRIGGER');
    expect(driverVehicleMigration).toContain('FROM anon, authenticated;');
    expect(profileJobMigration).toContain('REVOKE TRUNCATE, REFERENCES, TRIGGER');
    expect(profileJobMigration).toContain('FROM anon, authenticated;');
  });

  it('keeps service-role authority explicit', () => {
    expect(driverVehicleMigration).toContain('GRANT ALL');
    expect(driverVehicleMigration).toContain('TO service_role;');
    expect(profileJobMigration).toContain('GRANT ALL');
    expect(profileJobMigration).toContain('TO service_role;');
  });
});
