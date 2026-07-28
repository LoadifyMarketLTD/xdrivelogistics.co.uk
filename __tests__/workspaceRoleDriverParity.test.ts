import { describe, expect, it } from 'vitest';

import { getCapabilitiesForRole } from '../lib/roleCapabilities';
import { getVisibleWorkspaceNav, resolveWorkspaceRole } from '../lib/workspaceRole';

describe('driver parity across dual identity contexts', () => {
  it('keeps /driver authorization parity for owner/admin membership when driver context exists', () => {
    const ownerWithDriverWorkspaceRole = resolveWorkspaceRole({
      role: 'driver',
      rawRole: 'driver',
      membershipRole: 'owner',
      ownerDriverWorkspace: true,
    });

    const adminWithDriverWorkspaceRole = resolveWorkspaceRole({
      role: 'driver',
      rawRole: 'driver',
      membershipRole: 'admin',
      ownerDriverWorkspace: true,
    });

    expect(ownerWithDriverWorkspaceRole).toBe('company_owner');
    expect(adminWithDriverWorkspaceRole).toBe('company_admin');
  });

  it('returns identical driver workspace capabilities for driver and owner_driver personas', () => {
    const driverCaps = getCapabilitiesForRole('driver', { workspaceRole: 'driver' });
    const ownerDriverCaps = getCapabilitiesForRole('driver', { workspaceRole: 'owner_driver' });

    expect(driverCaps).toEqual(ownerDriverCaps);
    expect(driverCaps.canViewExchangeLoads).toBe(true);
    expect(driverCaps.canQuoteLoads).toBe(true);
    expect(driverCaps.canExecuteJobs).toBe(true);
    expect(driverCaps.canManageOwnVehicle).toBe(true);
    expect(driverCaps.canUploadPod).toBe(true);
    expect(driverCaps.canViewInvoices).toBe(true);
    expect(driverCaps.canUseReturnJourneys).toBe(true);
  });

  it('returns identical visible navigation hrefs for driver and owner_driver', () => {
    const hrefs = (role: 'driver' | 'owner_driver') =>
      getVisibleWorkspaceNav(role)
        .flatMap((group) => group.items.map((item) => item.href))
        .sort();

    expect(hrefs('driver')).toEqual(hrefs('owner_driver'));
    expect(hrefs('driver')).toEqual([
      '/driver',
      '/driver/availability',
      '/driver/documents',
      '/driver/finance',
      '/driver/history',
      '/driver/jobs',
      '/driver/loads',
      '/driver/messages',
      '/driver/profile',
      '/driver/quotes',
      '/driver/returns',
      '/driver/vehicles',
      '/driver/won-work',
    ]);
  });
});
