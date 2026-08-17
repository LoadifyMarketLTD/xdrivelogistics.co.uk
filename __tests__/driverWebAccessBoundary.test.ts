import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { isRoleAllowedForPath } from '../lib/authRole';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';

const ACTIVE_DRIVER_CONTEXT = {
  workspaceRole: 'driver' as const,
  driverId: 'driver-1',
  appAccess: true,
  driverStatus: 'active',
  accountStatus: 'active',
  companyStatus: 'active',
};

describe('Driver Web access boundary', () => {
  it('registers the canonical Account route instead of falling through the fail-closed driver prefix', () => {
    expect(getProtectedRouteRequirement('/driver/account')?.prefix).toBe('/driver/account');
    expect(isRoleAllowedForPath('/driver/account', 'driver', ACTIVE_DRIVER_CONTEXT)).toBe(true);
  });

  it('keeps Account behind the same explicit Driver app-access and status gate as the Driver portal', () => {
    expect(
      isRoleAllowedForPath('/driver/account', 'driver', {
        ...ACTIVE_DRIVER_CONTEXT,
        appAccess: false,
      }),
    ).toBe(false);

    expect(
      isRoleAllowedForPath('/driver/account', 'driver', {
        ...ACTIVE_DRIVER_CONTEXT,
        driverStatus: 'suspended',
      }),
    ).toBe(false);
  });

  it('continues to fail closed for unknown Driver routes', () => {
    expect(isRoleAllowedForPath('/driver/not-a-real-route', 'driver', ACTIVE_DRIVER_CONTEXT)).toBe(false);
  });

  it('keeps the client gate aligned with the middleware standalone-driver normalization', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/components/ProtectedRoute.tsx'), 'utf8');

    expect(source).toContain("user.role === 'driver' && user.membershipId == null && user.companyStatus == null");
    expect(source).toContain('membershipId: user.membershipId ?? null');
    expect(source).toContain('companyStatus: companyStatusForAccess');
    expect(source).toContain('driverStatus: user.driverStatus ?? null');
    expect(source).toContain('appAccess: user.appAccess');
  });
});
