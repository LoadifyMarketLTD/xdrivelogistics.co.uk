import { describe, expect, it } from 'vitest';

import { getCapabilitiesForRole } from '../lib/roleCapabilities';
import { getVisibleWorkspaceNav, resolveWorkspaceRole } from '../lib/workspaceRole';

describe('driver parity across dual identity contexts', () => {
  it('preserves owner-driver identity instead of collapsing it into company owner', () => {
    expect(resolveWorkspaceRole({
      role: 'driver',
      rawRole: 'driver',
      membershipRole: 'owner',
      ownerDriverWorkspace: true,
    })).toBe('owner_driver');
  });

  it('keeps employed Driver execution-only and Owner Driver commercially autonomous', () => {
    const driverCaps = getCapabilitiesForRole('driver', { workspaceRole: 'driver' });
    const ownerDriverCaps = getCapabilitiesForRole('driver', { workspaceRole: 'owner_driver' });

    expect(driverCaps.canViewExchangeLoads).toBe(false);
    expect(driverCaps.canQuoteLoads).toBe(false);
    expect(driverCaps.canExecuteJobs).toBe(true);
    expect(driverCaps.canViewInvoices).toBe(false);

    expect(ownerDriverCaps.canViewExchangeLoads).toBe(true);
    expect(ownerDriverCaps.canQuoteLoads).toBe(true);
    expect(ownerDriverCaps.canExecuteJobs).toBe(true);
    expect(ownerDriverCaps.canManageOwnVehicle).toBe(true);
    expect(ownerDriverCaps.canUploadPod).toBe(true);
    expect(ownerDriverCaps.canViewInvoices).toBe(true);
    expect(ownerDriverCaps.canUseReturnJourneys).toBe(true);
    expect(ownerDriverCaps.canManageCompanyUsers).toBe(false);
  });

  it('keeps Owner Driver navigation free of fleet administration', () => {
    const hrefs = getVisibleWorkspaceNav('owner_driver').flatMap((group) => group.items.map((item) => item.href));
    for (const required of [
      '/driver','/driver/jobs','/driver/history','/driver/availability','/driver/vehicles',
      '/driver/documents','/driver/messages','/driver/settings','/driver/loads','/driver/quotes',
      '/driver/load-alerts','/driver/nearby','/driver/directory','/driver/returns','/driver/finance',
    ]) expect(hrefs).toContain(required);

    for (const forbidden of [
      '/driver/availability/live',
      '/driver/drivers-vehicles',
      '/driver/drivers',
      '/driver/freight-vision',
      '/driver/won-work',
      '/driver/event-log',
      '/driver/action-centre',
      '/driver/settings/billing',
      '/driver/change-password',
      '/driver/profile',
    ]) {
      expect(hrefs).not.toContain(forbidden);
    }
  });
});
