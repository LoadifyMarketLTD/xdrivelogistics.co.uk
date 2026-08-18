import { describe, expect, it } from 'vitest';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';
import { getWorkspaceDefinition, type WorkspaceRole } from '../lib/workspaceRole';

const operationalRoles: WorkspaceRole[] = [
  'company_owner',
  'company_admin',
  'carrier_admin',
  'broker',
  'customer',
  'fleet_manager',
  'dispatcher',
  'driver',
  'owner_driver',
  'finance',
  'compliance',
  'viewer',
];

describe('canonical operational workspace route registry', () => {
  it.each(operationalRoles)('registers every canonical %s navigation target', (role) => {
    const definition = getWorkspaceDefinition(role);
    const hrefs = definition.nav.flatMap((group) => group.items.map((item) => item.href));

    for (const href of hrefs) {
      expect(getProtectedRouteRequirement(href), `${role}: ${href} is not registered`).not.toBeNull();
    }
  });
});
