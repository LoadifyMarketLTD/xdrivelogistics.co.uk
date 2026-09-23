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
    expect(topShell).not.toContain('showWorkspaceContext');

    const navIndex = topShell.indexOf('top-workspace-nav top-workspace-nav--inline');
    const actionsIndex = topShell.indexOf('top-workspace-shell__actions');
    expect(navIndex).toBeGreaterThan(-1);
    expect(actionsIndex).toBeGreaterThan(navIndex);
  });

  it('keeps Driver navigation aligned to the approved full prototype order', () => {
    for (const item of [
      "label: 'Dashboard', href: '/driver'",
      "label: 'Directory', href: '/driver/directory'",
      "label: 'Live Availability', href: '/driver/nearby'",
      "label: 'My Fleet', href: '/driver/vehicles'",
      "label: 'Return Journeys', href: '/driver/returns'",
      "label: 'Loads', href: '/driver/loads'",
      "label: 'Quotes', href: '/driver/quotes'",
      "label: 'Diary', href: '/driver/history'",
      "label: 'Freight Vision', href: '/driver/freight-vision'",
      "label: 'Finance', href: '/driver/finance'",
      "label: 'Drivers & Vehicles', href: '/driver/drivers-vehicles'",
    ]) expect(driverShell).toContain(item);

    const navIndex = driverShell.indexOf('main-nav');
    const toolsIndex = driverShell.indexOf('top-tools');
    expect(navIndex).toBeGreaterThan(-1);
    expect(toolsIndex).toBeGreaterThan(navIndex);
  });

  it('keeps the approved dense Driver dashboard structure', () => {
    for (const marker of [
      'driver-prototype-dashboard',
      'Today at a glance',
      'Operational workboard',
      'Matching Loads',
      'Commercial position',
      'Performance & evidence',
      'Driver workflow',
      'Latest bookings',
      'NEXT ACTION',
    ]) expect(driverDashboard).toContain(marker);

    for (const stale of [
      'Status & availability',
      '<span>Canonical active vehicle</span>',
      'Journey & position',
      'Quote activity',
      'Compliance & document alerts',
    ]) expect(driverDashboard).not.toContain(stale);
  });

  it('keeps the Customer transport-control dashboard structure', () => {
    expect(customerDashboard).toContain('title="Transport Control"');
    expect(customerDashboard).toContain('OperationalSignalStrip');
    expect(customerDashboard).toContain('customer-exchange-dashboard');
    expect(customerDashboard).toContain('Open transport requests');
    expect(customerDashboard).toContain('Recent quote activity');
  });

  it('keeps Carrier/Admin and Broker operational control surfaces', () => {
    expect(carrierDashboard).toContain('Carrier Control Desk');
    expect(carrierDashboard).toContain('Operational workboard');
    expect(carrierDashboard).toContain('carrierControlSignals');

    expect(brokerDashboard).toContain('title="Broker Dashboard"');
    expect(brokerDashboard).toContain('<ExchangeKpiStrip>');
    expect(brokerDashboard).toContain('title="Operational action queue"');
  });
});