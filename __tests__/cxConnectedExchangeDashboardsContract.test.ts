import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const dashboardFiles = [
  'app/broker/BrokerDashboardHome.tsx',
  'app/customer/CustomerDashboardHome.tsx',
  'app/driver/page.tsx',
  'app/components/workspace/FleetControlDashboardHome.tsx',
  'app/components/workspace/CarrierOperationsDashboardHome.tsx',
  'app/super-admin/page.tsx',
] as const;

describe('dashboard navigation de-duplication contract', () => {
  it('keeps duplicated connected-exchange navigation panels off role dashboards', () => {
    for (const file of dashboardFiles) {
      const source = read(file);
      expect(source).not.toContain('ConnectedExchangePanel');
      expect(source).not.toMatch(/Connected (transport|commercial|driver|fleet|carrier|Exchange) exchange/i);
    }
  });

  it('removes the obsolete shared ConnectedExchangePanel source', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/components/workspace/ConnectedExchangePanel.tsx'))).toBe(false);
  });
});
