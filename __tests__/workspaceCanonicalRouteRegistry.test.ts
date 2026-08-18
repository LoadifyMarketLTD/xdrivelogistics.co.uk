import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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

const pagePath = (href: string) => {
  const pathname = href.split('?')[0]?.split('#')[0] ?? href;
  return resolve(process.cwd(), 'app', pathname.replace(/^\//, ''), 'page.tsx');
};

describe('canonical operational workspace route registry', () => {
  it.each(operationalRoles)('registers every canonical %s navigation target', (role) => {
    const definition = getWorkspaceDefinition(role);
    const hrefs = definition.nav.flatMap((group) => group.items.map((item) => item.href));

    for (const href of hrefs) {
      expect(getProtectedRouteRequirement(href), `${role}: ${href} is not registered`).not.toBeNull();
    }
  });

  it.each(operationalRoles)('backs every canonical %s navigation target with a page', (role) => {
    const definition = getWorkspaceDefinition(role);
    const hrefs = definition.nav.flatMap((group) => group.items.map((item) => item.href));

    for (const href of hrefs) {
      expect(existsSync(pagePath(href)), `${role}: ${href} has no page.tsx`).toBe(true);
    }
  });

  it.each(operationalRoles)('registers and backs the canonical %s primary action when present', (role) => {
    const action = getWorkspaceDefinition(role).primaryAction;
    if (!action) return;

    expect(getProtectedRouteRequirement(action.href), `${role}: ${action.href} is not registered`).not.toBeNull();
    expect(existsSync(pagePath(action.href)), `${role}: ${action.href} has no page.tsx`).toBe(true);
  });
});
