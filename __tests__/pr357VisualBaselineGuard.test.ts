import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const topShell = read('app/components/workspace/TopWorkspaceShell.tsx');
const driverNav = read('lib/workspaceRole.ts');
const driverDashboard = read('app/driver/page.tsx');
const customerDashboard = read('app/customer/CustomerDashboardHome.tsx');
const carrierDashboard = read('app/components/workspace/CarrierOperationsDashboardHome.tsx');
const brokerDashboard = read('app/broker/BrokerDashboardHome.tsx');

describe('PR #357 approved visual baseline', () => {
  it('keeps shared workspace navigation in the dedicated primary row after header actions', () => {
    expect(topShell).toContain('top-workspace-nav top-workspace-nav--primary');
    expect(topShell).not.toContain('showWorkspaceContext');

    const actionsIndex = topShell.indexOf('top-workspace-shell__actions');
    const navIndex = topShell.indexOf('top-workspace-nav top-workspace-nav--primary');
    expect(actionsIndex).toBeGreaterThan(-1);
    expect(navIndex).toBeGreaterThan(actionsIndex);
  });

  it('keeps Driver navigation aligned to the approved full prototype order', () => {
    for (const item of [
      "label: 'Today', href: '/driver'",
      "label: 'My Jobs', href: '/driver/jobs'",
      "label: 'Diary', href: '/driver/history'",
      "label: 'Availability', href: '/driver/availability'",
      "label: 'Vehicle', href: '/driver/vehicles'",
      "label: 'Directory', href: '/driver/directory'",
      "label: 'Return Journeys', href: '/driver/returns'",
      "label: 'Loads', href: '/driver/loads'",
      "label: 'Quotes', href: '/driver/quotes'",
      "label: 'Won Work', href: '/driver/won-work'",
      "label: 'Auto-match & Alerts', href: '/driver/load-alerts'",
      "label: 'Tracking', href: '/driver/freight-vision'",
      "label: 'Invoices', href: '/driver/finance'",
      "label: 'Drivers & Staff', href: '/driver/drivers-vehicles'",
    ]) expect(driverNav).toContain(item);
    expect(driverNav).toContain('label: "Who\'s Nearby"');
  });

  it('keeps the current dense Driver operational dashboard structure', () => {
    for (const marker of [
      'driver-prototype-dashboard',
      'driver-dashboard-statusbar',
      'Current assignment',
      'Next booking',
      'Driver readiness',
      'Reports & Statistics',
      'Accounts Payable',
      'Activity at a glance',
    ]) expect(driverDashboard).toContain(marker);

    for (const stale of [
      'Today at a glance',
      'Operational workboard',
      'Status & availability',
      '<span>Canonical active vehicle</span>',
      'Journey & position',
      'Quote activity',
    ]) expect(driverDashboard).not.toContain(stale);
  });

  it('keeps the Customer transport-control dashboard structure', () => {
    expect(customerDashboard).toContain('title="Transport overview"');
    expect(customerDashboard).toContain('customer-owner-stat-grid');
    expect(customerDashboard).toContain('Needs your attention');
    expect(customerDashboard).toContain('Activity at a glance');
    expect(customerDashboard).toContain('Outstanding Invoices');
  });

  it('keeps Carrier/Admin and Broker operational control surfaces', () => {
    expect(carrierDashboard).toContain('Carrier Control Desk');
    expect(carrierDashboard).toContain('Operational workboard');
    expect(carrierDashboard).toContain('carrierControlSignals');

    expect(brokerDashboard).toContain('title="Transport control"');
    expect(brokerDashboard).toContain('broker-clean-kpis');
    expect(brokerDashboard).toContain('Needs your attention');
    expect(brokerDashboard).toContain('Current transport');
    expect(brokerDashboard).toContain('Commercial position');
  });
});