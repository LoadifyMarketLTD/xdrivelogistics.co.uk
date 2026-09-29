import { describe, expect, it } from 'vitest';

import { getCapabilitiesForRole } from '../lib/roleCapabilities';
import { getVisibleWorkspaceNav, resolveWorkspaceRole } from '../lib/workspaceRole';

describe('driver parity across dual identity contexts', () => {
  it('preserves owner-driver identity instead of collapsing it into company owner', () => {
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

    expect(ownerWithDriverWorkspaceRole).toBe('owner_driver');
    expect(adminWithDriverWorkspaceRole).toBe('company_admin');
  });

  it('keeps employed Driver execution-only unless explicit commercial bidding authority exists', () => {
    const driverCaps = getCapabilitiesForRole('driver', { workspaceRole: 'driver' });
    const commercialDriverCaps = getCapabilitiesForRole('driver', {
      workspaceRole: 'driver',
      canCommercialBid: true,
    });
    const ownerDriverCaps = getCapabilitiesForRole('driver', { workspaceRole: 'owner_driver' });

    expect(driverCaps.canViewExchangeLoads).toBe(false);
    expect(driverCaps.canQuoteLoads).toBe(false);
    expect(driverCaps.canExecuteJobs).toBe(true);
    expect(driverCaps.canManageOwnVehicle).toBe(true);
    expect(driverCaps.canUploadPod).toBe(true);
    expect(driverCaps.canViewInvoices).toBe(false);
    expect(driverCaps.canUseReturnJourneys).toBe(false);

    expect(commercialDriverCaps.canViewExchangeLoads).toBe(true);
    expect(commercialDriverCaps.canQuoteLoads).toBe(true);
    expect(commercialDriverCaps.canUseReturnJourneys).toBe(true);

    expect(ownerDriverCaps.canViewExchangeLoads).toBe(true);
    expect(ownerDriverCaps.canQuoteLoads).toBe(true);
    expect(ownerDriverCaps.canExecuteJobs).toBe(true);
    expect(ownerDriverCaps.canManageOwnVehicle).toBe(true);
    expect(ownerDriverCaps.canUploadPod).toBe(true);
    expect(ownerDriverCaps.canViewInvoices).toBe(true);
    expect(ownerDriverCaps.canUseReturnJourneys).toBe(true);
  });

  it('keeps employed Driver navigation execution-first and owner-driver commercial tools separate', () => {
    const hrefs = (role: 'driver' | 'owner_driver') =>
      getVisibleWorkspaceNav(role)
        .flatMap((group) => group.items.map((item) => item.href))
        .sort();

    expect(hrefs('driver')).toEqual([
      '/driver',
      '/driver/availability',
      '/driver/documents',
      '/driver/event-log',
      '/driver/history',
      '/driver/jobs',
      '/driver/messages',
      '/driver/profile',
      '/driver/vehicles',
    ]);
    expect(hrefs('driver')).not.toContain('/driver/loads');
    expect(hrefs('driver')).not.toContain('/driver/quotes');
    expect(hrefs('driver')).not.toContain('/driver/won-work');
    expect(hrefs('driver')).not.toContain('/driver/returns');
    expect(hrefs('driver')).not.toContain('/settings/billing');

    expect(hrefs('owner_driver')).toEqual([
      ...hrefs('driver'),
      '/driver/directory',
      '/driver/finance',
      '/driver/freight-vision',
      '/driver/load-alerts',
      '/driver/loads',
      '/driver/nearby',
      '/driver/quotes',
      '/driver/returns',
      '/driver/won-work',
      '/settings/billing',
    ].sort());
  });
});
