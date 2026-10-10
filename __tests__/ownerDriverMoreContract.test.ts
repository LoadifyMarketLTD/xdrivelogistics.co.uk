import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { composeDriverPrimaryNav } from '../app/components/workspace/TopWorkspaceShell';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';
import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';

const ownerContext = {
  workspaceRole: 'owner_driver' as const,
  accountStatus: 'active',
  companyStatus: 'active',
  driverId: 'driver-owner-fixture',
  driverStatus: 'active',
  appAccess: true,
  canCommercialBid: true,
  ownerDriverWorkspace: true,
};

describe('Owner Driver secondary navigation contract', () => {
  it('keeps only sole-trader secondary tools in More', () => {
    const nav = composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true);
    const more = nav.find((group) => group.id === 'owner-driver-more');
    expect(more?.items.map((item) => item.href)).toEqual([
      '/driver/load-alerts',
      '/driver/nearby',
      '/driver/messages',
      '/driver/vehicles',
      '/driver/finance',
      '/driver/documents',
      '/driver/settings',
    ]);
  });

  it('keeps secondary routes real and permitted', () => {
    for (const href of ['/driver/load-alerts','/driver/nearby','/driver/messages','/driver/vehicles','/driver/finance','/driver/documents','/driver/settings']) {
      const routePath = path.join(process.cwd(), 'app', ...href.split('/').filter(Boolean), 'page.tsx');
      expect(fs.existsSync(routePath), href).toBe(true);
      expect(isCapabilityAllowedForPath(href, 'driver', ownerContext), href).toBe(true);
    }
  });

  it('keeps fleet-only driver management inaccessible to Owner Driver', () => {
    expect(isCapabilityAllowedForPath('/driver/drivers', 'driver', ownerContext)).toBe(false);
    expect(isCapabilityAllowedForPath('/driver/drivers-vehicles', 'driver', ownerContext)).toBe(false);
    expect(isCapabilityAllowedForPath('/driver/availability/live', 'driver', ownerContext)).toBe(false);
  });
});
