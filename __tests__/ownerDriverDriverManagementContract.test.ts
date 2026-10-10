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

  it('keeps fleet and duplicate control surfaces denied while preserving sole-trader routes', () => {
    for (const path of [
      '/driver/drivers',
      '/driver/drivers-vehicles',
      '/driver/freight-vision',
      '/driver/won-work',
      '/driver/event-log',
      '/driver/action-centre',
    ]) {
      expect(isCapabilityAllowedForPath(path, 'driver', context), path).toBe(false);
    }

    for (const path of [
      '/driver/vehicles',
      '/driver/jobs',
      '/driver/history',
      '/driver/availability',
      '/driver/returns',
      '/driver/load-alerts',
      '/driver/nearby',
      '/driver/documents',
      '/driver/messages',
      '/driver/settings',
    ]) {
      expect(isCapabilityAllowedForPath(path, 'driver', context), path).toBe(true);
    }
  });
});
