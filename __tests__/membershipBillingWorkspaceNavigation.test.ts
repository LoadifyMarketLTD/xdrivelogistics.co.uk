import { describe, expect, it } from 'vitest';

import { getVisibleWorkspaceNav, hasWorkspaceCapability, type WorkspaceRole } from '../lib/workspaceRole';

const billingRouteByRole: Partial<Record<WorkspaceRole, string>> = {
  company_owner: '/admin/settings/billing',
  company_admin: '/admin/settings/billing',
  broker: '/broker/settings/billing',
  customer: '/customer/settings/billing',
  owner_driver: '/driver/settings/billing',
};

const visibleHrefs = (role: WorkspaceRole) =>
  getVisibleWorkspaceNav(role).flatMap((group) => group.items.map((item) => item.href));

describe('membership billing workspace navigation', () => {
  it.each<WorkspaceRole>(['company_owner', 'company_admin', 'broker', 'customer', 'owner_driver'])(
    'keeps billing inside the authorised %s workspace',
    (role) => {
      expect(hasWorkspaceCapability(role, 'billing.manage')).toBe(true);
      expect(visibleHrefs(role)).toContain(billingRouteByRole[role]);
      expect(visibleHrefs(role)).not.toContain('/settings/billing');
    },
  );

  it.each<WorkspaceRole>([
    'platform_owner',
    'carrier_admin',
    'fleet_manager',
    'dispatcher',
    'driver',
    'finance',
    'compliance',
    'viewer',
  ])('keeps membership billing out of non-authorised role %s', (role) => {
    expect(hasWorkspaceCapability(role, 'billing.manage')).toBe(false);
    expect(visibleHrefs(role)).not.toContain('/settings/billing');
    expect(visibleHrefs(role)).not.toContain('/driver/settings/billing');
    expect(visibleHrefs(role)).not.toContain('/admin/settings/billing');
    expect(visibleHrefs(role)).not.toContain('/broker/settings/billing');
    expect(visibleHrefs(role)).not.toContain('/customer/settings/billing');
  });
});
