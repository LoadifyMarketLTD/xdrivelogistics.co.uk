import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Broker cleaned workspace contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const dashboard = read('app/broker/BrokerDashboardHome.tsx');

  it('exposes the complete Broker workflow navigation', () => {
    for (const label of ['Broker Dashboard','Action Centre','Enquiries','Customers','Customer Loads','Post Load','Carrier Quotes','Compare Quotes','Awards','Margin / Profit','Active Jobs','Diary','POD Review','Disputes','Messages','Event Log','Carrier Network','Finance','Customer Invoices','Carrier Costs','Team','Settings']) {
      expect(shell).toContain(`label: '${label}'`);
    }
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
    for (const href of ['/broker/post-load','/broker/enquiries','/broker/bids','/broker/jobs','/broker/pod-review','/broker/customer-invoices','/broker/carrier-costs','/broker/margins']) {
      expect(dashboard).toContain(href);
    }
  });

  it('mirrors the same driver lifecycle in Broker language', () => {
    for (const label of ['Driver assigned','Driver accepted','Driver en route to collection','Driver at collection','Goods collected','In transit','Driver at delivery','Delivered']) {
      expect(dashboard).toContain(label);
    }
    expect(dashboard).toContain('workspaceJobPresentationStatus');
    expect(dashboard).toContain('classifyWorkspaceJobStage');
  });
});
