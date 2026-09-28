import fs from 'node:fs';
import path from 'node:path';

const migration = fs
  .readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260927143500_harden_vehicle_advertising_actor_state.sql',
    ),
    'utf8',
  )
  .replace(/\r\n/g, '\n');

describe('vehicle advertising actor-state hardening', () => {
  it('requires the vehicle company to remain active', () => {
    expect(migration).toContain('JOIN public.companies c ON c.id = v.company_id');
    expect(migration).toContain("v_company_status IS DISTINCT FROM 'active'");
  });

  it('requires active manager membership and active profile state', () => {
    expect(migration).toContain("cm.status::text = 'active'");
    expect(migration).toContain(
      "cm.role_in_company::text IN ('owner', 'admin', 'fleet_manager', 'dispatcher')",
    );
    expect(migration).toContain("COALESCE(p.status::text, '') = 'active'");
  });

  it('requires an assigned driver to remain active and app-enabled', () => {
    expect(migration).toContain("COALESCE(d.status::text, '') = 'active'");
    expect(migration).toContain('COALESCE(d.app_access, true) = true');
  });

  it('retains authenticated-only execution', () => {
    expect(migration).toContain(
      'FROM PUBLIC, anon, service_role',
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.set_vehicle_advertising_state(uuid, text, text, jsonb)\nTO authenticated',
    );
  });
});
