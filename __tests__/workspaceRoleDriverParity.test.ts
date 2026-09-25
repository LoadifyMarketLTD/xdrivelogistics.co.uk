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

  it('separates fleet-driver execution from owner-driver finance capabilities', () => {
    const driverCaps = getCapabilitiesForRole('driver', { workspaceRole: 'driver' });
    const ownerDriverCaps = getCapabilitiesForRole('driver', { workspaceRole: 'owner_driver' });

    expect(driverCaps.canViewExchangeLoads).toBe(true);
    expect(driverCaps.canQuoteLoads).toBe(true);
    expect(driverCaps.canExecuteJobs).toBe(true);
    expect(driverCaps.canManageOwnVehicle).toBe(true);
    expect(driverCaps.canUploadPod).toBe(true);
    expect(driverCaps.canViewInvoices).toBe(false);
    expect(driverCaps.canUseReturnJourneys).toBe(true);

    expect(ownerDriverCaps.canViewExchangeLoads).toBe(true);
    expect(ownerDriverCaps.canQuoteLoads).toBe(true);
    expect(ownerDriverCaps.canExecuteJobs).toBe(true);
    expect(ownerDriverCaps.canManageOwnVehicle).toBe(true);
    expect(ownerDriverCaps.canUploadPod).toBe(true);
    expect(ownerDriverCaps.canViewInvoices).toBe(true);
    expect(ownerDriverCaps.canUseReturnJourneys).toBe(true);
  });
  it('keeps Driver navigation parity while exposing owner-only billing to owner_driver', () => {
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
      '/driver/loads',
      '/driver/messages',
      '/driver/profile',
      '/driver/quotes',
      '/driver/returns',
      '/driver/vehicles',
      '/driver/won-work',
    ]);
    expect(hrefs('driver')).not.toContain('/settings/billing');
    expect(hrefs('owner_driver')).toEqual([...hrefs('driver'), '/driver/finance', '/settings/billing'].sort());
  });
});
