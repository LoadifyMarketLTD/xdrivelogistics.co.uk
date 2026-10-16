import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Customer and Owner Driver workspace structure parity', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const shellCss = read('app/components/workspace/top-workspace-shell.css');
  const customerDashboard = read('app/customer/CustomerDashboardHome.tsx');
  const ownerDashboard = read('app/driver/page.tsx');
  const settings = read('app/components/workspace/RoleSettingsWorkspace.tsx');

  it('keeps Customer primary navigation role-specific while curating More like Owner Driver', () => {
    const customer = shell.slice(shell.indexOf('function composeCustomerPrimaryNav'), shell.indexOf('function composeBrokerPrimaryNav'));
    for (const primary of [
      "['customer-dashboard-primary', 'Dashboard', '/customer']",
      "['customer-directory-primary', 'Directory', '/customer/network']",
      "['customer-loads-primary', 'Loads', '/customer/loads']",
      "['customer-quotes-primary', 'Quotes', '/customer/quotes']",
      "['customer-diary-primary', 'Diary', '/customer/diary']",
      "['customer-freight-vision-primary', 'Freight Vision', '/customer/tracking']",
    ]) expect(customer).toContain(primary);

    expect(customer).toContain("], 'customer-more', 'More', [");
    for (const href of [
      '/customer/deliveries',
      '/customer/documents',
      '/customer/updates',
      '/customer/messages',
      '/customer/disputes',
      '/customer/event-log',
      '/customer/invoices',
      '/customer/team',
      '/customer/settings',
    ]) expect(shell).toContain(`href: '${href}'`);
  });

  it('promotes the core Customer lifecycle and keeps secondary functions under More', () => {
    const customer = shell.slice(shell.indexOf('function composeCustomerPrimaryNav'), shell.indexOf('function composeBrokerPrimaryNav'));
    for (const href of ['/customer/loads', '/customer/quotes', '/customer/diary', '/customer/tracking', '/customer/network', '/customer/action-centre', '/customer/bookings']) {
      expect(customer).toContain(`'${href}'`);
    }
    expect(customer).toContain("], 'customer-more', 'More', [");
    expect(customer).not.toContain("customer-post-load-primary");
    expect(shell).toContain('<CustomerMoreIcon item={item} />');
    expect(shellCss).toContain('.xdrive-operational-top-workspace .top-workspace-nav__menu');
    expect(shellCss).toContain('width: 248px !important;');
    expect(shellCss).not.toContain('max-width: min(252px');
  });

  it('keeps Settings administrative and removes Customer operational duplicates from its side navigation', () => {
    expect(settings).toContain("routes.documents && role !== 'customer'");
    expect(settings).toContain("routes.audit && role !== 'customer'");
    expect(settings).toContain("routes.team ? [{ label: 'Users & Permissions'");
    expect(settings).toContain("routes.notifications ? [{ label: 'Notifications'");
    expect(settings).toContain("{ label: 'Security'");
  });

  it('gives Customer the frozen PR675 two-column control-desk geometry without requiring Owner Driver to adopt shared classes', () => {
    expect(ownerDashboard).toContain('gridTemplateColumns: "minmax(360px, .84fr) minmax(0, 1.16fr)"');
    expect(customerDashboard).toContain('customer-owner-parity-grid xdrive-owner-dashboard-grid');
    expect(customerDashboard).toContain('customer-owner-parity-column xdrive-owner-dashboard-column');
    expect(customerDashboard).toContain('customer-owner-parity-subgrid xdrive-owner-dashboard-subgrid');
    expect(ownerDashboard).toContain('Reports & Statistics');
    expect(ownerDashboard).toContain('Activity at a glance');
    expect(customerDashboard).toContain('Reports & Statistics');
    expect(customerDashboard).toContain('Activity at a glance');
    expect(customerDashboard).toContain('Carrier / Member');
    expect(customerDashboard).toContain('Load ID / Ref');
    expect(customerDashboard).toContain('Freight Messenger');
  });

  it('adds CX-style finance, supplier and support control-desk sections without inventing unavailable KPIs', () => {
    expect(customerDashboard).toContain('Ready to invoice');
    expect(customerDashboard).toContain('Awaiting payment');
    expect(customerDashboard).toContain('Overdue invoices');
    expect(customerDashboard).toContain('Paid invoices');
    expect(customerDashboard).toContain('Supplier performance');
    expect(customerDashboard).toContain('News & Support');
    expect(customerDashboard).toContain('POD complete');
    expect(customerDashboard).toContain('Invoice awaiting payment');
    expect(customerDashboard).toContain('Last update:');
    expect(customerDashboard).not.toContain('on-time %');
    expect(customerDashboard).not.toContain('tracked %');
  });
  it('surfaces pending carrier acceptance consistently instead of reporting Driver Assigned too early', () => {
    expect(customerDashboard).toContain("fetch('/api/customer/booking-offers'");
    expect(customerDashboard).toContain('Awaiting Carrier Acceptance');
    expect(customerDashboard).toContain('Awaiting carrier acceptance');
    expect(customerDashboard).toContain("if (pendingOffer) return 'orange' as const");
    expect(customerDashboard).toContain("router.push('/customer/quotes?status=pending_acceptance')");
  });

  it('renders the Customer job detail register through the shared responsive detail grid without losing definition-list semantics', () => {
    const customerJobs = read('app/customer/CustomerWorkspaceModules.tsx');
    const baseline = read('app/components/workspace/workspace-measured-cx-baseline.css');
    expect(customerJobs).toContain('<dl className="workspace-detail-grid">');
    expect(customerJobs).toContain('<div className="workspace-detail-item"><dt>Collection</dt><dd>');
    expect(customerJobs).toContain('<div className="workspace-detail-item"><dt>Status</dt><dd>');
    expect(customerJobs).not.toContain("gridTemplateColumns:'150px 1fr'");
    expect(baseline).toContain('.xdrive-workspace-measured dl.workspace-detail-grid');
    expect(baseline).toContain('.xdrive-workspace-measured .workspace-detail-item > dt');
    expect(baseline).toContain('.xdrive-workspace-measured .workspace-detail-item > dd');
  });

  it('does not disturb the Owner Driver More workflow while applying the shared CX-live shell', () => {
    expect(shell).toContain("'/driver/won-work': 'Work'");
    expect(shell).toContain("'/driver/availability': 'Matching & Availability'");
    expect(shell).toContain("'/driver/finance': 'Business'");
    expect(shell).toContain("'/driver/event-log': 'Operations'");
    expect(shell).toContain("'/driver/settings': 'Administration'");
    expect(shell).toContain('<OwnerDriverMoreIcon item={item} />');
  });
});
