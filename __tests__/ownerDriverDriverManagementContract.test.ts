import { describe, expect, it } from 'vitest';
import { getVisibleWorkspaceNav, hasWorkspaceCapability } from '../lib/workspaceRole';
import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';

const context = {
  workspaceRole: 'owner_driver' as const,
  accountStatus: 'active',
  companyStatus: 'active',
  driverStatus: 'active',
  driverId: 'driver-1',
  appAccess: true,
  ownerDriverWorkspace: true,
};

describe('owner driver sole-trader boundary', () => {
  it('does not grant multi-driver or team-management capabilities', () => {
    expect(hasWorkspaceCapability('owner_driver', 'drivers.manage')).toBe(false);
    expect(hasWorkspaceCapability('owner_driver', 'company.members.manage')).toBe(false);
    const hrefs = getVisibleWorkspaceNav('owner_driver').flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).not.toContain('/driver/drivers');
    expect(hrefs).not.toContain('/driver/drivers-vehicles');
  });

  it('keeps fleet-style routes denied while preserving own vehicle access', () => {
    expect(isCapabilityAllowedForPath('/driver/drivers', 'driver', context)).toBe(false);
    expect(isCapabilityAllowedForPath('/driver/drivers-vehicles', 'driver', context)).toBe(false);
    expect(isCapabilityAllowedForPath('/driver/vehicles', 'driver', context)).toBe(true);
  });
});
