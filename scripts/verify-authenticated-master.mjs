import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const read=path=>readFileSync(resolve(root,path),'utf8');
for(const role of ['customer','driver']){
 const page=read('app/'+role+'/page.tsx');
 const layout=read('app/'+role+'/layout.tsx');
 const gate=read('app/'+role+'/'+(role==='customer'?'CustomerMasterLayoutGate.tsx':'DriverMasterLayoutGate.tsx'));
 assert.ok(page.includes('<MasterWorkspace'),role+' root must render the canonical Master');
 assert.ok(page.includes('authenticated dashboard='),role+' must use its real operational dashboard');
 if(role==='customer') assert.ok(page.includes('<Company3150LiveProvider>')&&page.includes('CompanyMasterDashboard role="Customer"'),'customer must use scoped 3150 provider and dashboard');
 if(role==='driver') assert.ok(page.includes("role === 'Owner Driver' ? <Company3150LiveProvider>{view}</Company3150LiveProvider> : view"),'only authorized owner driver may mount company data');
 assert.ok(read("app/try-xdrive-demo/components/MasterWorkspace.tsx").includes("MasterPreviewIsolation"),"Master must isolate demo endpoints");
 assert.ok(layout.includes('ProtectedRoute'),role+' must preserve authentication');
 assert.ok(layout.includes('MasterLayoutGate'),role+' must suppress duplicate top navigation at root');
 assert.ok(gate.includes('usePathname'),role+' must preserve navigation for operational subroutes');
 assert.ok(gate.includes("pathname==='/"+role+"'"),role+' only the root may bypass the old nested top shell');
}
const driver=read('app/driver/page.tsx');
const customer=read('app/customer/CustomerDashboardHome.tsx');
assert.ok(driver.includes('filterJobsForDriver'), 'driver job assignment filter missing');
assert.ok(driver.includes('nextDriverExecutionStatus'), 'driver status transition contract missing');
assert.ok(driver.includes('/api/driver/jobs/'), 'driver cancellation API missing');
assert.ok(driver.includes('/driver/jobs/'), 'driver operational job navigation missing');
assert.ok(customer.includes('/api/customer/booking-offers'), 'customer accepted carrier offer workflow missing');
assert.ok(customer.includes('/customer/tracking'), 'customer tracking navigation missing');
assert.ok(customer.includes('/customer/bookings'), 'customer booking navigation missing');
const section=read('app/try-xdrive-demo/components/MasterOperationalSection.tsx');
assert.ok(!section.includes('/api/try-xdrive-demo/'), 'authenticated operations must not use demo endpoints');
assert.ok(!section.includes('XDL-DEMO'), 'authenticated master must not create sample jobs');
const source=read('app/try-xdrive-demo/components/OperationsDemo.tsx');
assert.ok(source.includes('dashboard&&tab===initialTab?dashboard'),'real dashboards must be shown in the shared Master at the selected tab');
for(const index of [1,2,3,4,5,6,7,10,11,12,13,14,15,16]) assert.ok(source.includes('if(authenticated && i==='+index+')'),'authenticated Master tab '+index+' must navigate to a real role-scoped route');
for(const route of ['customer/post-load','customer/quotes','customer/bookings','customer/network/directory','driver/loads','driver/quotes','driver/jobs','driver/history','driver/directory','driver/finance']){
 assert.ok(existsSync(resolve(root,'app',route,'page.tsx')),route+' original live route was lost');
}
console.log('PASS authenticated /customer and /driver use one Master shell, original workflows and security guards retained');
