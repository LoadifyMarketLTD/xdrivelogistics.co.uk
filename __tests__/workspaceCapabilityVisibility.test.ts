import { describe, expect, it } from 'vitest';
import { getVisibleWorkspaceNav, hasWorkspaceCapability } from '../lib/workspaceRole';

const visibleHrefs = (role: Parameters<typeof getVisibleWorkspaceNav>[0]) =>
  getVisibleWorkspaceNav(role).flatMap((group) => group.items.map((item) => item.href));

describe('visible workspace navigation', () => {
  it('does not escalate carrier-admin access to mutable company settings', () => {
    expect(hasWorkspaceCapability('carrier_admin', 'settings.manage')).toBe(false);
    expect(visibleHrefs('carrier_admin')).not.toContain('/admin/settings');
  });

  it('keeps Account visible for company roles that already own settings.manage', () => {
    expect(hasWorkspaceCapability('company_owner', 'settings.manage')).toBe(true);
    expect(visibleHrefs('company_owner')).toContain('/admin/settings');
    expect(hasWorkspaceCapability('company_admin', 'settings.manage')).toBe(true);
    expect(visibleHrefs('company_admin')).toContain('/admin/settings');
  });

  it('keeps the full Customer canonical navigation visible', () => {
    expect(visibleHrefs('customer')).toEqual([
      '/customer',
      '/customer/loads',
      '/customer/quotes',
      '/customer/bookings',
      '/customer/tracking',
      '/customer/diary',
      '/customer/network',
      '/customer/account',
    ]);
  });

  it('keeps the Fleet Account entry visible', () => {
    expect(visibleHrefs('fleet_manager')).toContain('/admin/settings');
  });
});