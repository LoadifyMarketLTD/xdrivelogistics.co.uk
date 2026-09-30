import fs from 'node:fs';
import path from 'node:path';

describe('company membership role type fresh-schema parity', () => {
  const alignment = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260927105959_align_company_membership_role_type_to_hosted.sql'),
    'utf8',
  );
  const fleetManager = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20260927110000_fleet_manager_persisted_role_foundation.sql'),
    'utf8',
  );

  it('converts the legacy enum to hosted text before Fleet Manager constraint installation', () => {
    expect('20260927105959' < '20260927110000').toBe(true);
    expect(alignment).toContain('CREATE TEMP TABLE _role_in_company_policy_backup');
    expect(alignment).toContain("d.classid = 'pg_policy'::regclass");
    expect(alignment).toContain("a.attname = 'role_in_company'");
    expect(alignment).toContain('DROP POLICY IF EXISTS %I ON %I.%I');
    expect(alignment).toContain('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s');
    expect(alignment).toContain('ALTER COLUMN role_in_company TYPE text');
    expect(alignment).toContain('USING role_in_company::text');
    expect(fleetManager).toContain('company_memberships_role_in_company_check');
    expect(fleetManager).toContain("'fleet_manager'::text");
  });

  it('matches hosted nullability/default without silently rewriting unknown memberships', () => {
    expect(alignment).toContain("ALTER COLUMN role_in_company SET DEFAULT 'member'::text");
    expect(alignment).toContain('ALTER COLUMN role_in_company SET NOT NULL');
    expect(alignment).toContain('manual remediation required before hosted type alignment');
    expect(alignment).not.toContain("UPDATE public.company_memberships");
  });
});