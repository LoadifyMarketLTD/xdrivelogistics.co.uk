import { describe, expect, it } from 'vitest';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';
import { getCapabilitiesForRole, isCapabilityAllowedForPath } from '../lib/roleCapabilities';

const hrefs = (role: 'driver' | 'owner_driver') =>
  getVisibleWorkspaceNav(role).flatMap((group) => group.items.map((item) => item.href));

const activeDriverContext = {
  workspaceRole: 'driver' as const,
  driverId: 'driver-1',
  canCommercialBid: false,
  driverStatus: 'active',
  appAccess: true,
  accountStatus: 'active',
  companyStatus: 'active',
};

describe('Fleet Driver and Owner Driver separation', () => {
  it('keeps employed Driver canonical navigation execution-only', () => {
    expect(hrefs('driver')).not.toContain('/driver/loads');
    expect(hrefs('driver')).not.toContain('/driver/quotes');
    expect(hrefs('driver')).not.toContain('/driver/finance');
  });

  it('keeps Owner Driver commercial and finance tools visible without fleet management', () => {
    for (const href of ['/driver/loads','/driver/quotes','/driver/nearby','/driver/returns','/driver/finance','/driver/settings/billing']) {
      expect(hrefs('owner_driver')).toContain(href);
    }
    for (const forbidden of ['/driver/availability/live','/driver/drivers','/driver/drivers-vehicles']) {
      expect(hrefs('owner_driver')).not.toContain(forbidden);
    }
  });

  it('does not grant employed Driver commercial capability without an explicit grant', () => {
    const denied = getCapabilitiesForRole('driver', activeDriverContext);
    expect(denied.canViewExchangeLoads).toBe(false);
    expect(denied.canQuoteLoads).toBe(false);
    const granted = getCapabilitiesForRole('driver', { ...activeDriverContext, canCommercialBid: true });
    expect(granted.canViewExchangeLoads).toBe(true);
    expect(granted.canQuoteLoads).toBe(true);
  });

  it('keeps route access fail-closed for commercial Driver pages', () => {
    expect(isCapabilityAllowedForPath('/driver/loads', 'driver', activeDriverContext)).toBe(false);
    expect(isCapabilityAllowedForPath('/driver/jobs', 'driver', activeDriverContext)).toBe(true);
  });
});
