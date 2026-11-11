import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (file:string) => readFileSync(new URL(`../${file}`, import.meta.url),'utf8');
const master=read('app/try-xdrive-demo/components/OperationsDemo.tsx');
const report=read('app/components/workspace/MemberOperationalReports.tsx');

describe('real Master Reports replace indicative demo metrics',()=>{
  it('uses real company-scope reports for Customer, Broker and Carrier',()=>{
    expect(master).toContain('if(authenticated && i===16)');
    expect(master).toContain("role==='Customer'?'/customer/reports':role==='Broker'?'/broker/reports':'/admin/reports'");
    expect(read('app/customer/reports/page.tsx')).toContain('MemberOperationalReports role="customer"');
    expect(read('app/broker/reports/page.tsx')).toContain('useCompanyWorkspaceData()');
    expect(read('app/admin/reports/page.tsx')).toContain('MemberOperationalReports role="carrier"');
    expect(read('app/customer/CustomerMasterLayoutGate.tsx')).toContain('customerMasterTab(pathname)');
    expect(read('lib/masterWorkspaceRouteTab.ts')).toContain('reports:16');
    expect(read('app/driver/reports/page.tsx')).toContain('MemberOperationalReports');
    expect(read('app/driver/reports/page.tsx')).toContain("allowedRoles={['driver']}");
    expect(master).toContain("'/driver/reports'");
    expect(read('app/driver/DriverMasterLayoutGate.tsx')).toContain('reports:16');
  });
  it('reuses approved 3150 visual structure, with real jobs/bids/invoices',()=>{
    expect(report).toContain('demo-reports-board.css');
    expect(report).toContain('xd-reports-metrics');
    expect(report).toContain('useCompanyWorkspaceData()');
    expect(report).toContain('data.jobs.filter');
    expect(report).toContain('data.bids.filter');
    expect(report).toContain('data.invoices.filter');
  });
  it('does not infer unsupported VAT, market rates or invoice totals',()=>{
    expect(report).toContain("data.datasets[key].availability === 'available'");
    expect(report).toContain("'Unavailable'");
    expect(report).toContain('invoicesVerified && invoiceCurrencySet.size===1');
    expect(report).toContain('No indicative VAT or invented revenue figures');
    expect(report).not.toContain('*.2');
  });
});
