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

  it('keeps driver execution parity while owner_driver adds sole-trader business controls', () => {
    const driverCaps = getCapabilitiesForRole('driver', { workspaceRole: 'driver' });
    const ownerDriverCaps = getCapabilitiesForRole('driver', { workspaceRole: 'owner_driver' });

    for (const capabilities of [driverCaps, ownerDriverCaps]) {
      expect(capabilities.canViewExchangeLoads).toBe(true);
      expect(capabilities.canQuoteLoads).toBe(true);
      expect(capabilities.canExecuteJobs).toBe(true);
      expect(capabilities.canManageOwnVehicle).toBe(true);
      expect(capabilities.canUploadPod).toBe(true);
      expect(capabilities.canViewInvoices).toBe(true);
      expect(capabilities.canUseReturnJourneys).toBe(true);
    }
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
    expect(hrefs('driver')).not.toContain('/settings/billing');
    expect(hrefs('owner_driver')).toEqual([...hrefs('driver'), '/settings/billing'].sort());
  });
});
