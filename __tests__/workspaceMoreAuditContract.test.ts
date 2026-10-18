import fs from 'node:fs';
import path from 'node:path';

import { isCapabilityAllowedForPath } from '../lib/roleCapabilities';
import type { WorkspaceRole } from '../lib/workspaceRole';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const activeContext = (workspaceRole: WorkspaceRole) => ({
  workspaceRole,
  membershipRole: workspaceRole === 'dispatcher'
    ? 'dispatcher'
    : ['company_owner', 'company_admin', 'carrier_admin'].includes(workspaceRole)
      ? 'owner'
      : null,
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

  it('keeps More curated instead of automatically dumping every leftover route into it', () => {
    const generic = shell.slice(shell.indexOf('export function composeRolePrimaryNav'), shell.indexOf('export function composeCustomerPrimaryNav'));
    expect(generic).toContain('const secondaryEntries = moreHrefs');
    expect(generic).not.toContain('for (const [href, item] of items)');
    const carrier = shell.slice(shell.indexOf('export function composeCarrierPrimaryNav'), shell.indexOf('export function composeFleetPrimaryNav'));
    const fleet = shell.slice(shell.indexOf('export function composeFleetPrimaryNav'), shell.indexOf('type PrimaryNavEntry'));
    expect(carrier).not.toContain('const represented = new Set');
    expect(fleet).not.toContain('const represented = new Set');
  });

  it('keeps compatibility-only Broker and Customer routes out of the curated navigation', () => {
    const broker = shell.slice(shell.indexOf('function composeBrokerPrototypeNav'), shell.indexOf('function filterWorkspaceNavByAccess'));
    const customer = shell.slice(shell.indexOf('function composeCustomerPrototypeNav'), shell.indexOf('export default function TopWorkspaceShell'));
    expect(broker).not.toContain('/broker/compare-quotes');
    expect(broker).not.toContain('/broker/awards');
    expect(customer).not.toContain('/customer/awards');
    expect(broker).toContain("label: 'Directory', href: '/broker/carrier-network/directory'");
    expect(customer).toContain("label: 'Directory', href: '/customer/network'");
  });

  it('moves frequent operational destinations out of More and into primary navigation', () => {
    const customer = shell.slice(shell.indexOf('export function composeCustomerPrimaryNav'), shell.indexOf('export function composeBrokerPrimaryNav'));
    const broker = shell.slice(shell.indexOf('export function composeBrokerPrimaryNav'), shell.indexOf('export function composeDriverPrimaryNav'));
    const driver = shell.slice(shell.indexOf('export function composeDriverPrimaryNav'), shell.indexOf('export function composeDispatcherPrimaryNav'));
    const dispatcher = shell.slice(shell.indexOf('export function composeDispatcherPrimaryNav'), shell.indexOf('function composeFinancePrimaryNav'));

    for (const needle of [
      "['customer-action-centre-primary', 'Action Centre', '/customer/action-centre']",
      "['customer-bookings-primary', 'Bookings', '/customer/bookings']",
      "['customer-settings-primary', 'Settings', '/customer/settings']",
    ]) expect(customer).toContain(needle);

    for (const needle of [
      "['broker-action-centre-primary', 'Action Centre', '/broker/action-centre']",
      "['broker-jobs-primary', 'Jobs', '/broker/jobs']",
      "['broker-pod-primary', 'POD Review', '/broker/pod-review']",
      "['broker-finance-primary', 'Finance', '/broker/finance']",
      "['broker-settings-primary', 'Settings', '/broker/settings']",
    ]) expect(broker).toContain(needle);

    for (const needle of [
      "['driver-action-centre-primary', 'Action Centre', '/driver/action-centre']",
      "['driver-jobs-primary', 'My Jobs', '/driver/jobs']",
      "['driver-settings-primary', 'Settings', '/driver/settings']",
      "['owner-driver-action-centre-primary', 'Action Centre', '/driver/action-centre']",
      "['owner-driver-jobs-primary', 'My Jobs', '/driver/jobs']",
      "['owner-driver-settings-primary', 'Settings', '/driver/settings']",
    ]) expect(driver).toContain(needle);

    for (const needle of [
      "['dispatcher-unallocated-primary', 'Unallocated', '/admin/fleet/assignments']",
      "['dispatcher-active-jobs-primary', 'Active Jobs', '/admin/fleet/active-jobs']",
      "['dispatcher-collections-primary', 'Collections', '/admin/collections']",
      "['dispatcher-deliveries-primary', 'Deliveries', '/admin/deliveries']",
      "['dispatcher-positions-primary', 'Live Positions', '/admin/fleet/positions']",
      "['dispatcher-settings-primary', 'Settings', '/admin/settings']",
    ]) expect(dispatcher).toContain(needle);
  });

  it('keeps every retained More destination permitted for its operational role', () => {
    const routes: Array<[WorkspaceRole, string[]]> = [
      ['company_admin', ['/admin/action-centre', '/admin/bulk-import', '/admin/jobs', '/admin/fleet/assignments', '/admin/pod', '/admin/invoices', '/admin/documents', '/admin/messages', '/admin/event-log']],
      ['broker', ['/broker/bulk-import', '/broker/customers', '/broker/margins', '/broker/messages', '/broker/event-log', '/broker/disputes', '/broker/customer-invoices', '/broker/carrier-costs', '/broker/reports', '/broker/team']],
      ['customer', ['/customer/bulk-import', '/customer/deliveries', '/customer/documents', '/customer/updates', '/customer/messages', '/customer/disputes', '/customer/event-log', '/customer/invoices', '/customer/team']],
      ['driver', ['/driver/messages', '/driver/event-log']],
      ['owner_driver', ['/driver/availability', '/driver/load-alerts', '/driver/nearby', '/driver/documents', '/driver/finance', '/driver/messages', '/driver/event-log']],
      ['fleet_manager', ['/admin/action-centre', '/admin/fleet/assignments', '/admin/fleet/maintenance', '/admin/incidents', '/admin/messages', '/admin/event-log', '/admin/invoices', '/admin/fleet/compliance']],
      ['dispatcher', ['/admin/action-centre', '/admin/bulk-import', '/admin/incidents', '/admin/pod', '/admin/messages', '/admin/event-log']],
    ];

    for (const [role, paths] of routes) {
      for (const pathname of paths) {
        expect(isCapabilityAllowedForPath(pathname, null, activeContext(role)), `${role}: ${pathname}`).toBe(true);
      }
    }
  });

  it('keeps Settings and Action Centre out of More whenever they are primary', () => {
    const customer = shell.slice(shell.indexOf('export function composeCustomerPrimaryNav'), shell.indexOf('export function composeBrokerPrimaryNav'));
    const broker = shell.slice(shell.indexOf('export function composeBrokerPrimaryNav'), shell.indexOf('export function composeDriverPrimaryNav'));
    const driver = shell.slice(shell.indexOf('export function composeDriverPrimaryNav'), shell.indexOf('export function composeDispatcherPrimaryNav'));
    const dispatcher = shell.slice(shell.indexOf('export function composeDispatcherPrimaryNav'), shell.indexOf('function composeFinancePrimaryNav'));

    expect(customer.slice(customer.indexOf("], 'customer-more', 'More', ["))).not.toContain("'/customer/settings'");
    expect(customer.slice(customer.indexOf("], 'customer-more', 'More', ["))).not.toContain("'/customer/action-centre'");
    expect(broker.slice(broker.indexOf("], 'broker-more', 'More', ["))).not.toContain("'/broker/settings'");
    expect(broker.slice(broker.indexOf("], 'broker-more', 'More', ["))).not.toContain("'/broker/action-centre'");
    expect(driver.slice(driver.indexOf("], 'driver-more', 'More', ["), driver.indexOf("return composeRolePrimaryNav(groups, [", driver.indexOf("], 'driver-more', 'More', [")))).not.toContain("'/driver/settings'");
    expect(dispatcher.slice(dispatcher.indexOf("], 'dispatcher-more', 'More', ["))).not.toContain("'/admin/settings'");
  });

  it('retires the obsolete standalone Driver More cards in favour of the canonical shell', () => {
    const driverMore = read('app/driver/more/page.tsx');
    expect(driverMore).toContain("redirect('/driver')");
    expect(driverMore).not.toContain('Compliance');
    expect(driverMore).not.toContain('Support');
  });
});
