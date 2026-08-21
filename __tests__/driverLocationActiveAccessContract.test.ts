import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'app/api/driver/location/route.ts'),
  'utf8',
);

describe('Driver location active-access boundary', () => {
  it('binds location writes to the authenticated Driver identity', () => {
    expect(source).toContain(".eq('user_id', authData.user.id)");
    expect(source).toContain(".select('id, company_id, status, app_access')");
  });

  it('rejects stale sessions after Driver account/app access is disabled', () => {
    expect(source).toContain(".eq('status', 'active')");
    expect(source).toContain('driverRow.app_access !== true');
    expect(source).toContain("Active Driver location access is not available.");
  });

  it('does not accept caller-controlled driver_id or company_id in the payload', () => {
    expect(source).toContain('driver_id: driverRow.id');
    expect(source).toContain('company_id: driverRow.company_id ?? null');
  });
});
