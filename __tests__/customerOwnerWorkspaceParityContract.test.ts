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
      "['customer-action-centre-primary', 'Action Centre', '/customer/action-centre']",
      "['customer-loads-primary', 'View All Loads', '/customer/loads']",
      "['customer-quotes-primary', 'Quotes', '/customer/quotes']",
      "['customer-bookings-primary', 'Bookings', '/customer/bookings']",
      "['customer-tracking-primary', 'Tracking', '/customer/tracking']",
      "['customer-diary-primary', 'Diary', '/customer/diary']",
      "['customer-invoices-primary', 'Invoices', '/customer/invoices']",
      "['customer-settings-primary', 'Settings', '/customer/settings']",
    ]) expect(customer).toContain(primary);

    for (const href of [
      '/customer/deliveries',
      '/customer/documents',
      '/customer/updates',
      '/customer/network',
      '/customer/messages',
      '/customer/disputes',
      '/customer/event-log',
    ]) expect(customer).toContain(`'${href}'`);

    for (const duplicate of ['/customer/team', '/customer/notifications', '/customer/settings/billing', '/customer/account']) {
      expect(customer).not.toContain(`'${duplicate}'`);
    }
  });

  it('uses grouped Work, Collaboration and Business sections with real icons for Customer More', () => {
    expect(shell).toContain("'/customer/deliveries': 'Work'");
    expect(shell).toContain("'/customer/documents': 'Work'");
    expect(shell).toContain("'/customer/updates': 'Work'");
    expect(shell).toContain("'/customer/network': 'Collaboration'");
    expect(shell).toContain("'/customer/messages': 'Collaboration'");
    expect(shell).toContain("'/customer/disputes': 'Business'");
    expect(shell).toContain("'/customer/event-log': 'Business'");
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

  it('gives Customer the same two-column control-desk geometry as Owner Driver', () => {
    expect(ownerDashboard).toContain("gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)'");
    expect(ownerDashboard).toContain('Reports & Statistics');
    expect(ownerDashboard).toContain('Activity at a glance');
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

  it('does not disturb the canonical Owner Driver More workflow', () => {
    expect(shell).toContain("'/driver/jobs': 'Work'");
    expect(shell).toContain("'/driver/availability': 'Matching & Availability'");
    expect(shell).toContain("'/driver/finance': 'Business'");
    expect(shell).toContain('<OwnerDriverMoreIcon item={item} />');
  });
});
