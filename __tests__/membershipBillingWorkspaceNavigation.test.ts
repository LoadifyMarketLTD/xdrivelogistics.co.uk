import { describe, expect, it } from 'vitest';

import { getVisibleWorkspaceNav, hasWorkspaceCapability, type WorkspaceRole } from '../lib/workspaceRole';

const hasBillingRoute = (role: WorkspaceRole) =>
  getVisibleWorkspaceNav(role).some((group) => group.items.some((item) => item.href === '/settings/billing'));

describe('membership billing workspace navigation', () => {
  it.each<WorkspaceRole>(['company_owner', 'company_admin', 'broker', 'customer', 'owner_driver'])(
    'exposes membership billing to authorised commercial role %s',
    (role) => {
      expect(hasWorkspaceCapability(role, 'billing.manage')).toBe(true);
      expect(hasBillingRoute(role)).toBe(true);
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
    expect(hasBillingRoute(role)).toBe(false);
  });
});
