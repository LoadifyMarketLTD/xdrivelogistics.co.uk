import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Unified workspace navbar contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const shellCss = read('app/components/workspace/top-workspace-shell.css');
  const workspaceRole = read('lib/workspaceRole.ts');

  it('uses one two-row primary navigation shell for operational workspaces', () => {
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(shell).toContain('top-workspace-nav--primary');
    expect(shellCss).toContain('.top-workspace-nav--primary');
    expect(shellCss).toContain('top: 50px !important');
    expect(shellCss).toContain('height: 42px !important');
    expect(shellCss).toContain('padding: 0 13px !important');
    expect(shellCss).toContain('font-size: 13px !important');
    expect(shellCss).toContain('box-shadow: inset 0 -2px 0 #1d57d8 !important');
    expect(baseline).toContain('--ws-nav-h: 42px');
  });

  it('scopes the generic button reset to page content so the navbar stays canonical', () => {
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(baseline).toContain('.xdrive-workspace-measured :where(.top-workspace-shell__content) button:not(.driver-top-shell__logo-button)');
    expect(baseline).not.toMatch(/^\.xdrive-workspace-measured button:not\(/m);
  });

  it('uses role composers without coupling Super Admin to the operational shell', () => {
    for (const composer of [
      'composeCustomerPrimaryNav',
      'composeBrokerPrimaryNav',
      'composeDriverPrimaryNav',
      'composeCarrierPrimaryNav',
      'composeFleetPrimaryNav',
      'composeDispatcherPrimaryNav',
      'composeFinancePrimaryNav',
      'composeCompliancePrimaryNav',
    ]) expect(shell).toContain(composer);
    expect(shell).not.toContain('/super-admin');
  });

  it('keeps More curated and prevents automatic leftover-route injection', () => {
    expect(shell).toContain("moreLabel = 'More'");
    const generic = shell.slice(shell.indexOf('export function composeRolePrimaryNav'), shell.indexOf('export function composeCustomerPrimaryNav'));
    expect(generic).not.toContain('for (const [href, item] of items)');
    const carrier = shell.slice(shell.indexOf('export function composeCarrierPrimaryNav'), shell.indexOf('export function composeFleetPrimaryNav'));
    const fleet = shell.slice(shell.indexOf('export function composeFleetPrimaryNav'), shell.indexOf('type PrimaryNavEntry'));
    expect(carrier).not.toContain('const represented = new Set');
    expect(fleet).not.toContain('const represented = new Set');
  });

  it('keeps Settings primary where the role has settings authority', () => {
    for (const marker of [
      "['carrier-settings', 'Settings', '/admin/settings']",
      "['broker-settings-primary', 'Settings', '/broker/settings']",
      "['customer-settings-primary', 'Settings', '/customer/settings']",
      "['driver-settings-primary', 'Settings', '/driver/settings']",
      "['owner-driver-settings-primary', 'Settings', '/driver/settings']",
      "['dispatcher-settings-primary', 'Settings', '/admin/settings']",
      "finance-settings-primary', 'Settings', '/admin/settings'",
      "compliance-settings-primary', 'Settings', '/admin/settings'",
    ]) expect(shell).toContain(marker);
    expect(workspaceRole).toContain("capability: 'settings.manage'");
  });

  it('keeps Customer frequent work primary and secondary lifecycle tools in More', () => {
    for (const marker of [
      "customer-dashboard-primary', 'Dashboard', '/customer'",
      "customer-action-centre-primary', 'Action Centre', '/customer/action-centre'",
      "customer-loads-primary', 'Loads', '/customer/loads'",
      "customer-quotes-primary', 'Quotes', '/customer/quotes'",
      "customer-bookings-primary', 'Bookings', '/customer/bookings'",
      "customer-diary-primary', 'Diary', '/customer/diary'",
      "customer-tracking-primary', 'Tracking', '/customer/tracking'",
      "customer-network-primary', 'Network', '/customer/network'",
      "customer-settings-primary', 'Settings', '/customer/settings'",
    ]) expect(shell).toContain(marker);
    expect(shell).not.toContain("customer-post-load-primary");
  });

  it('keeps Dispatcher focused on active operations rather than Carrier/Fleet browsing modules', () => {
    for (const marker of [
      "dispatcher-dashboard-primary', 'Dashboard', '/admin'",
      "dispatcher-diary-primary', 'Diary', '/admin/diary'",
      "dispatcher-unallocated-primary', 'Unallocated', '/admin/fleet/assignments'",
      "dispatcher-active-jobs-primary', 'Active Jobs', '/admin/fleet/active-jobs'",
      "dispatcher-collections-primary', 'Collections', '/admin/collections'",
      "dispatcher-deliveries-primary', 'Deliveries', '/admin/deliveries'",
      "dispatcher-positions-primary', 'Live Positions', '/admin/fleet/positions'",
      "dispatcher-drivers-vehicles-primary', 'Drivers & Vehicles', '/admin/fleet/resources'",
      "dispatcher-settings-primary', 'Settings', '/admin/settings'",
    ]) expect(shell).toContain(marker);
  });

  it('keeps Owner Driver Settings primary and fleet detail routes inside My Fleet', () => {
    const owner = shell.slice(
      shell.indexOf("return composeRolePrimaryNav(groups, [", shell.indexOf('if (!ownerDriver)') + 1),
      shell.indexOf('export function composeDispatcherPrimaryNav'),
    );
    expect(owner).toContain("['owner-driver-settings-primary', 'Settings', '/driver/settings']");
    const more = owner.slice(owner.indexOf("], 'owner-driver-more', 'More', ["));
    expect(more).not.toContain("'/driver/settings'");
    expect(more).not.toContain("'/driver/freight-vision'");
    expect(more).not.toContain("'/driver/drivers-vehicles'");

    const fleetNav = read('app/driver/_components/DriverFleetIntegratedNav.tsx');
    expect(fleetNav).toContain("'/driver/vehicles'");
    expect(fleetNav).toContain("'/driver/drivers-vehicles'");
    expect(fleetNav).toContain("'/driver/freight-vision'");
  });

  it('does not render an interactive fallback-role navbar while auth role is unresolved', () => {
    expect(shell).toContain('isLoading: authLoading');
    expect(shell).toContain('const workspaceRoleReady = Boolean(');
    expect(shell).toContain('if (!workspaceRoleReady) return []');
    expect(shell).toContain('data-role-ready={workspaceRoleReady');
    expect(shell).toContain('aria-busy={!workspaceRoleReady}');
    expect(shell).toContain('{workspaceRoleReady && nav.map');
  });

  it('uses native Next links for route navigation while More remains a button trigger', () => {
    expect(shell).toContain("import Link from 'next/link'");
    expect(shell).toContain('href={fixtureRouteFor(item.href)}');
    expect(shell).toContain('prefetch={false}');
    expect(shell).not.toContain('onClick={() => openRoute(item.href)}');
    expect(shell).toContain('aria-haspopup="menu"');
  });

  it('preserves the driver prototype scope needed by converged page CSS', () => {
    expect(shell).toContain('driver-prototype-port');
    expect(shell).toContain('app driver-prototype-app');
    expect(shell).toContain("role === 'driver' || role === 'owner_driver'");
  });
});
