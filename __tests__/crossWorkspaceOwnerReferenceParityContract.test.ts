import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Owner-reference shell and dashboard convergence', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const customer = read('app/customer/CustomerDashboardHome.tsx');
  const broker = read('app/broker/BrokerDashboardHome.tsx');
  const brokerCss = read('app/broker/broker-dashboard-convergence.css');
  const carrier = read('app/components/workspace/CarrierOperationsDashboardHome.tsx');
  const fleet = read('app/components/workspace/FleetControlDashboardHome.tsx');
  const dispatcher = read('app/components/workspace/DispatcherControlDashboardHome.tsx');
  const finance = read('app/components/workspace/FinanceControlDashboardHome.tsx');
  const compliance = read('app/components/workspace/ComplianceControlDashboardHome.tsx');
  const viewer = read('app/components/workspace/ViewerDashboardHome.tsx');
  const carrierCss = read('app/admin/carrier-workspace-canonical.css');
  const owner = read('app/driver/page.tsx');
  const convergence = read('app/components/workspace/OperationalConvergence.tsx');
  const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');

  it('uses the same identity and top-action shell structure for company workspaces', () => {
    expect(shell).toContain('<div className="top-workspace-shell__identity">');
    expect(shell).toContain('<strong>{companyName}</strong>');
    expect(shell).not.toContain('!CARRIER_NAV_ROLES.has(role) && (');
    expect(shell).toContain("role === 'customer' ||");
    expect(shell).toContain("role === 'broker' ||");
    expect(shell).toContain("'/customer/network/directory'");
    expect(shell).toContain("'/broker/carrier-network/directory'");
  });

  it('keeps Customer and Owner Driver on the shared two-column control-desk geometry', () => {
    expect(owner).toContain('driver-owner-parity-grid xdrive-owner-dashboard-grid');
    expect(owner).toContain('xdrive-owner-dashboard-column');
    expect(customer).toContain('customer-owner-parity-grid xdrive-owner-dashboard-grid');
    expect(customer).toContain('xdrive-owner-dashboard-column');
    expect(customer).toContain('xdrive-owner-dashboard-subgrid');
    expect(customer).toContain('Reports & Statistics');
    expect(customer).toContain('Activity at a glance');
    expect(customer).not.toContain('title="Transport overview"');
    expect(baseline).toContain('--ws-dashboard-left-col: .84fr');
    expect(baseline).toContain('--ws-dashboard-right-col: 1.16fr');
    expect(baseline).toContain('minmax(360px, var(--ws-dashboard-left-col)) minmax(0, var(--ws-dashboard-right-col))');
  });

  it('converges Broker to the same shared Owner Driver top-level geometry', () => {
    expect(broker).toContain('broker-clean-dashboard xdrive-owner-dashboard-grid');
    expect(broker).toContain('broker-owner-reports-card');
    expect(broker).toContain('Reports & Statistics');
    expect(broker).toContain('broker-owner-activity');
    expect(broker).toContain('Activity at a glance');
    expect(broker).not.toContain('title="Transport control"');
    expect(brokerCss).not.toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);');
  });

  it('converges Carrier to the same shared Owner Driver top-level geometry while retaining its operational workboard', () => {
    expect(carrier).toContain('carrier-owner-parity-grid xdrive-owner-dashboard-grid');
    expect(carrier).toContain('xdrive-owner-dashboard-column');
    expect(carrier).toContain('xdrive-owner-dashboard-subgrid');
    expect(carrier).toContain('Reports & Statistics');
    expect(carrier).toContain('Activity at a glance');
    expect(carrier).toContain('Carrier operational workboard');
    expect(carrier).not.toContain('title="Carrier Control Desk"');
    expect(carrierCss).not.toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);');
  });

  it('keeps Fleet and read-only Viewer on the shared dashboard grid', () => {
    expect(fleet).toContain('<div className="xdrive-owner-dashboard-grid">');
    expect(fleet).toContain('<div className="xdrive-owner-dashboard-subgrid">');
    expect(fleet).toContain('title="Reports & Statistics"');
    expect(fleet).toContain('title="Activity at a glance"');
    expect(viewer).toContain('<div className="xdrive-owner-dashboard-grid">');
    expect(viewer).toContain('<div className="xdrive-owner-dashboard-column">');
    expect(viewer).toContain('title="Reports & Statistics"');
    expect(viewer).toContain('title="Activity at a glance"');
  });

  it('uses the common grid primitive for Dispatcher, Finance and Compliance without erasing role actions', () => {
    expect(convergence).toContain('<div className="xdrive-owner-dashboard-grid">');
    expect(convergence).toContain('xdrive-owner-dashboard-column');
    for (const role of [dispatcher, finance, compliance]) {
      expect(role).toContain('<OperationalWorkspaceGrid');
      expect(role).toContain('title="Reports & Statistics"');
      expect(role).toContain('title="Activity at a glance"');
      expect(role).toContain('<div className="xdrive-owner-dashboard-subgrid">');
    }
    expect(dispatcher).toContain('/admin/fleet/assignments');
    expect(finance).toContain('/admin/finance/customer-invoices');
    expect(compliance).toContain('/admin/documents/expiry');
  });
});
