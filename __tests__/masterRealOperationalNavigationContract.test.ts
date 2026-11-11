import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const master = source('app/try-xdrive-demo/components/OperationsDemo.tsx');

const routes: Array<{ tab: number; paths: [string,string,string]; files: [string,string,string] }> = [
  {tab:1, paths:['/customer/post-load','/broker/post-load','/admin/post-load'], files:['app/customer/post-load/page.tsx','app/broker/post-load/page.tsx','app/admin/post-load/page.tsx']},
  {tab:2, paths:['/customer/loads','/broker/loads','/admin/marketplace'], files:['app/customer/loads/page.tsx','app/broker/loads/page.tsx','app/admin/marketplace/page.tsx']},
  {tab:3, paths:['/customer/quotes','/broker/bids','/admin/exchange'], files:['app/customer/quotes/page.tsx','app/broker/bids/page.tsx','app/admin/exchange/page.tsx']},
  {tab:4, paths:['/customer/bookings','/broker/jobs','/admin/won-work'], files:['app/customer/bookings/page.tsx','app/broker/jobs/page.tsx','app/admin/won-work/page.tsx']},
  {tab:7, paths:['/customer/diary','/broker/diary','/admin/diary'], files:['app/customer/diary/page.tsx','app/broker/diary/page.tsx','app/admin/diary/page.tsx']},
  {tab:8, paths:['/customer/invoices','/broker/finance','/admin/finance'], files:['app/customer/invoices/page.tsx','app/broker/finance/page.tsx','app/admin/finance/page.tsx']},
];

describe('canonical Master navigation routes real authenticated modules', () => {
  for (const {tab,paths,files} of routes) {
    it(`tab ${tab} routes Customer, Broker, Carrier into real protected pages`, () => {
      expect(master).toContain(`if(authenticated && i===${tab})`);
      expect(master).toContain(`role==='Customer'?'${paths[0]}':role==='Broker'?'${paths[1]}':'${paths[2]}'`);
      for(const file of files) expect(source(file).length).toBeGreaterThan(70);
    });
  }
  it('keeps authenticated driver-specific routes, never routing drivers as broker/carrier', () => {
    expect(master).toContain('if(isLiveDriverWorkspace){router.push(DRIVER_LIVE_ROUTES[i]');
    expect(master).toContain("'/driver/finance'");
    expect(master).toContain("'/driver/loads'");
  });
  it('preserves Customer role isolation even inside the preview-isolation wrapper', () => {
    expect(source('app/try-xdrive-demo/components/MasterWorkspace.tsx')).toContain('<AuthenticatedMasterShell role={role}');
    expect(master).not.toContain('if(authenticated && !preview && i===2)');
  });
  it('real data adapters are present for posted loads, bids, bookings, diary and invoices', () => {
    expect(source('app/components/workspace/CompanyMarketplaceExchange.tsx')).toContain('/api/marketplace/company');
    expect(source('app/broker/bids/page.tsx')).toContain('useCompanyWorkspaceData()');
    expect(source('app/broker/jobs/page.tsx')).toContain('useCompanyWorkspaceData()');
    expect(source('app/customer/diary/page.tsx')).toContain('useCompanyWorkspaceData()');
    expect(source('app/components/workspace/WorkspaceFinanceControl.tsx')).toContain('/api/workspace/finance/control');
  });
});
