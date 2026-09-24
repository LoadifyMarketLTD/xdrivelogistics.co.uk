import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Customer approved prototype contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const dashboard = read('app/customer/CustomerDashboardHome.tsx');

  it('uses the dedicated Customer prototype navigation', () => {
    for (const label of ['Customer Dashboard','Post Load','My Loads','Quotes','Bookings','Deliveries','POD & Documents','Updates','Invoices','Team','Settings']) expect(shell).toContain(`label: '${label}'`);
    expect(shell).toContain("if (role === 'customer') return composeCustomerPrototypeNav()");
  });

  it('keeps the six Customer decision and delivery signals at the top', () => {
    for (const label of ['Open loads','Quotes received','Awaiting award','Active deliveries','Delayed','POD ready']) expect(dashboard).toContain(`<span>${label}</span>`);
    expect(dashboard).toContain('customer-dash-metrics');
    expect(dashboard).toContain('metricState(jobsDataset');
    expect(dashboard).not.toContain('CUS-201');
  });

  it('keeps real customer transport workflows connected', () => {
    for (const href of ['/customer/post-load','/customer/loads','/customer/quotes','/customer/bookings','/customer/tracking','/customer/invoices']) expect(dashboard).toContain(href);
  });
});
