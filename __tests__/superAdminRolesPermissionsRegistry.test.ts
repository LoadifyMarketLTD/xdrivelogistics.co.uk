import { describe, expect, it } from 'vitest';

import { CANONICAL_ROLES } from '../app/super-admin/settings/roles-permissions/rolesRegistry';
import { SUPER_ADMIN_WORKSPACE_DEFINITION } from '../app/super-admin/_components/SuperAdminWorkspaceShell';
import {
  WORKSPACE_DEFINITIONS,
  getWorkspaceCapabilities,
  type WorkspaceRole,
} from '../lib/workspaceRole';

const unique = <T,>(values: readonly T[]) => [...new Set(values)];

const routesForRole = (role: WorkspaceRole) => {
  const definition =
    role === 'platform_owner' ? SUPER_ADMIN_WORKSPACE_DEFINITION : WORKSPACE_DEFINITIONS[role];
  return unique([
    definition.homeHref,
    ...definition.nav.flatMap((group) => group.items.map((item) => item.href)),
  ]);
};

describe('super-admin roles & permissions registry', () => {
  it('derives every displayed capability chip from the canonical runtime registry', () => {
    for (const role of CANONICAL_ROLES) {
      const displayed = role.capabilityGroups.flatMap((group) => group.capabilities).sort();
      expect(displayed).toEqual(getWorkspaceCapabilities(role.workspaceRole));
    }
  });

  it('derives displayed workspace routes from the canonical workspace definitions', () => {
    for (const role of CANONICAL_ROLES) {
      expect(role.routeAccess).toEqual(routesForRole(role.workspaceRole));
    }
  });
});
