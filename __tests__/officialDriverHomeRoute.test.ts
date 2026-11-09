import { describe, expect, it } from 'vitest';
import { getWorkspaceHomeRoute } from '../lib/workspaceRole';
import { isRoleAllowedForPath } from '../lib/authRole';

describe('official driver PWA canonical login destination', () => {
  it('routes owner-driver accounts to the integrated PWA', () => {
    expect(getWorkspaceHomeRoute({ role: 'driver', rawRole: 'driver', membershipRole: 'owner', ownerDriverWorkspace: true })).toBe('/driver/jobs');
  });
  it('routes ordinary company driver accounts to the integrated PWA', () => {
    expect(getWorkspaceHomeRoute({ role: 'driver', rawRole: 'driver', ownerDriverWorkspace: false })).toBe('/driver/jobs');
  });
  it('allows an active authenticated driver to open the approved PWA', () => {
    const access = { workspaceRole: 'driver' as const, driverId: 'driver-1', appAccess: true, accountStatus: 'active', companyStatus: 'active', driverStatus: 'active' };
    expect(isRoleAllowedForPath('/driver/official-pwa-live', 'driver', access)).toBe(true);
    expect(isRoleAllowedForPath('/driver/official-pwa/index.html', 'driver', access)).toBe(true);
    expect(isRoleAllowedForPath('/driver/official-pwa/assets/main.js', 'driver', access)).toBe(true);
  });
  it('denies PWA access when the driver is not active or app access is disabled', () => {
    const access = { workspaceRole: 'driver' as const, driverId: 'driver-1', appAccess: true, accountStatus: 'active', companyStatus: 'active', driverStatus: 'active' };
    expect(isRoleAllowedForPath('/driver/official-pwa-live', 'driver', { ...access, appAccess: false })).toBe(false);
    expect(isRoleAllowedForPath('/driver/official-pwa-live', 'driver', { ...access, driverId: null })).toBe(false);
    expect(isRoleAllowedForPath('/driver/official-pwa-live', 'driver', { ...access, driverStatus: 'suspended' })).toBe(false);
  });
  it('does not redirect a customer account into driver mode', () => {
    expect(getWorkspaceHomeRoute({ role: 'customer', rawRole: 'customer' })).not.toContain('/driver/official-pwa-live');
  });
});
