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

  it('keeps every Owner Driver capability visually reachable through compact primary navigation plus More', () => {
    const presented = composeDriverPrimaryNav(getVisibleWorkspaceNav('owner_driver'), true);
    assertCanonicalPreserved('owner_driver', presented);
    const visible = new Set(hrefs(presented));
    for (const href of ['/driver/jobs','/driver/won-work','/driver/availability','/driver/load-alerts','/driver/nearby','/driver/finance','/driver/documents','/driver/messages','/driver/event-log','/driver/freight-vision','/driver/settings','/driver/drivers-vehicles']) {
      expect(visible.has(href), `owner_driver lost route ${href}`).toBe(true);
    }
    expect(presented.some((group) => group.id === 'owner-driver-more')).toBe(true);
    const shell = readFileSync(join(process.cwd(), 'app/components/workspace/TopWorkspaceShell.tsx'), 'utf8');
    expect(shell).toContain('onClick={() => router.push(notificationsHref)}');
    expect(shell).toContain("], 'owner-driver-more', 'More', [");
  });

  it('preserves every canonical Driver route', () => {
    assertCanonicalPreserved('driver', composeDriverPrimaryNav(getVisibleWorkspaceNav('driver'), false));
  });

  it('uses one shared tab/navigation geometry across Driver secondary pages', () => {
    const integratedNav = readFileSync(join(process.cwd(), 'app/driver/_components/DriverIntegratedNav.tsx'), 'utf8');
    const sharedTabs = readFileSync(join(process.cwd(), 'app/components/workspace/WorkspaceUI.tsx'), 'utf8');
    const driverLayout = readFileSync(join(process.cwd(), 'app/driver/layout.tsx'), 'utf8');
    expect(integratedNav).toContain('<WorkspaceRouteTabs ariaLabel={label} items={items} />');
    expect(sharedTabs).toContain('.sort((a, b) => b.href.length - a.href.length)');
    expect(driverLayout).not.toContain("import './driver-integrated-nav.css'");
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
