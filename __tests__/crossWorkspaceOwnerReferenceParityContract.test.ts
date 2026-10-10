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
  const carrierCss = read('app/admin/carrier-workspace-canonical.css');
  const owner = read('app/driver/page.tsx');

  it('uses the same identity and top-action shell structure for company workspaces', () => {
    expect(shell).toContain('<div className="top-workspace-shell__identity">');
    expect(shell).toContain('<strong>{companyName}</strong>');
    expect(shell).not.toContain('!CARRIER_NAV_ROLES.has(role) && (');
    expect(shell).toContain("role === 'customer' ||");
    expect(shell).toContain("role === 'broker' ||");
    expect(shell).toContain("'/customer/network/directory'");
    expect(shell).toContain("'/broker/carrier-network/directory'");
  });

  it('keeps Customer on the Owner Driver two-column control-desk geometry without a bespoke dashboard masthead', () => {
    expect(owner).toContain('driver-dashboard-register');
    expect(customer).toContain('customer-owner-parity-grid');
    expect(customer).toContain('Reports & Statistics');
    expect(customer).toContain('Activity at a glance');
    expect(customer).not.toContain('title="Transport overview"');
  });

  it('converges Broker to the same Owner Driver top-level geometry', () => {
    expect(broker).toContain('broker-owner-reports-card');
    expect(broker).toContain('Reports & Statistics');
    expect(broker).toContain('broker-owner-activity');
    expect(broker).toContain('Activity at a glance');
    expect(broker).not.toContain('title="Transport control"');
    expect(brokerCss).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);');
  });

  it('converges Carrier to the same Owner Driver top-level geometry while retaining its operational workboard', () => {
    expect(carrier).toContain('carrier-owner-parity-grid');
    expect(carrier).toContain('Reports & Statistics');
    expect(carrier).toContain('Activity at a glance');
    expect(carrier).toContain('Carrier operational workboard');
    expect(carrier).not.toContain('title="Carrier Control Desk"');
    expect(carrierCss).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);');
  });
});
