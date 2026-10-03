import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Broker cleaned workspace contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const roles = read('lib/workspaceRole.ts');
  const dashboard = read('app/broker/BrokerDashboardHome.tsx');

  it('exposes the complete Broker workflow navigation', () => {
    for (const label of ['Broker Dashboard','Action Centre','Enquiries','Customers','Customer Loads','Carrier Quotes','Margin / Profit','Active Jobs','Diary','POD Review','Disputes','Messages','Event Log','Directory','Finance','Customer Invoices','Carrier Costs','Team','Settings']) {
      expect(shell).toContain(`label: '${label}'`);
    }
    expect(roles).toContain("primaryAction: { label: 'Post Load', href: '/broker/post-load', capability: 'loads.create' }");
    expect(shell).not.toContain("id: 'broker-post-load'");
    expect(shell).toContain("if (role === 'broker') {");
    expect(shell).toContain('filterWorkspaceNavByAccess(composeBrokerPrototypeNav(), role, user)');
  });

  it('keeps only four primary Broker signals on the dashboard', () => {
    for (const label of ['Open loads','Awaiting award','Active jobs','Gross margin']) {
      expect(dashboard).toContain(`<span>${label}</span>`);
    }
    expect(dashboard).not.toContain('Search & filters');
    expect(dashboard).not.toContain('Operational action queue');
    expect(dashboard).not.toContain('Commercial exposure');
  });

  it('keeps broker commercial and execution workflows connected', () => {
    expect(roles).toContain("href: '/broker/post-load'");
    for (const href of ['/broker/enquiries','/broker/bids','/broker/jobs','/broker/pod-review','/broker/customer-invoices','/broker/carrier-costs','/broker/margins']) {
      expect(dashboard + shell).toContain(href);
    }
    expect(dashboard).not.toContain("router.push('/broker/post-load')");
  });

  it('mirrors the same driver lifecycle in Broker language', () => {
    for (const label of ['Driver assigned','Driver accepted','Driver en route to collection','Driver at collection','Goods collected','In transit','Driver at delivery','Delivered']) {
      expect(dashboard).toContain(label);
    }
    expect(dashboard).toContain('workspaceJobPresentationStatus');
    expect(dashboard).toContain('classifyWorkspaceJobStage');
  });
});
