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
      "['customer-post-load-primary', 'Post Load', '/customer/post-load']",
      "['customer-loads-primary', 'Loads', '/customer/loads']",
      "['customer-quotes-primary', 'Quotes', '/customer/quotes']",
      "['customer-bookings-primary', 'Bookings', '/customer/bookings']",
      "['customer-diary-primary', 'Diary', '/customer/diary']",
      "['customer-tracking-primary', 'Tracking', '/customer/tracking']",
      "['customer-network-primary', 'Network', '/customer/network']",
      "['customer-action-centre-primary', 'Action Centre', '/customer/action-centre']",
    ]) expect(customer).toContain(primary);

    expect(customer).toContain("], 'customer-more');");
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
    ]) expect(shell).toContain("href: '" + href + "'");
  });

  it('promotes the core Customer lifecycle and keeps secondary functions under More', () => {
    const customer = shell.slice(shell.indexOf('function composeCustomerPrimaryNav'), shell.indexOf('function composeBrokerPrimaryNav'));
    for (const href of ['/customer/post-load', '/customer/loads', '/customer/quotes', '/customer/bookings', '/customer/diary', '/customer/tracking', '/customer/network', '/customer/action-centre']) {
      expect(customer).toContain("'" + href + "'");
    }
    expect(customer).toContain("], 'customer-more');");
    expect(shell).toContain('<CustomerMoreIcon item={item} />');
    expect(shellCss).toContain('[data-workspace-role="customer"] .top-workspace-nav__menu');
  });

  it('keeps Settings administrative and removes Customer operational duplicates from its side navigation', () => {
    expect(settings).toContain("routes.documents && role !== 'customer'");
    expect(settings).toContain("routes.audit && role !== 'customer'");
    expect(settings).toContain("routes.team ? [{ label: 'Users & Permissions'");
    expect(settings).toContain("routes.notifications ? [{ label: 'Notifications'");
    expect(settings).toContain("{ label: 'Security'");
  });

  it('keeps Customer control-desk geometry while Owner Driver uses the focused sole-trader dashboard', () => {
    expect(ownerDashboard).toContain('Current assignment');
    expect(ownerDashboard).toContain('Next booking');
    expect(ownerDashboard).toContain('Driver readiness');
    expect(ownerDashboard).toContain('/api/driver/dashboard/commercial-summary');
    expect(customerDashboard).toContain('customer-owner-parity-grid');
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

  it('keeps Owner Driver secondary navigation grouped under More', () => {
    expect(shell).toContain("id: 'owner-driver-more'");
    expect(shell).toContain("['/driver/vehicles', 'My Vehicle']");
    expect(shell).toContain("['/driver/settings', 'Account / Settings']");
    expect(shell).toContain('<OwnerDriverMoreIcon item={item} />');
  });
});
