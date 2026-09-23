import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Broker approved prototype contract', () => {
  const shell = read('app/components/workspace/TopWorkspaceShell.tsx');
  const dashboard = read('app/broker/BrokerDashboardHome.tsx');

  it('uses the dedicated Broker prototype navigation rather than Driver navigation', () => {
    for (const label of ['Broker Dashboard','Customers','Customer Loads','Post Load','Carrier Quotes','Compare Quotes','Awards','Margin / Profit','Active Jobs','POD Review','Disputes','Customer Invoices','Carrier Costs','Settings','Team','Carrier Network']) {
      expect(shell).toContain(`label: '${label}'`);
    }
    expect(shell).toContain("if (role === 'broker') return composeBrokerPrototypeNav()");
  });

  it('keeps the approved six Broker KPI strip backed by live workspace data', () => {
    for (const label of ['Open Loads','Quotes Received','Awaiting Award','Active Jobs','POD Missing','Gross Margin']) {
      expect(dashboard).toContain(`label="${label}"`);
    }
    expect(dashboard).toContain('useCompanyWorkspaceData()');
    expect(dashboard).not.toContain('BRK-865');
  });

  it('keeps broker commercial and execution workflows connected', () => {
    for (const href of ['/broker/post-load','/broker/compare-quotes','/broker/jobs','/broker/pod-review','/broker/finance','/broker/margins']) {
      expect(dashboard).toContain(href);
    }
  });
});
