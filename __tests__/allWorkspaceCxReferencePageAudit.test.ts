import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

function pageFiles(relative: string): string[] {
  const absolute = path.join(root, relative);
  const rows: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) rows.push(...pageFiles(child));
    else if (entry.name === 'page.tsx') rows.push(child.replace(/\\/g, '/'));
  }
  return rows;
}

const workspacePages = [
  ...pageFiles('app/admin'),
  ...pageFiles('app/broker'),
  ...pageFiles('app/customer'),
].sort();
const driverPages = pageFiles('app/driver').sort();

describe('all operational workspace pages follow the Courier Exchange live reference contract', () => {
  it('audits every current Admin, Broker and Customer route page', () => {
    expect(workspacePages).toHaveLength(127);
    for (const file of workspacePages) {
      const source = read(file);
      const lines = source.split(/\r?\n/).length;
      const canonical =
        /<PageFrame|<OperationalPageLayout|carrier-(?:register|detail|redirect)-page/.test(source);
      const shared =
        /components\/workspace|AdminWorkspaceModules|CustomerWorkspaceModules|CustomerOperationalPages|CustomerDashboardHome|BrokerDashboardHome|FleetActiveJobsPage/.test(source);
      const compatibility = /redirect\(/.test(source) || (lines <= 8 && /return\s+<\w+/.test(source));
      expect(canonical || shared || compatibility, `Unclassified workspace page: ${file}`).toBe(true);
    }
  });

  it('audits every current Driver route page against the approved shared/prototype families', () => {
    expect(driverPages).toHaveLength(41);
    for (const file of driverPages) {
      const source = read(file);
      const lines = source.split(/\r?\n/).length;
      const shared =
        /components\/workspace|DriverWorkspaceShell|DriverNotificationRegister|RoleSettingsWorkspace|BillingSettingsPage/.test(source);
      const approvedPrototype =
        /driver-(?:loads|quotes|returns|live-availability|fleet|freight-vision|drivers-vehicles)-prototype/.test(source);
      const compatibility =
        /redirect\(/.test(source) || /export\s*\{\s*default\s*\}\s*from/.test(source) || (lines <= 12 && /return\s+<\w+/.test(source));
      expect(shared || approvedPrototype || compatibility, `Unclassified Driver page: ${file}`).toBe(true);
    }
  });

  it('locks the principal Driver operational pages to their approved dense surface families', () => {
    const markers: Record<string, string> = {
      'app/driver/loads/page.tsx': 'driver-loads-prototype',
      'app/driver/quotes/page.tsx': 'driver-quotes-prototype',
      'app/driver/history/page.tsx': 'diary-filter-rail',
      'app/driver/availability/page.tsx': 'driver-availability-rail',
      'app/driver/returns/page.tsx': 'driver-returns-prototype',
      'app/driver/jobs/page.tsx': 'driver-jobs-board',
      'app/driver/messages/page.tsx': 'driver-messages-board',
      'app/driver/finance/page.tsx': 'driver-finance-register',
      'app/driver/documents/page.tsx': 'driver-compliance-register',
      'app/driver/vehicles/page.tsx': 'driver-fleet-prototype',
      'app/driver/freight-vision/page.tsx': 'driver-freight-vision-prototype',
    };
    for (const [file, marker] of Object.entries(markers)) {
      expect(read(file), `${file} should retain ${marker}`).toContain(marker);
    }
  });

  it('uses the shared measured baseline directly in every operational workspace layout', () => {
    for (const layout of ['app/admin/layout.tsx', 'app/broker/layout.tsx', 'app/customer/layout.tsx', 'app/driver/layout.tsx']) {
      const source = read(layout);
      expect(source).toContain('xdrive-workspace-measured');
      expect(source).toContain('workspace-measured-cx-baseline.css');
      expect(source).not.toContain('non-driver-owner-reference.css');
      expect(source).not.toContain('xdrive-owner-reference-workspace');
    }
  });
  it('locks the agreed dense operational geometry to the shared CX baseline', () => {
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    const workspaceCss = read('app/components/workspace/WorkspaceUI.module.css');

    for (const marker of [
      '--ws-filter-rail-w: 165px',
      '--ws-control-h: 24px',
      '--ws-tab-h: 28px',
      '--ws-panel-head-h: 36px',
      '--ws-table-head-h: 40px',
      '--ws-table-row-h: 42px',
      '--ws-font-body: 12px',
      '--ws-radius: 4px',
      'font-family: "HK Nova", Arial, sans-serif',
    ]) expect(baseline).toContain(marker);

    expect(workspaceCss).toContain('grid-template-columns: var(--ws-filter-rail-w, 165px) minmax(0, 1fr);');
    expect(baseline).toContain('min-height: var(--ws-table-row-h) !important');
    expect(baseline).toContain('height: var(--ws-table-row-h);');
    expect(baseline).toContain('.xdrive-workspace-measured .workspace-tab-strip');
    expect(baseline).toContain('min-height: var(--ws-tab-h) !important');
    expect(baseline).not.toContain('--owner-ref-rail:');
  });

  it('converges the carrier invoice creation panels through existing detail-page CSS, without relying on inline radius', () => {
    const invoicePage = read('app/admin/invoices/new/page.tsx');
    const carrierCss = read('app/admin/carrier-workspace-canonical.css');
    expect(invoicePage.match(/className="carrier-invoice-create-panel"/g)).toHaveLength(2);
    expect(invoicePage).toContain('className="carrier-invoice-create-fields"');
    expect(carrierCss).toContain('.xdrive-carrier-workspace .carrier-invoice-create-panel {');
    expect(carrierCss).toContain('.xdrive-carrier-workspace .carrier-invoice-create-fields {');
    expect(carrierCss).toContain('border-radius: var(--ws-radius) !important;');
  });

  it('locks all seven operational dashboards to the same measured Courier Exchange live two-column geometry', () => {
    const dashboards = [
      'app/components/workspace/CarrierOperationsDashboardHome.tsx',
      'app/components/workspace/FleetControlDashboardHome.tsx',
      'app/broker/BrokerDashboardHome.tsx',
      'app/customer/CustomerDashboardHome.tsx',
    ];
    for (const file of dashboards) {
      const source = read(file);
      expect(source, file).toContain('xdrive-owner-dashboard-grid');
    }

    for (const file of [
      'app/components/workspace/CarrierOperationsDashboardHome.tsx',
      'app/components/workspace/FleetControlDashboardHome.tsx',
      'app/customer/CustomerDashboardHome.tsx',
    ]) {
      const source = read(file);
      expect(source, file).toContain('xdrive-owner-dashboard-column');
    }

    const dispatcher = read('app/components/workspace/DispatcherControlDashboardHome.tsx');
    const convergence = read('app/components/workspace/OperationalConvergence.tsx');
    expect(dispatcher).toContain('<OperationalWorkspaceGrid');
    expect(convergence).toContain('xdrive-owner-dashboard-grid');
    expect(convergence).toContain('xdrive-owner-dashboard-column');

    const brokerCss = read('app/broker/broker-dashboard-convergence.css');
    expect(brokerCss).toContain('.broker-owner-activity');
    expect(brokerCss).toContain('grid-column: 2');

    const driver = read('app/driver/page.tsx');
    expect(driver).toContain('driver-owner-parity-grid xdrive-owner-dashboard-grid');
    expect(driver).toContain('driver-current-assignment-card');
    expect(driver).toContain('driver-next-booking-card');

    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(baseline).toContain('7-WORKSPACE DASHBOARD HARD LOCK');
    expect(baseline).toContain('grid-template-columns: minmax(360px, .84fr) minmax(0, 1.16fr) !important');
  });

  it('keeps Super Admin on its separate shell and outside the operational measured wrapper', () => {
    const superLayout = read('app/super-admin/layout.tsx');
    expect(superLayout).toContain('super-admin-enterprise-root');
    expect(superLayout).not.toContain('xdrive-workspace-measured');
    expect(superLayout).not.toContain('xdrive-operational-top-workspace');
  });

  it('uses isolated shared-component hooks so existing Driver selectors are not activated', () => {
    const ui = read('app/components/workspace/WorkspaceUI.tsx');
    expect(ui).toContain('owner-ref-hook-action-button');
    expect(ui).toContain('owner-ref-hook-empty-state');
    expect(ui).not.toContain('className="xdrive-action-button"');
    expect(ui).not.toContain('className="xdrive-empty-state ');
  });
});
