import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const topShell = read('app/components/workspace/TopWorkspaceShell.tsx');
const driverShell = read('app/driver/_components/DriverTopWorkspaceShell.tsx');
const driverDashboard = read('app/driver/page.tsx');
const customerDashboard = read('app/customer/CustomerDashboardHome.tsx');
const carrierDashboard = read('app/components/workspace/CarrierOperationsDashboardHome.tsx');
const brokerDashboard = read('app/broker/BrokerDashboardHome.tsx');

describe('PR #357 approved visual baseline', () => {
  it('keeps shared workspace navigation inline in the top header before actions', () => {
    expect(topShell).toContain('top-workspace-nav top-workspace-nav--inline');
    expect(topShell).toContain('showWorkspaceContext = CARRIER_NAV_ROLES.has(role)');

    const navIndex = topShell.indexOf('top-workspace-nav top-workspace-nav--inline');
    const actionsIndex = topShell.indexOf('top-workspace-shell__actions');
    expect(navIndex).toBeGreaterThan(-1);
    expect(actionsIndex).toBeGreaterThan(navIndex);
  });

  it('keeps Driver primary navigation in the top header with the approved PR357 order', () => {
    for (const item of [
      "label: 'Dashboard', href: '/driver'",
      "label: 'Loads', href: '/driver/loads'",
      "label: 'Quotes', href: '/driver/quotes'",
      "label: 'Jobs', href: '/driver/jobs'",
      "label: 'Diary', href: '/driver/history'",
      "label: 'Availability', href: '/driver/availability'",
      "label: 'Return Journeys', href: '/driver/returns'",
      "label: 'Account', href: '/driver/account'",
    ]) expect(driverShell).toContain(item);

    const navIndex = driverShell.indexOf('driver-top-nav');
    const actionsIndex = driverShell.indexOf('driver-top-shell__actions');
    expect(navIndex).toBeGreaterThan(-1);
    expect(actionsIndex).toBeGreaterThan(navIndex);
  });

  it('keeps the approved dense Driver dashboard structure', () => {
    for (const marker of [
      'driver-dashboard-layout',
      'driver-dashboard-left',
      'driver-dashboard-main',
      'Status & availability',
      'Canonical active vehicle',
      'Journey & position',
      'Current execution',
      'Recent bookings',
      'Relevant loads',
      'Feedback',
      'Compliance & document alerts',
    ]) expect(driverDashboard).toContain(marker);
  });

  it('keeps the Customer transport-control dashboard structure', () => {
    expect(customerDashboard).toContain('title="Transport Control"');
    expect(customerDashboard).toContain('customer-dash-metrics');
    expect(customerDashboard).toContain('customer-exchange-dashboard');
    expect(customerDashboard).toContain('Open transport requests');
    expect(customerDashboard).toContain('Recent quote activity');
  });

  it('keeps Carrier/Admin and Broker operational control surfaces', () => {
    expect(carrierDashboard).toContain('Carrier Control Desk');
    expect(carrierDashboard).toContain('Operational workboard');
    expect(carrierDashboard).toContain('carrierControlSignals');

    expect(brokerDashboard).toContain('title="Broker Dashboard"');
    expect(brokerDashboard).toContain('Operational action queue');
  });
});
