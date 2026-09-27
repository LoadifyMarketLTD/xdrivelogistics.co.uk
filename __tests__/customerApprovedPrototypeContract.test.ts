import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Customer clean workspace contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const roles = read('lib/workspaceRole.ts');
  const dashboard = read('app/customer/CustomerDashboardHome.tsx');

  it('keeps the complete Customer navigation available without duplicating it in the dashboard', () => {
    for (const label of ['Customer Dashboard','Action Centre','My Loads','Quotes','Awards','Bookings','Deliveries','Tracking','POD & Documents','Diary','Updates','Network','Messages','Disputes','Event Log','Invoices','Team','Settings']) {
      expect(shell).toContain(`label: '${label}'`);
    }
    expect(roles).toContain("primaryAction: { label: 'Post Load', href: '/customer/post-load', capability: 'loads.create' }");
    expect(shell).not.toContain("id: 'customer-post-load'");
    expect(shell).toContain("if (role === 'customer') return composeCustomerPrototypeNav()");
  });

  it('keeps only the four primary customer signals at the top', () => {
    for (const label of ['Open loads','Quotes to review','Active deliveries','Outstanding invoices']) {
      expect(dashboard).toContain(`<span>${label}</span>`);
    }
    for (const removedLabel of ['Awaiting award','Delayed','POD ready']) {
      expect(dashboard).not.toContain(`<span>${removedLabel}</span>`);
    }
    expect(dashboard).toContain('customer-dash-metrics');
    expect(dashboard).not.toContain('CUS-201');
  });

  it('keeps the essential customer workflows one click away', () => {
    expect(roles).toContain("href: '/customer/post-load'");
    for (const href of ['/customer/action-centre','/customer/loads','/customer/quotes','/customer/bookings','/customer/tracking','/customer/invoices']) {
      expect(dashboard).toContain(href);
    }
    expect(dashboard).not.toContain("router.push('/customer/post-load')");
  });

  it('removes the duplicated dense dashboard modules', () => {
    for (const removed of ['Search & filters','Recent quote activity','Delivery photo evidence','Invoice position','Commercial & documents','Workspace shortcuts']) {
      expect(dashboard).not.toContain(removed);
    }
    expect(dashboard).toContain('Needs your attention');
    expect(dashboard).toContain('Quick actions');
    expect(dashboard).toContain('Recent transport');
  });

  it('mirrors the driver lifecycle in customer-facing language and actions', () => {
    for (const label of ['Driver assigned','Driver accepted','Driver en route to collection','Driver at collection','Goods collected','In transit','Driver at delivery','Delivered']) {
      expect(dashboard).toContain(label);
    }
    for (const action of ['Track','View booking','View POD']) expect(dashboard).toContain(action);
    expect(dashboard).toContain("classifyWorkspaceJobStage(job)");
    expect(dashboard).toContain('customerJobPriority');
  });

  it('does not render the customer company name beside the workspace label', () => {
    expect(shell).toContain("role !== 'customer' ? <strong>{companyName}</strong> : null");
  });
});
