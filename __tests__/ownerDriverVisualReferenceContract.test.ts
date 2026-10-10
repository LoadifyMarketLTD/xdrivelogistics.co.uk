import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dashboard = fs.readFileSync(path.join(root, 'app/driver/page.tsx'), 'utf8');
const availability = fs.readFileSync(path.join(root, 'app/driver/availability/page.tsx'), 'utf8');
const messages = fs.readFileSync(path.join(root, 'app/driver/messages/page.tsx'), 'utf8');
const vehicles = fs.readFileSync(path.join(root, 'app/driver/vehicles/page.tsx'), 'utf8');
const nearby = fs.readFileSync(path.join(root, 'app/driver/nearby/page.tsx'), 'utf8');
const loadSearch = fs.readFileSync(path.join(root, 'app/driver/loads/search/page.tsx'), 'utf8');
const accountNav = fs.readFileSync(path.join(root, 'app/driver/_components/AccountSectionNav.tsx'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'app/driver/profile/page.tsx'), 'utf8');
const shellCss = fs.readFileSync(path.join(root, 'app/components/workspace/top-workspace-shell.css'), 'utf8');
const ownerAdapter = fs.readFileSync(path.join(root, 'app/components/workspace/non-driver-owner-reference.css'), 'utf8');

describe('Owner Driver canonical visual reference', () => {
  it('preserves the approved sole-trader dashboard composition', () => {
    for (const marker of [
      'Reports & Statistics',
      'Gross Margin',
      'Sub-contract Spend',
      'Accounts Payable',
      'Latest Invoices Received',
      'Invoices due for Payment',
      'Invoices Awaiting Payment',
      'Monthly Totals',
      'Reports',
      'Feedback in Last 90 Days',
      'Activity at a glance',
      'Latest Bookings',
      'Compliance & Positioning',
      'POD Required',
    ]) expect(dashboard).toContain(marker);

    expect(dashboard).toContain('/api/driver/dashboard/commercial-summary');
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

  it('keeps Owner Driver copy user-facing rather than implementation-facing', () => {
    expect(messages).not.toContain('current schema');
    expect(messages).not.toContain('fabricated read-state');
    expect(vehicles).not.toContain('Canonical Active');
    expect(availability).not.toContain('Canonical active-vehicle');
  });

  it('keeps secondary Owner Driver pages inside the sole-trader route set', () => {
    expect(nearby).not.toContain("href: '/driver/availability/live'");
    expect(nearby).toContain("href: '/driver/returns'");
    expect(nearby).toContain('>My Vehicle</button>');
    expect(loadSearch).not.toContain("router.push('/driver/won-work')");
    expect(loadSearch).toContain("router.push('/driver/jobs')");
    expect(messages).not.toContain("href: '/driver/action-centre'");
    expect(accountNav).toContain("!ownerDriver || section.href !== '/driver/event-log'");
    expect(profile).toContain("ownerDriver ? 'Owner Driver' : 'Driver'");
    expect(profile).toContain("ownerDriver ? 'My Vehicle' : 'Vehicle'");
    expect(profile).not.toContain("ownerDriver ? 'POD & Documents' : 'Documents'");
    expect(profile).not.toContain('canonical active-vehicle identity signals');
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
