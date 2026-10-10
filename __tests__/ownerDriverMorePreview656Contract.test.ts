import { describe, expect, it } from 'vitest';
import { composeDriverPrimaryNav } from '../app/components/workspace/TopWorkspaceShell';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';
import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';

const context = {
  workspaceRole: 'owner_driver' as const,
  driverId: 'owner-driver-1',
  canCommercialBid: true,
  driverStatus: 'active',
  appAccess: true,
  accountStatus: 'active',
  companyStatus: 'active',
};

describe('Owner Driver sole-trader navigation', () => {
  it('keeps the approved primary modules and More tools', () => {
    const nav = composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true);
    expect(nav.map((group) => group.label)).toEqual([
      'Dashboard','Loads','Quotes','My Jobs','Diary','Availability','Return Journeys','Directory','More',
    ]);
  });

  it('authorises sole-trader tools and denies fleet controls', () => {
    for (const href of ['/driver/jobs','/driver/availability','/driver/load-alerts','/driver/nearby','/driver/documents','/driver/finance','/driver/messages','/driver/vehicles']) {
      expect(isCapabilityAllowedForPath(href, 'driver', context), href).toBe(true);
    }
    for (const href of ['/driver/availability/live','/driver/drivers','/driver/drivers-vehicles']) {
      expect(isCapabilityAllowedForPath(href, 'driver', context), href).toBe(false);
    }
  });
});
