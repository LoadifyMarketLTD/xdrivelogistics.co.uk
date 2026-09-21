import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const panel = read('app/components/workspace/ConnectedExchangePanel.tsx');

const dashboardFiles = [
  'app/broker/BrokerDashboardHome.tsx',
  'app/customer/CustomerDashboardHome.tsx',
  'app/driver/page.tsx',
  'app/components/workspace/FleetControlDashboardHome.tsx',
  'app/components/workspace/CarrierOperationsDashboardHome.tsx',
  'app/super-admin/page.tsx',
] as const;

describe('CX benchmark connected-workspace contract', () => {
  it('keeps role dashboards free of the duplicated connected-exchange navigation panel', () => {
    for (const file of dashboardFiles) {
      const source = read(file);
      expect(source).not.toContain('ConnectedExchangePanel');
      expect(source).not.toMatch(/Connected (transport|commercial|driver|fleet|carrier|Exchange) exchange/i);
    }
  });

  it('keeps the legacy shared panel source isolated and non-authoritative', () => {
    for (const label of ['Directory', 'Loads', 'Quotes', 'Diary', 'Messages', 'Event Log', 'Finance']) {
      expect(panel).toContain(`label: '${label}'`);
    }
    expect(panel).not.toContain('supabase');
    expect(panel).not.toContain('fetch(');
  });
});
