const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
test('all Admin routes use the approved master outer layout and Broker shares that shell',()=>{
 const admin=read('app/admin/Company3150LayoutGate.tsx');
 const broker=read('app/broker/Broker3150LayoutGate.tsx');
 const mapping=read('lib/masterWorkspaceRouteTab.ts');
 assert.match(admin,/MasterWorkspace/);
 assert.match(admin,/adminMasterTab\(pathname\)/);
 assert.doesNotMatch(admin,/TopWorkspaceShell|AdminPlatformShell/);
 assert.match(broker,/MasterWorkspace/);
 assert.match(broker,/brokerMasterTab\(pathname\)/);
 assert.doesNotMatch(broker,/TopWorkspaceShell/);
 for(const section of ['jobs','quotes','invoices','diary','post-load','fleet','marketplace','messages','notifications','finance','pod']){
  assert.match(mapping,new RegExp("'"+section+"'\\s*:"));
 }
});
test('authenticated workspaces use production shell with no demo data dependencies',()=>{
 const entry=read('app/try-xdrive-demo/components/MasterWorkspace.tsx');
 const production=read('app/components/workspace/AuthenticatedMasterShell.tsx');
 const adminHome=read('app/admin/page.tsx');
 const brokerHome=read('app/broker/page.tsx');
 assert.match(entry,/if\(authenticated\)\{/);
 assert.match(entry,/AuthenticatedMasterShell/);
 assert.match(entry,/dynamic\(\(\)=>import\("\.\/OperationsDemo"\)/);
 assert.doesNotMatch(production,/demoExchange|publishDemoLoad|useDemoLoads|PostLoadDemo/);
 assert.match(adminHome,/CompanyMasterDashboard/);
 assert.match(brokerHome,/CompanyMasterDashboard/);
});
test('all role shells share the approved Master brand asset',()=>{
 const brand=read('app/components/workspace/MasterBrandImage.tsx');
 const approved=read('app/try-xdrive-demo/components/ApprovedSidebar.tsx');
 const superAdmin=read('app/super-admin/_components/SuperAdminSidebar.tsx');
 assert.match(brand,/xdrive-logo-company-3150\.png/);
 assert.match(approved,/MasterBrandImage/);
 assert.match(superAdmin,/MasterBrandImage/);
});
test('all real authenticated roles are out of preview isolation and Customer cannot manage foreign fleet',()=>{
 const master=read('app/try-xdrive-demo/components/MasterWorkspace.tsx');
 const policy=read('app/try-xdrive-demo/components/MasterWorkspacePolicy.ts');
 assert.match(master,/if\(authenticated\)\{/);
 assert.match(master,/<MasterPreviewIsolation>/);
 assert.match(policy,/"Customer":\["postLoad","award"\]/);
 assert.match(policy,/"Broker":\["postLoad","quote","award","dispatch"\]/);
 assert.match(policy,/"Company Driver":\["quote"\]/);
 assert.match(policy,/"Employee Driver":\[\]/);
 assert.match(policy,/"Driver":\["quote"\]/);
});
test('buyer award uses shared real-data fullscreen confirmation with 2 independent consents',()=>{
 const quotesRoute=read('app/customer/quotes/page.tsx');
 const cx=read('app/customer/quotes/CustomerQuotesCxPage.tsx');
 const fullscreen=read('app/customer/quotes/BookingConfirmationFullPage.tsx');
 assert.match(quotesRoute,/CustomerQuotesCxPage/);
 assert.match(cx,/paymentTerms: candidate\.job\.payment_terms/);
 assert.match(cx,/bookingPaymentObligationRequestBody/);
 assert.match(cx,/\/api\/customer\/bids\/\$\{id\}\/award/);
 assert.match(fullscreen,/detailsAccepted && paymentAccepted && !working/);
});
test('approved Post Load fields and quarter-hour scheduling remain available',()=>{
 const post=read('app/components/workspace/LoadPostingForm.tsx');
 assert.match(post,/index \* 15/);
 assert.match(post,/Use a 15-minute time slot/);
});
