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
    expect(shellCss).toContain('height: 29px !important');
    expect(shellCss).toContain('padding: 2px 8px 9px !important');
    expect(shellCss).toContain('font-size: 13px !important');
    expect(shellCss).toContain('box-shadow: inset 0 -2px 0 #1d57d8 !important');
    expect(baseline).toContain('--ws-nav-h: 42px');
    expect(shellCss).toContain('.xdrive-operational-top-workspace .top-workspace-action--primary');
    expect(shellCss).toContain('.xdrive-operational-top-workspace .top-workspace-action--direct');
  });

  it('scopes the generic button reset to page content so the 29px / 13px navbar stays canonical', () => {
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

  it('promotes Settings only on operational shells with settings authority', () => {
    for (const marker of [
      "carrier-settings', 'Settings', '/admin/settings'",
      "broker-settings-primary', 'Settings', '/broker/settings'",
      "'/driver/settings'",
      "driver-settings-primary', 'Settings', '/driver/settings'",
      "dispatcher-settings-primary', 'Settings', '/admin/settings'",
      "finance-settings-primary', 'Settings', '/admin/settings'",
      "compliance-settings-primary', 'Settings', '/admin/settings'",
    ]) expect(shell).toContain(marker);
    expect(workspaceRole).toContain("{ id: 'fleet-settings', label: 'Settings'");
    expect(workspaceRole).toContain("capability: 'settings.manage'");
    expect(shell).toContain("composeCustomerPrimaryNav");
    expect(shell).toContain("], 'customer-more');");
    expect(shell).not.toContain("['fleet-settings', 'Settings', '/admin/settings']");
  });

  it('keeps the Customer operational flow explicit in the navbar', () => {
    for (const marker of [
      "customer-post-load-primary', 'Post Load', '/customer/post-load'",
      "customer-loads-primary', 'Loads', '/customer/loads'",
      "customer-quotes-primary', 'Quotes', '/customer/quotes'",
      "customer-bookings-primary', 'Bookings', '/customer/bookings'",
      "customer-diary-primary', 'Diary', '/customer/diary'",
      "customer-tracking-primary', 'Tracking', '/customer/tracking'",
      "customer-network-primary', 'Network', '/customer/network'",
      "customer-action-centre-primary', 'Action Centre', '/customer/action-centre'",
    ]) expect(shell).toContain(marker);
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
