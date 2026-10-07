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

const assertCanonicalPreserved = (
  role: WorkspaceRole,
  presented: Array<{ items: Array<{ href: string }> }>,
) => {
  const canonical = new Set(hrefs(getVisibleWorkspaceNav(role)));
  const visible = new Set(hrefs(presented));
  for (const href of canonical) {
    expect(visible.has(href), role + ' lost canonical nav route ' + href).toBe(true);
  }
};

describe('all operational workspace navigation remains visually reachable', () => {
  it('preserves every canonical Customer route while keeping the preferred layout', () => {
    const canonical = getVisibleWorkspaceNav('customer');
    const merged = mergeCanonicalNavFallback(composeCustomerPrototypeNav(), canonical);
    assertCanonicalPreserved('customer', composeCustomerPrimaryNav(merged));
  });

  it('preserves every canonical Broker route while keeping the preferred layout', () => {
    const canonical = getVisibleWorkspaceNav('broker');
    const merged = mergeCanonicalNavFallback(composeBrokerPrototypeNav(), canonical);
    assertCanonicalPreserved('broker', composeBrokerPrimaryNav(merged));
  });

  it('preserves every canonical Carrier route', () => {
    assertCanonicalPreserved('company_owner', composeCarrierPrimaryNav(getVisibleWorkspaceNav('company_owner')));
  });

  it('preserves every canonical Fleet Manager route', () => {
    assertCanonicalPreserved('fleet_manager', composeFleetPrimaryNav(getVisibleWorkspaceNav('fleet_manager')));
  });

  it('preserves every canonical Dispatcher route', () => {
    assertCanonicalPreserved('dispatcher', composeDispatcherPrimaryNav(getVisibleWorkspaceNav('dispatcher')));
  });

  it('preserves every canonical Owner Driver route', () => {
    assertCanonicalPreserved('owner_driver', composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true));
  });

  it('preserves every canonical Driver route', () => {
    assertCanonicalPreserved('driver', composeDriverPrimaryNav(getVisibleWorkspaceNav('driver'), false));
  });

  it('does not hide operational header actions at tablet/mobile breakpoints', () => {
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
    const css = readFileSync(join(process.cwd(), 'app/components/workspace/top-workspace-shell.css'), 'utf8');
    expect(shell).toContain('className="top-workspace-action top-workspace-action--primary"');
    expect(css).not.toContain('.top-workspace-action--signout {\n    display: none;');
    expect(css).not.toContain('.top-workspace-action:not(.top-workspace-action--primary):not(.top-workspace-action--context)');
    expect(css).toContain('overflow-x: auto;');
  });
});
