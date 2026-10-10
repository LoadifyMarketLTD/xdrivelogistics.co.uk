import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, 'app/driver/page.tsx'), 'utf8');
const availability = fs.readFileSync(path.join(root, 'app/driver/availability/page.tsx'), 'utf8');
const shellCss = fs.readFileSync(path.join(root, 'app/components/workspace/top-workspace-shell.css'), 'utf8');
const ownerAdapter = fs.readFileSync(path.join(root, 'app/components/workspace/non-driver-owner-reference.css'), 'utf8');

describe('Owner Driver canonical visual reference', () => {
  it('preserves the approved sole-trader dashboard composition', () => {
    for (const marker of [
      'Current / Next Work',
      'Work & Marketplace',
      'Recent Bookings',
      'Availability & Positioning',
      'My Business',
      'Quick Actions',
      'Invoiced Revenue',
      'POD Requiring Action',
    ]) expect(dashboard).toContain(marker);

    expect(dashboard).toContain('/api/driver/dashboard/commercial-summary');
    expect(dashboard).not.toContain('Accounts Payable');
    expect(dashboard).not.toContain('Gross Margin');
    expect(dashboard).not.toContain('Sub-contract Spend');
    expect(dashboard).not.toContain('Freight Messenger');
    expect(dashboard).not.toContain('fleet allocation');
    expect(dashboard).not.toContain('multi-driver controls');
  });

  it('keeps Owner Driver availability personal rather than fleet-facing', () => {
    expect(availability).not.toContain("href: '/driver/availability/live'");
    expect(availability).not.toContain('DriverIntegratedNav');
    expect(availability).not.toContain('Commercial bid flag');
    expect(availability).not.toContain('Canonical active vehicle');
    expect(availability).not.toContain('toFixed(5)');
    expect(availability).toContain('Current location recorded');
    expect(availability).toContain('My vehicle');
    expect(availability).toContain('Load quoting');
  });

  it('preserves the canonical desktop Driver shell geometry', () => {
    expect(shellCss).toContain('CANONICAL DRIVER WORKSPACE SHELL');
    expect(shellCss).toContain('.xdrive-driver-workspace .top-workspace-shell__header');
    expect(shellCss).toContain('height: 50px !important;');
    expect(shellCss).toContain('gap: 10px !important;');
    expect(shellCss).toContain('padding: 0 18px !important;');
    expect(shellCss).toContain('font-size: 14px !important;');
    expect(shellCss).toContain('min-height: calc(100vh - 100px) !important;');
  });

  it('keeps non-driver operational workspaces attached to the saved Owner reference adapter', () => {
    expect(ownerAdapter).toContain('Owner Driver visual-reference adapter for non-driver operational workspaces only');
    expect(ownerAdapter).toContain('--owner-ref-control: 32px;');
    expect(ownerAdapter).toContain('--owner-ref-radius: 4px;');
    expect(ownerAdapter).toContain('.xdrive-owner-reference-workspace .xdrive-dashboard-home-header');
  });
});
