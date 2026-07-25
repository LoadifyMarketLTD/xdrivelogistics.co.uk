import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { parseDriverLocationPayload } from '../lib/driverLocation';

const adminOperationsRoute = readFileSync(
  resolve(process.cwd(), 'app/api/admin/operations-centre/route.ts'),
  'utf8'
);

const superAdminOperationsRoute = readFileSync(
  resolve(process.cwd(), 'app/api/super-admin/operations/route.ts'),
  'utf8'
);

test.describe('driver location payload contract', () => {
  test('accepts canonical location fields', () => {
    const result = parseDriverLocationPayload({
      lat: 51.5074,
      lng: -0.1278,
      heading: 180,
      speed_mph: 42.5,
    });

    expect(result.success).toBe(true);
  });

  test('rejects invalid latitude and longitude', () => {
    expect(parseDriverLocationPayload({ lat: 91, lng: 0 }).success).toBe(false);
    expect(parseDriverLocationPayload({ lat: 0, lng: -181 }).success).toBe(false);
  });

  test('rejects invalid heading and negative speed', () => {
    expect(parseDriverLocationPayload({ lat: 0, lng: 0, heading: 361 }).success).toBe(false);
    expect(parseDriverLocationPayload({ lat: 0, lng: 0, speed_mph: -1 }).success).toBe(false);
  });

  test('allows nullable heading and speed for best-effort telemetry', () => {
    const result = parseDriverLocationPayload({
      lat: 52.1,
      lng: 0.12,
      heading: null,
      speed_mph: null,
    });

    expect(result.success).toBe(true);
  });
});

test.describe('driver location readers use canonical columns', () => {
  test('admin operations centre no longer reads the legacy location column', () => {
    expect(adminOperationsRoute).toContain("from('driver_locations').select('id,driver_id,company_id,lat,lng,heading,speed_mph,recorded_at')");
    expect(adminOperationsRoute).not.toContain('driver_id,location,recorded_at');
    expect(adminOperationsRoute).toContain(".eq('company_id', activeCompanyId)");
  });

  test('super-admin operations no longer parse PostGIS location objects', () => {
    expect(superAdminOperationsRoute).toContain("select('driver_id, company_id, lat, lng, heading, speed_mph, recorded_at')");
    expect(superAdminOperationsRoute).toContain("select('id, driver_id, company_id, lat, lng, heading, speed_mph, recorded_at')");
    expect(superAdminOperationsRoute).not.toContain('coordinatesFromLocation');
  });
});
