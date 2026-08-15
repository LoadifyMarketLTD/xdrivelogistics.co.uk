import { describe, expect, it } from 'vitest';
import { getVisibleWorkspaceNav } from '../lib/workspaceRole';

const visibleHrefs = (role: Parameters<typeof getVisibleWorkspaceNav>[0]) =>
  getVisibleWorkspaceNav(role).flatMap((group) => group.items.map((item) => item.href));

describe('visible workspace navigation', () => {
  it('keeps Account visible in the Carrier workspace', () => {
    expect(visibleHrefs('carrier_admin')).toContain('/admin/settings');
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
