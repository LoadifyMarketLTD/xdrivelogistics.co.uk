import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  composeBrokerPrimaryNav,
  composeBrokerPrototypeNav,
  composeCarrierPrimaryNav,
  composeCustomerPrimaryNav,
  composeCustomerPrototypeNav,
  composeDispatcherPrimaryNav,
  composeDriverPrimaryNav,
  composeFleetPrimaryNav,
  mergeCanonicalNavFallback,
} from '../app/components/workspace/TopWorkspaceShell';
import { getVisibleWorkspaceNav, type WorkspaceRole } from '../lib/workspaceRole';

const hrefs = (groups: Array<{ items: Array<{ href: string }> }>) =>
  groups.flatMap((group) => group.items.map((item) => item.href));

const assertCanonicalPreserved = (role: WorkspaceRole, presented: Array<{ items: Array<{ href: string }> }>) => {
  const canonical = new Set(hrefs(getVisibleWorkspaceNav(role)));
  const visible = new Set(hrefs(presented));
  for (const href of canonical) expect(visible.has(href), role + ' lost canonical nav route ' + href).toBe(true);
};

describe('all operational workspace navigation remains visually reachable', () => {
  it('preserves every canonical Customer route', () => {
    const canonical = getVisibleWorkspaceNav('customer');
    assertCanonicalPreserved('customer', composeCustomerPrimaryNav(mergeCanonicalNavFallback(composeCustomerPrototypeNav(), canonical)));
  });

  it('preserves every canonical Broker route', () => {
    const canonical = getVisibleWorkspaceNav('broker');
    assertCanonicalPreserved('broker', composeBrokerPrimaryNav(mergeCanonicalNavFallback(composeBrokerPrototypeNav(), canonical)));
  });

  it('preserves every canonical Carrier, Fleet and Dispatcher route', () => {
    assertCanonicalPreserved('company_owner', composeCarrierPrimaryNav(getVisibleWorkspaceNav('company_owner')));
    assertCanonicalPreserved('fleet_manager', composeFleetPrimaryNav(getVisibleWorkspaceNav('fleet_manager')));
    assertCanonicalPreserved('dispatcher', composeDispatcherPrimaryNav(getVisibleWorkspaceNav('dispatcher')));
  });

  it('presents only the approved Owner Driver sole-trader shell', () => {
    const presented = composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true);
    const visible = new Set(hrefs(presented));
    for (const href of ['/driver','/driver/loads','/driver/quotes','/driver/jobs','/driver/history','/driver/availability','/driver/returns','/driver/directory','/driver/finance','/driver/load-alerts','/driver/nearby','/driver/documents','/driver/messages','/driver/vehicles','/driver/settings']) {
      expect(visible.has(href), `owner_driver lost approved route ${href}`).toBe(true);
    }
    for (const forbidden of ['/driver/availability/live','/driver/drivers-vehicles','/driver/drivers','/driver/freight-vision','/driver/won-work']) {
      expect(visible.has(forbidden), `owner_driver still exposes non-shell route ${forbidden}`).toBe(false);
    }
    expect(presented.some((group) => group.label === 'More')).toBe(true);
  });

  it('preserves every canonical Driver route', () => {
    assertCanonicalPreserved('driver', composeDriverPrimaryNav(getVisibleWorkspaceNav('driver'), false));
  });

  it('does not hide operational header actions at tablet/mobile breakpoints', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'app/components/workspace/top-workspace-shell.css'), 'utf8');
    expect(shell).toContain('className="top-workspace-action top-workspace-action--primary"');
    expect(css).toContain('overflow-x: auto;');
  });
});
