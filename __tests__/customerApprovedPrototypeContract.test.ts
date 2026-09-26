import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Customer clean workspace contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const dashboard = read('app/customer/CustomerDashboardHome.tsx');

  it('keeps the complete Customer navigation available without duplicating it in the dashboard', () => {
    for (const label of ['Customer Dashboard','Action Centre','Post Load','My Loads','Quotes','Awards','Bookings','Deliveries','Tracking','POD & Documents','Diary','Updates','Network','Messages','Disputes','Event Log','Invoices','Team','Settings']) {
      expect(shell).toContain(`label: '${label}'`);
    }
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
    for (const href of ['/customer/post-load','/customer/action-centre','/customer/loads','/customer/quotes','/customer/bookings','/customer/tracking','/customer/invoices']) {
      expect(dashboard).toContain(href);
    }
  });

  it('removes the duplicated dense dashboard modules', () => {
    for (const removed of ['Search & filters','Recent quote activity','Delivery photo evidence','Invoice position','Commercial & documents','Workspace shortcuts']) {
      expect(dashboard).not.toContain(removed);
    }
    expect(dashboard).toContain('Needs your attention');
    expect(dashboard).toContain('Quick actions');
    expect(dashboard).toContain('Recent transport');
  });

  it('does not render the customer company name beside the workspace label', () => {
    expect(shell).toContain("role !== 'customer' ? <strong>{companyName}</strong> : null");
  });
});
