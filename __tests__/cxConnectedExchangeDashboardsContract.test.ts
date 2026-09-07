import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');
const panel = read('app/components/workspace/ConnectedExchangePanel.tsx');

const dashboardContracts = [
  ['app/broker/BrokerDashboardHome.tsx', 'role="broker"'],
  ['app/customer/CustomerDashboardHome.tsx', 'role="customer"'],
  ['app/driver/page.tsx', 'role="driver"'],
  ['app/components/workspace/FleetControlDashboardHome.tsx', 'role="fleet"'],
  ['app/components/workspace/CarrierOperationsDashboardHome.tsx', 'role="carrier"'],
  ['app/super-admin/page.tsx', 'role="super-admin"'],
] as const;

describe('CX benchmark connected-workspace contract', () => {
  it('connects Broker, Customer, Driver, Fleet, Carrier and Super Admin homes to one role-aware exchange panel', () => {
    for (const [file, roleMarker] of dashboardContracts) {
      const source = read(file);
      expect(source).toContain('ConnectedExchangePanel');
      expect(source).toContain(roleMarker);
    }
  });

  it('keeps the shared operating chain visible without creating another data store', () => {
    for (const label of ['Directory', 'Loads', 'Quotes', 'Diary', 'Messages', 'Event Log', 'Finance']) {
      expect(panel).toContain(`label: '${label}'`);
    }
    expect(panel).toContain('Directory and trust → capacity → return journeys → loads → quotes → execution and diary → messaging and audit → finance.');
  });

  it('links only to real role pages in the connected panel', () => {
    const hrefs = [...panel.matchAll(/href: '([^']+)'/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThan(20);
    for (const href of hrefs) {
      const page = path.join(process.cwd(), 'app', href.replace(/^\//, ''), 'page.tsx');
      expect(fs.existsSync(page), `${href} must resolve to a real page`).toBe(true);
    }
  });

  it('keeps Super Admin connected navigation on MASTER v2 geometry', () => {
    expect(panel).toContain("variant?: 'workspace' | 'super-admin'");
    expect(panel).toContain("borderRadius: superAdmin ? 8 : 4");
    expect(panel).toContain("boxShadow: superAdmin ? '0px 2px 6px rgba(0,0,0,0.08)' : 'none'");
    expect(panel).toContain("padding: superAdmin ? '12px 18px' : '8px 10px'");
  });

  it('records privacy and truth constraints in the benchmark source of truth', () => {
    const benchmark = read('docs/benchmarks/CX_CONNECTED_WORKSPACES_2026-09-06.md');
    expect(benchmark).toContain('Never expose unrelated drivers');
    expect(benchmark).toContain('Never fabricate Delivery/Payment ratings');
    expect(benchmark).toContain('one canonical job/quote/award/driver/vehicle/invoice record');
    expect(benchmark).toContain('No automatic refund/payout/transfer');
  });
});
