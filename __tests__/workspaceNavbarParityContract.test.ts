import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('cross-workspace navbar parity', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const exact = read('app/components/workspace/workspace-cx-exact-identity.css');
  const roleConfig = read('lib/workspaceRole.ts');

  it('loads exact CX identity last in every operational root layout', () => {
    for (const layout of ['app/admin/layout.tsx','app/broker/layout.tsx','app/customer/layout.tsx','app/driver/layout.tsx']) {
      const source = read(layout);
      expect(source).toContain("workspace-cx-exact-identity.css");
      const cssImports = source.split('\n').filter((line) => line.startsWith('import ') && line.includes('.css'));
      expect(cssImports.at(-1)).toContain('workspace-cx-exact-identity.css');
    }
  });

  it('locks one navbar geometry for every non-Super-Admin workspace', () => {
    expect(exact).toContain("font-family:\"HK Nova\",Arial,sans-serif!important");
    expect(exact).toContain('font-size:12px!important');
    expect(exact).toContain('height:29px!important');
    expect(exact).toContain('min-height:29px!important');
    expect(exact).toContain('padding:2px 8px 9px!important');
    expect(exact).toContain('font-size:13px!important');
    expect(exact).toContain('font-weight:600!important');
    expect(exact).toContain('box-shadow:inset 0 -2px 0');
    expect(exact).toContain('width:165px!important');
    expect(exact).toContain("not([data-workspace-role='platform_owner'])");
  });

  it('uses the same shell renderer for all operational roles', () => {
    expect(shell).toContain('data-workspace-role={role}');
    expect(shell).toContain("if (role === 'broker')");
    expect(shell).toContain("if (role === 'customer')");
    expect(shell).toContain('if (CARRIER_NAV_ROLES.has(role)) return composeCarrierPrimaryNav(base)');
    expect(shell).toContain("if (role === 'fleet_manager') return composeFleetPrimaryNav(base)");
    expect(shell).toContain("if (role === 'owner_driver') return composeDriverPrimaryNav(base, true)");
    expect(shell).toContain("if (role === 'driver') return composeDriverPrimaryNav(base, false)");
    expect(shell).toContain("if (role === 'dispatcher') return composeDispatcherPrimaryNav(base)");
    expect(shell).toContain("if (role === 'finance') return composeFinancePrimaryNav(base)");
    expect(shell).toContain("if (role === 'compliance') return composeCompliancePrimaryNav(base)");
    expect(shell).toContain("if (role === 'viewer')");
  });

  it('keeps role-specific primary navigation contracts complete', () => {
    const required = [
      "['customer-dashboard-primary', 'Dashboard', '/customer']",
      "['customer-post-load-primary', 'Post Load', '/customer/post-load']",
      "['customer-loads-primary', 'Loads', '/customer/loads']",
      "['customer-quotes-primary', 'Quotes', '/customer/quotes']",
      "['customer-bookings-primary', 'Bookings', '/customer/bookings']",
      "['customer-diary-primary', 'Diary', '/customer/diary']",
      "['customer-tracking-primary', 'Tracking', '/customer/tracking']",
      "['customer-network-primary', 'Network', '/customer/network']",
      "['broker-dashboard-primary', 'Dashboard', '/broker']",
      "['broker-enquiries-primary', 'Enquiries', '/broker/enquiries']",
      "['broker-loads-primary', 'Loads', '/broker/loads']",
      "['broker-quotes-primary', 'Carrier Quotes', '/broker/bids']",
      "['broker-jobs-primary', 'Jobs', '/broker/jobs']",
      "['broker-diary-primary', 'Diary', '/broker/diary']",
      "['broker-pod-primary', 'POD Review', '/broker/pod-review']",
      "['broker-finance-primary', 'Finance', '/broker/finance']",
      "['owner-driver-dashboard-primary', 'Dashboard', '/driver']",
      "['owner-driver-loads-primary', 'Loads', '/driver/loads']",
      "['owner-driver-quotes-primary', 'Quotes', '/driver/quotes']",
      "['owner-driver-jobs-primary', 'My Jobs', '/driver/jobs']",
      "['owner-driver-diary-primary', 'Diary', '/driver/history']",
      "['owner-driver-availability-primary', 'Availability', '/driver/availability']",
      "['owner-driver-returns-primary', 'Return Journeys', '/driver/returns']",
      "['owner-driver-directory-primary', 'Directory', '/driver/directory']",
      "['driver-dashboard-primary', 'Dashboard', '/driver']",
      "['driver-jobs-primary', 'My Jobs', '/driver/jobs']",
      "['driver-diary-primary', 'Diary', '/driver/history']",
      "['driver-availability-primary', 'Availability', '/driver/availability']",
      "['fleet-dashboard', 'Dashboard', '/admin/fleet']",
      "['fleet-live-availability', 'Live Availability', '/admin/live-availability']",
      "['fleet-my-fleet', 'My Fleet', '/admin/fleet/vehicles']",
      "['fleet-return-journeys', 'Return Journeys', '/admin/fleet/returns']",
      "['fleet-jobs', 'Jobs', '/admin/fleet/jobs']",
      "['fleet-diary', 'Diary', '/admin/diary']",
      "['dispatcher-dashboard-primary', 'Dashboard', '/admin']",
      "['dispatcher-diary-primary', 'Diary', '/admin/diary']",
      "['dispatcher-unallocated-primary', 'Unallocated', '/admin/fleet/assignments']",
      "['dispatcher-active-primary', 'Active Jobs', '/admin/fleet/active-jobs']",
      "['dispatcher-collections-primary', 'Collections', '/admin/collections']",
      "['dispatcher-deliveries-primary', 'Deliveries', '/admin/deliveries']",
      "['dispatcher-positions-primary', 'Live Positions', '/admin/fleet/positions']",
      "['finance-dashboard-primary', 'Dashboard', '/admin/invoices']",
      "['finance-customer-primary', 'Customer Invoices', '/admin/finance/customer-invoices']",
      "['finance-carrier-primary', 'Carrier Invoices', '/admin/finance/carrier-invoices']",
      "['finance-payments-primary', 'Payments', '/admin/finance/payments']",
      "['finance-balances-primary', 'Balances', '/admin/finance/balances']",
      "['finance-reports-primary', 'Reports', '/admin/finance/reports']",
      "['compliance-dashboard-primary', 'Dashboard', '/admin/documents']",
      "['compliance-driver-primary', 'Driver Docs', '/admin/documents?type=driver']",
      "['compliance-vehicle-primary', 'Vehicle Docs', '/admin/documents?type=vehicle']",
      "['compliance-company-primary', 'Company Docs', '/admin/documents/company']",
      "['compliance-verification-primary', 'Verification', '/admin/documents?view=pending']",
      "['compliance-expiry-primary', 'Expiry', '/admin/documents/expiry']",
      "['compliance-incidents-primary', 'Incidents', '/admin/incidents']",
    ];
    for (const marker of required) expect(shell).toContain(marker);
    expect(roleConfig).toContain("company_owner:");
    expect(roleConfig).toContain("company_admin:");
    expect(roleConfig).toContain("carrier_admin:");
  });

  it('keeps every literal workspace navigation href backed by a real page', () => {
    const source = shell + '\n' + roleConfig;
    const hrefs = [...source.matchAll(/href:\s*['\"\x60]([^'\"\x60]+)['\"\x60]/g)]
      .map((match) => match[1].split('?')[0])
      .filter((href) => /^\/(admin|broker|customer|driver)(\/|$)/.test(href));

    for (const href of new Set(hrefs)) {
      expect(existsSync(join(process.cwd(), 'app', href.replace(/^\//, ''), 'page.tsx')), `${href} has no page.tsx`).toBe(true);
    }
  });
});
