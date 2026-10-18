import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Customer clean workspace contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const roles = read('lib/workspaceRole.ts');
  const dashboard = read('app/customer/CustomerDashboardHome.tsx');

  it('keeps the complete Customer navigation available without duplicating it in the dashboard', () => {
    for (const label of ['Customer Dashboard','Action Centre','My Loads','Quotes','Bookings','Deliveries','Tracking','POD & Documents','Diary','Updates','Directory','Messages','Disputes','Event Log','Invoices','Team','Settings']) {
      expect(shell).toContain(`label: '${label}'`);
    }
    expect(roles).toContain("primaryAction: { label: 'Post Load', href: '/customer/post-load', capability: 'loads.create' }");
    expect(shell).toContain("customer-network-primary', 'Network', '/customer/network'");
    expect(shell).toContain("customer-action-centre-primary', 'Action Centre', '/customer/action-centre'");
    expect(shell).toContain("customer-bookings-primary', 'Bookings', '/customer/bookings'");
    expect(shell).toContain("customer-settings-primary', 'Settings', '/customer/settings'");
    expect(shell).not.toContain("customer-post-load-primary");
    expect(shell).toContain("if (role === 'customer') {");
    expect(shell).toContain('filterWorkspaceNavByAccess(composeCustomerPrototypeNav(), role, user)');
    expect(shell).toContain('const accessibleBase = filterWorkspaceNavByAccess(base, role, user)');
    expect(shell).toContain('composeCustomerPrimaryNav(mergeCanonicalNavFallback(preferred, accessibleBase))');
    expect(shell).toContain("{ id: 'customer-loads', label: 'My Loads'");
    expect(shell).toContain("{ id: 'customer-quotes', label: 'Quotes'");
    expect(shell).toContain("{ id: 'customer-bookings', label: 'Bookings'");
    expect(shell).not.toContain("{ id: 'customer-loads', label: 'Loads', items:");
  });

  it('keeps the two CX-sized primary customer signals at the top', () => {
    for (const label of ['Open Loads','Active Deliveries']) {
      expect(dashboard).toContain(`label="${label}"`);
    }
    for (const removedLabel of ['Quotes to Review','Outstanding Invoices','Awaiting award','Delayed','POD ready']) {
      expect(dashboard).not.toContain(`label="${removedLabel}"`);
    }
    expect(dashboard).toContain('<KpiGrid>');
    expect(dashboard).not.toContain('CUS-201');
  });

  it('keeps the essential customer workflows one click away in the navbar', () => {
    expect(roles).toContain("href: '/customer/post-load'");
    for (const href of ['/customer/action-centre','/customer/loads','/customer/quotes','/customer/bookings','/customer/tracking','/customer/invoices','/customer/settings']) {
      expect(shell).toContain(href);
    }
    expect(dashboard).not.toContain("router.push('/customer/action-centre')");
    expect(dashboard).not.toContain('View all loads');
    expect(dashboard).not.toContain("router.push('/customer/post-load')");
  });

  it('removes the duplicated dense dashboard modules', () => {
    for (const removed of ['Search & filters','Recent quote activity','Delivery photo evidence','Invoice position','Commercial & documents','Workspace shortcuts']) {
      expect(dashboard).not.toContain(removed);
    }
    expect(dashboard).toContain('Needs your attention');
    expect(dashboard).not.toContain('Quick actions');
    expect(dashboard).toContain('Activity at a glance');
  });

  it('mirrors the driver lifecycle in customer-facing language and actions', () => {
    expect(dashboard).toContain('workspaceJobOperationalLabel(job)');
    for (const action of ['Track','View booking','POD']) expect(dashboard).toContain(action);
    expect(dashboard).toContain("classifyWorkspaceJobStage(job)");
    expect(dashboard).toContain('customerJobPriority');
  });

  it('does not render the customer company name beside the workspace label', () => {
    expect(shell).toContain('<span>{definition.label}</span>');
    expect(shell).toContain('<strong>{companyName}</strong>');
  });
});
