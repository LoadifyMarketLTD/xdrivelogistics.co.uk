import fs from 'node:fs';
import path from 'node:path';

import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';
import type { WorkspaceRole } from '../lib/workspaceRole';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const activeContext = (workspaceRole: WorkspaceRole) => ({
  workspaceRole,
  accountStatus: 'active',
  companyStatus: 'active',
  driverId: workspaceRole === 'driver' || workspaceRole === 'owner_driver' ? 'driver-fixture' : null,
  driverStatus: workspaceRole === 'driver' || workspaceRole === 'owner_driver' ? 'active' : null,
  appAccess: workspaceRole === 'driver' || workspaceRole === 'owner_driver' ? true : null,
  canCommercialBid: workspaceRole === 'owner_driver' ? true : false,
});

describe('workspace More audit contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const css = read('app/components/workspace/top-workspace-shell.css');

  it('keeps More above the workspace body instead of clipping it inside the scrolling nav track', () => {
    expect(css).toContain('position: fixed;');
    expect(css).toContain('top: 92px !important;');
    expect(css).toContain('max-height: calc(100vh - 104px);');
    expect(css).toContain('overflow-y: auto;');
    expect(css).toContain('right: 8px !important;');
  });

  it('removes compatibility-only Broker and Customer destinations from More', () => {
    const broker = shell.slice(shell.indexOf('function composeBrokerPrototypeNav'), shell.indexOf('function filterWorkspaceNavByAccess'));
    const customer = shell.slice(shell.indexOf('function composeCustomerPrototypeNav'), shell.indexOf('export default function TopWorkspaceShell'));
    expect(broker).not.toContain('/broker/compare-quotes');
    expect(broker).not.toContain('/broker/awards');
    expect(customer).not.toContain('/customer/awards');
    expect(broker).toContain("label: 'Directory', href: '/broker/carrier-network'");
    expect(customer).toContain("label: 'Directory', href: '/customer/network'");
  });

  it('does not duplicate hub-owned Carrier routes inside More and keeps Dispatcher free of resource duplicates', () => {
    const carrier = shell.slice(shell.indexOf('function composeCarrierPrimaryNav'), shell.indexOf('function composeFleetPrimaryNav'));
    const dispatcher = shell.slice(shell.indexOf('function composeDispatcherPrimaryNav'), shell.indexOf('function composeFinancePrimaryNav'));
    const carrierMorePreferred = carrier.slice(carrier.indexOf('const morePreferred'), carrier.indexOf('const more: WorkspaceNavItem[]'));
    expect(carrier).toContain('const carrierHubOwnedHrefs = new Set([');
    for (const href of ['/admin/won-work', '/admin/fleet/drivers', '/admin/fleet/vehicles', '/admin/settings/billing']) {
      expect(carrier).toContain(`'${href}'`);
      expect(carrierMorePreferred).not.toContain(`'${href}'`);
    }
    expect(carrier).toContain('...carrierHubOwnedHrefs');
    const dispatcherMore = dispatcher.slice(dispatcher.indexOf("], 'dispatcher-more', 'More', ["));
    expect(dispatcherMore).not.toContain("'/admin/fleet/drivers'");
    expect(dispatcherMore).not.toContain("'/admin/fleet/vehicles'");
  });

  it('keeps every retained More destination permitted for its operational role', () => {
    const routes: Array<[WorkspaceRole, string[]]> = [
      ['company_admin', ['/admin/action-centre', '/admin/won-work', '/admin/jobs', '/admin/fleet/assignments', '/admin/pod', '/admin/quotes', '/admin/invoices', '/admin/documents', '/admin/messages', '/admin/event-log', '/admin/team', '/admin/fleet/managers', '/admin/dispatchers']],
      ['broker', ['/broker/customers', '/broker/margins', '/broker/disputes', '/broker/messages', '/broker/event-log', '/broker/carrier-network', '/broker/customer-invoices', '/broker/carrier-costs', '/broker/team']],
      ['customer', ['/customer/deliveries', '/customer/documents', '/customer/updates', '/customer/network', '/customer/messages', '/customer/disputes', '/customer/event-log', '/customer/team']],
      ['driver', ['/driver/notifications', '/driver/messages', '/driver/change-password', '/driver/event-log', '/driver/account']],
      ['owner_driver', ['/driver/won-work', '/driver/availability', '/driver/load-alerts', '/driver/nearby', '/driver/documents', '/driver/finance', '/driver/messages', '/driver/event-log', '/driver/freight-vision', '/driver/drivers-vehicles', '/driver/settings']],
      ['fleet_manager', ['/admin/fleet/assignments', '/admin/fleet/availability', '/admin/fleet/future-availability', '/admin/fleet/positions', '/admin/fleet/maintenance', '/admin/incidents', '/admin/messages', '/admin/event-log', '/admin/invoices', '/admin/fleet/compliance']],
      ['dispatcher', ['/admin/incidents', '/admin/pod', '/admin/freight-vision', '/admin/live-availability', '/admin/fleet/resources', '/admin/messages', '/admin/event-log']],
    ];

    for (const [role, paths] of routes) {
      for (const pathname of paths) {
        expect(isCapabilityAllowedForPath(pathname, null, activeContext(role)), `${role}: ${pathname}`).toBe(true);
      }
    }
  });

  it('keeps Action Centre reachable once from More for Driver and Owner Driver', () => {
    const driver = shell.slice(shell.indexOf('function composeDriverPrimaryNav'), shell.indexOf('function composeDispatcherPrimaryNav'));
    expect(driver).toContain("'/driver/action-centre'");
    expect(driver).not.toContain("['driver-action-centre-primary', 'Action Centre', '/driver/action-centre']");
    expect(driver).not.toContain("['owner-driver-action-centre-primary', 'Action Centre', '/driver/action-centre']");
    expect(isCapabilityAllowedForPath('/driver/action-centre', null, activeContext('driver'))).toBe(true);
    expect(isCapabilityAllowedForPath('/driver/action-centre', null, activeContext('owner_driver'))).toBe(true);
  });
  it('keeps Owner Driver More focused on secondary work, business, operations and administration', () => {
    const owner = shell.slice(shell.indexOf('function composeDriverPrimaryNav'), shell.indexOf('function composeDispatcherPrimaryNav'));
    for (const href of ['/driver/won-work', '/driver/availability', '/driver/load-alerts', '/driver/nearby', '/driver/documents', '/driver/finance', '/driver/messages', '/driver/event-log', '/driver/freight-vision', '/driver/drivers-vehicles', '/driver/settings']) {
      expect(owner).toContain(`'${href}'`);
    }
    for (const duplicate of ['/driver/notifications', '/driver/change-password', '/driver/profile', '/driver/settings?section=company', '/driver/settings?section=overview', '/settings/billing']) {
      expect(owner).not.toContain(`'${duplicate}'`);
    }
    expect(owner).toContain("], 'owner-driver-more', 'More', [");
    expect(shell).toContain("'/driver/won-work': 'Work'");
    expect(shell).toContain("'/driver/availability': 'Matching & Availability'");
    expect(shell).toContain("'/driver/finance': 'Business'");
    expect(shell).toContain("'/driver/event-log': 'Operations'");
    expect(shell).toContain("'/driver/settings': 'Administration'");
  });

  it('allows employed Driver Settings because the primary navbar exposes it', () => {
    expect(isCapabilityAllowedForPath('/driver/settings', null, activeContext('driver'))).toBe(true);
  });

  it('retires the obsolete standalone Driver More cards in favour of the canonical shell', () => {
    const driverMore = read('app/driver/more/page.tsx');
    expect(driverMore).toContain("redirect('/driver')");
    expect(driverMore).not.toContain('Compliance');
    expect(driverMore).not.toContain('Support');
  });
});
