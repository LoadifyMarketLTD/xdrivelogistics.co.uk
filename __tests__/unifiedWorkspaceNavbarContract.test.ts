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
    expect(shellCss).toContain('.xdrive-operational-top-workspace .top-workspace-action--primary');
    expect(shellCss).toContain('.xdrive-operational-top-workspace .top-workspace-action--direct');
  });

  it('scopes the generic button reset to page content so the 42px / 13px navbar stays canonical', () => {
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(baseline).toContain('.xdrive-workspace-measured :where(.top-workspace-shell__content) button:not(.driver-top-shell__logo-button)');
    expect(baseline).not.toMatch(/^\.xdrive-workspace-measured button:not\(/m);
  });

  it('promotes the primary workflow for operational roles without changing Super Admin', () => {
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
  });

  it('keeps overflow functions under a consistent More menu', () => {
    expect(shell).toContain("moreLabel = 'More'");
    expect(shell).toContain("label: moreLabel");
    expect(shell).toContain("return more.length ? [...primary");
  });

  it('keeps Settings reachable once per operational shell without consuming CX primary-nav space', () => {
    for (const marker of [
      "'/admin/settings'",
      "'/broker/settings'",
      "'/customer/settings'",
      "'/driver/settings'",
      "finance-settings-primary', 'Settings', '/admin/settings'",
      "compliance-settings-primary', 'Settings', '/admin/settings'",
    ]) expect(shell).toContain(marker);
    expect(workspaceRole).toContain("{ id: 'fleet-settings', label: 'Settings'");
    expect(workspaceRole).toContain("capability: 'settings.manage'");
    expect(shell).not.toContain("['carrier-settings', 'Settings', '/admin/settings']");
    expect(shell).not.toContain("['broker-settings-primary', 'Settings', '/broker/settings']");
    expect(shell).not.toContain("['dispatcher-settings-primary', 'Settings', '/admin/settings']");
  });

  it('keeps the Customer primary navbar in CX order and moves secondary lifecycle tools to More', () => {
    for (const marker of [
      "customer-dashboard-primary', 'Dashboard', '/customer'",
      "customer-directory-primary', 'Directory', '/customer/network'",
      "customer-loads-primary', 'Loads', '/customer/loads'",
      "customer-quotes-primary', 'Quotes', '/customer/quotes'",
      "customer-diary-primary', 'Diary', '/customer/diary'",
      "customer-freight-vision-primary', 'Freight Vision', '/customer/tracking'",
      "'/customer/action-centre'",
      "'/customer/bookings'",
      "'/customer/settings'",
    ]) expect(shell).toContain(marker);
    expect(shell).not.toContain("customer-post-load-primary");
  });

  it('keeps Dispatcher on the applicable CX operational modules', () => {
    for (const marker of [
      "dispatcher-live-availability-primary', 'Live Availability', '/admin/live-availability'",
      "dispatcher-my-fleet-primary', 'My Fleet', '/admin/fleet/vehicles'",
      "dispatcher-return-journeys-primary', 'Return Journeys', '/admin/fleet/returns'",
      "dispatcher-diary-primary', 'Diary', '/admin/diary'",
      "dispatcher-freight-vision-primary', 'Freight Vision', '/admin/freight-vision'",
      "dispatcher-drivers-vehicles-primary', 'Drivers & Vehicles', '/admin/fleet/resources'",
    ]) expect(shell).toContain(marker);
    for (const href of ['/admin/live-availability', '/admin/fleet/vehicles', '/admin/fleet/returns', '/admin/freight-vision', '/admin/fleet/resources']) {
      expect(workspaceRole).toContain(`href: '${href}'`);
    }
  });

  it('keeps one Owner Driver Settings destination in More and avoids duplicate settings sections', () => {
    expect(workspaceRole).toContain("label: 'Driver Settings', href: '/driver/settings'");
    expect(workspaceRole).toContain("label: 'Company Settings', href: '/driver/settings?section=overview'");
    const owner = shell.slice(shell.indexOf('function composeDriverPrimaryNav'), shell.indexOf('function composeDispatcherPrimaryNav'));
    expect(owner).toContain("], 'owner-driver-more', 'More', [");
    expect(owner).toContain("'/driver/settings'");
    expect(owner).not.toContain("'/driver/settings?section=company'");
    expect(owner).not.toContain("'/driver/settings?section=overview'");
    expect(owner).not.toContain("'/settings/billing'");
  });

  it('preserves the driver prototype scope needed by CX-converged page CSS', () => {
    expect(shell).toContain("driver-prototype-port");
    expect(shell).toContain("app driver-prototype-app");
    expect(shell).toContain("role === 'driver' || role === 'owner_driver'");
  });
});
