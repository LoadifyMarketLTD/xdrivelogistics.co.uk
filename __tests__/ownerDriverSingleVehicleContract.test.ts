import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Owner Driver single-vehicle contract', () => {
  const page = read('app/driver/vehicles/page.tsx');
  const api = read('app/api/driver/vehicles/route.ts');

  it('presents My Vehicle instead of a fleet-management surface', () => {
    expect(page).toContain('<h1>My Vehicle</h1>');
    expect(page).toContain('Your sole-trader vehicle');
    expect(page).not.toContain('<h1>My Fleet</h1>');
    expect(page).not.toContain('Fleet Filters');
    expect(page).not.toContain('Company Vehicles');
    expect(page).not.toContain('Unassign');
  });

  it('scopes Owner Driver reads to the vehicle assigned to that driver profile', () => {
    expect(api).toContain(".select('id, company_id, status, driver_type')");
    expect(api).toContain("const isOwnerDriver = String(driver.driver_type ?? '').trim().toLowerCase() === 'owner_driver';");
    expect(api).toContain("if (isOwnerDriver || !canManageCompanyVehicles) query = query.eq('assigned_driver_id', driverId);");
  });

  it('prevents Owner Driver from adding a fleet inventory through the Driver endpoint', () => {
    expect(api).toContain('Owner Driver accounts manage one active vehicle here.');
    expect(api).toContain("...(isOwnerDriver ? { assigned_driver_id: driverId } : {})");
    expect(api).toContain('Owner Driver access is limited to the vehicle assigned to this driver profile.');
  });
});
