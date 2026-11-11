const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=(f)=>fs.readFileSync(path.join(root,f),'utf8');

test('approved 3150 Dashboard is a production-only reusable layout, not a demo data source',()=>{
 const dashboard=src('app/components/workspace/Master3150DashboardLayout.tsx');
 const adapter=src('app/components/workspace/CompanyMasterDashboard.tsx');
 for(const c of ['xd-dashboard-kpis','xd-dashboard-primary','xd-dashboard-secondary','xd-fleet-overview','xd-attention','xd-overview-metrics'])assert.ok(dashboard.includes(c),c);
 assert.doesNotMatch(dashboard,/demoExchange|DemoCompanyDashboard|fake|sample transactions|submitDemo/);
 assert.match(adapter,/real\.data/);
 assert.match(adapter,/Master3150DashboardLayout/);
});
test('3150 Loads cards and tab/filter styling are applied within authenticated Master only',()=>{
 const master=src('app/components/workspace/AuthenticatedMasterShell.tsx');
 const css=src('app/components/workspace/master3150-production.css');
 assert.match(master,/master3150-production/);
 assert.match(master,/master3150-production\.css/);
 assert.match(css,/\.xdrive-cx-load-card/);
 assert.match(css,/\.workspace-tab-strip/);
 assert.match(css,/\.workspace-filter-rail/);
 assert.doesNotMatch(master,/demoExchange|useDemoLoads/);
});
test('3150 Booking and Diary live KPIs retain canonical operational actions',()=>{
 const kpis=src('app/components/workspace/Master3150OperationsKpis.tsx');
 assert.match(kpis,/xd-diary-kpis/);
 assert.match(kpis,/data-master-reference="3150"/);
 assert.match(kpis,/pod_generated/);
 assert.doesNotMatch(kpis,/useDemoLoads|localStorage/);
 const references=[
 'app/customer/CustomerOperationalPages.tsx',
 'app/broker/jobs/page.tsx',
 'app/admin/won-work/page.tsx',
 'app/components/workspace/OperationsDiaryPage.tsx',
 'app/broker/diary/page.tsx',
 'app/customer/diary/page.tsx',
 ];
 for(const ref of references)assert.match(src(ref),/Master3150OperationsKpis|Master3150BookingHeader/,ref);
 assert.match(src('app/customer/CustomerOperationalPages.tsx'),/CompanyJobSheetPanel/);
 assert.match(src('app/components/workspace/OperationsDiaryPage.tsx'),/CxDiaryActions/);
 assert.match(src('app/admin/won-work/page.tsx'),/CompanyMarketplaceExchange/);
});

test('Customer uses the same 3150 Dashboard without removing existing commercial operations',()=>{
 const customer=src('app/customer/page.tsx');
 assert.match(customer,/CompanyMasterDashboard role="Customer"/);
 assert.match(customer,/Company3150LiveProvider/);
 assert.match(customer,/CustomerDashboardHome/);
 assert.match(customer,/showControls&&<CustomerDashboardHome/);
});
