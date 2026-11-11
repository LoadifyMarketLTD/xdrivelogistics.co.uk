import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read=(name:string)=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const master=read('app/try-xdrive-demo/components/OperationsDemo.tsx');
const vision=read('app/components/workspace/MemberFreightVisionPage.tsx');

describe('real Freight Vision with no fictitious market intelligence',()=>{
  it('routes Master role-specific Freight Vision to production sources',()=>{
    expect(master).toContain('if(authenticated && i===13)');
    expect(master).toContain("role==='Customer'?'/customer/freight-vision':role==='Broker'?'/broker/freight-vision':'/admin/freight-vision'");
    expect(read('app/customer/freight-vision/page.tsx')).toContain('MemberFreightVisionPage');
    expect(read('app/broker/freight-vision/page.tsx')).toContain('MemberFreightVisionPage');
    expect(read('app/broker/freight-vision/page.tsx')).toContain("allowedRoles={['broker']}");
    expect(read('app/customer/CustomerMasterLayoutGate.tsx')).toContain('customerMasterTab(pathname)');
    expect(read('lib/masterWorkspaceRouteTab.ts')).toContain("'freight-vision':13");
    expect(master).toContain("'/driver/freight-vision'");
  });
  it('reuses approved visual structure, real company jobs and quotes',()=>{
    expect(vision).toContain('demo-freight-vision.css');
    expect(vision).toContain('xd-fv-kpis');
    expect(vision).toContain('useCompanyWorkspaceData()');
    expect(vision).toContain("data.datasets.jobs.availability==='available'");
    expect(vision).toContain("data.datasets.bids.availability==='available'");
    expect(vision).toContain('data.jobs.filter');
    expect(vision).toContain('data.bids.filter');
  });
  it('explicitly leaves unconnected market rates, supply forecasts and matches unavailable',()=>{
    expect(vision).toContain('Independent market feed required');
    expect(vision).toContain('Verified vehicle supply history required');
    expect(vision).toContain('Matching service required');
    expect(vision).toContain('market-wide Exchange feed');
    expect(vision).not.toContain('market rate: 1.2');
    expect(vision).not.toContain('useDemoLoads');
  });
});
