import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getProtectedRouteRequirement } from '../lib/roleCapabilities';
import { WORKSPACE_DEFINITIONS } from '../lib/workspaceRole';
import {
  composeCarrierPrimaryNav,
  composeFleetPrimaryNav,
  composeDispatcherPrimaryNav,
  composeCustomerPrimaryNav,
  composeBrokerPrimaryNav,
  composeDriverPrimaryNav,
} from '../app/components/workspace/TopWorkspaceShell';

const hrefs = (groups: Array<{items:Array<{href:string}>}>) => groups.flatMap(group => group.items.map(item => item.href));

describe('Directory seven-workspace access contract', () => {
  it('allows the shared admin Directory route for carrier, fleet manager and dispatcher without marketplace capability', () => {
    const requirement = getProtectedRouteRequirement('/admin/marketplace/directory');
    expect(requirement?.prefix).toBe('/admin/marketplace/directory');
    expect(requirement?.roles).toContain('carrier_admin');
    expect(requirement?.roles).toContain('fleet_manager');
    expect(requirement?.roles).toContain('dispatcher');
    expect(requirement?.anyOf).toBeUndefined();
  });

  it('keeps employed and owner drivers allowed into Directory independently of commercial bidding', () => {
    const requirement = getProtectedRouteRequirement('/driver/directory');
    expect(requirement?.roles).toEqual(['driver', 'owner_driver']);
    const roleCaps = fs.readFileSync(path.join(process.cwd(),'lib/roleCapabilities.ts'),'utf8');
    const commercialBlock = roleCaps.slice(roleCaps.indexOf('const isDriverCommercialRoute'), roleCaps.indexOf('/** Sanitised pathname'));
    expect(commercialBlock).not.toContain('/driver/directory');
  });

  it('surfaces Directory in the primary nav for all seven operational workspace personas', () => {
    expect(hrefs(composeCarrierPrimaryNav(WORKSPACE_DEFINITIONS.carrier_admin.nav))).toContain('/admin/marketplace/directory');
    expect(hrefs(composeFleetPrimaryNav(WORKSPACE_DEFINITIONS.fleet_manager.nav))).toContain('/admin/marketplace/directory');
    expect(hrefs(composeDispatcherPrimaryNav(WORKSPACE_DEFINITIONS.dispatcher.nav))).toContain('/admin/marketplace/directory');
    expect(hrefs(composeBrokerPrimaryNav(WORKSPACE_DEFINITIONS.broker.nav))).toContain('/broker/carrier-network/directory');
    expect(hrefs(composeCustomerPrimaryNav(WORKSPACE_DEFINITIONS.customer.nav))).toContain('/customer/network/directory');
    expect(hrefs(composeDriverPrimaryNav(WORKSPACE_DEFINITIONS.owner_driver.nav, true))).toContain('/driver/directory');
    expect(hrefs(composeDriverPrimaryNav(WORKSPACE_DEFINITIONS.driver.nav, false))).toContain('/driver/directory');
  });
});
