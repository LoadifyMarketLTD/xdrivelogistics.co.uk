import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import assert from "node:assert/strict";
const root=process.cwd();
const routes={
  "try-xdrive-demo":"Customer",
  "try-xdrive-broker-demo":"Broker",
  "try-xdrive-company-demo":"Company / Carrier",
  "try-xdrive-fleet-demo":"Fleet",
  "try-xdrive-owner-driver-demo":"Owner Driver",
  "try-xdrive-dispatcher-demo":"Dispatcher",
  "try-xdrive-driver-demo":"Driver",
  "try-xdrive-company-driver-demo":"Company Driver",
  "try-xdrive-employee-driver-demo":"Employee Driver"
};
const read=p=>readFileSync(resolve(root,p),"utf8");
for(const [route,role] of Object.entries(routes)){
  const page=read("app/"+route+"/page.tsx");
  assert.match(page,/import MasterWorkspace from /,route+" must use the single master");
  assert.ok(page.includes('<MasterWorkspace role="'+role+'"/>'),route+" must preserve canonical role config");
  assert.ok(!page.includes("<ApprovedSidebar")&&!page.includes("DemoCompanyBookings"),route+" must not maintain a separate visual implementation");
  console.log("PASS master route "+route+" -> "+role);
}
for(const route of ["admin","broker"]){
  const page=read("app/"+route+"/page.tsx");
  assert.ok(page.includes("MasterWorkspace"),route+" authenticated workspace must use MasterWorkspace");
  assert.ok(page.includes("ProtectedRoute"),route+" must remain auth protected");
  assert.ok(page.includes("Company3150LiveProvider"),route+" must have authenticated data provider");
}
for(const role of ["customer","driver"]){
 const page=read("app/"+role+"/page.tsx");
 assert.ok(page.includes("MasterWorkspace"),role+" authenticated route must use the canonical Master");
 assert.ok(page.includes("authenticated dashboard="),role+" root must preserve its live operational dashboard");
 if(role==="customer") assert.ok(page.includes('<Company3150LiveProvider>') && page.includes('CompanyMasterDashboard role="Customer"'),"customer must use shared 3150 visual and role-scoped data provider");
 if(role==="driver") assert.ok(page.includes("role === 'Owner Driver' ? <Company3150LiveProvider>{view}</Company3150LiveProvider> : view"),"company data provider must only mount for authorized Owner Driver");
 const layout=read("app/"+role+"/layout.tsx");
 assert.ok(layout.includes("ProtectedRoute"),role+" must retain ProtectedRoute");
 assert.ok(layout.includes("MasterLayoutGate"),role+" must avoid a duplicate sidebar while protecting child pages");
}
const policy=read("app/try-xdrive-demo/components/MasterWorkspacePolicy.ts");
const expected=["Dashboard","Post Load","Loads","Quotes","Bookings","My Fleet","Drivers","Diary","Invoices","Network & Tools","Directory","Live Availability","Return Journeys","Freight Vision","Messages","Notifications","Reports"];
const nav=(policy.match(/MASTER_WORKSPACE_TABS\s*=\s*\[([^\]]+)\]/)||[])[1]||"";
assert.deepEqual([...nav.matchAll(/"([^"]+)"/g)].map(m=>m[1]),expected,"Master sidebar tabs must never diverge");
const can=(role,permission)=>{
 const match=policy.match(new RegExp('"'+role+'"\\s*:\\s*\\[([^\\]]*)\\]'));
 assert.ok(match,"Missing permission config "+role);
 return match[1].includes('"'+permission+'"');
};
assert.ok(can("Company / Carrier","manageFleet"));
for(const role of ["Customer","Broker","Driver","Company Driver","Employee Driver"]){
  assert.ok(!can(role,"manageFleet"),role+" may not manage fleet");
  assert.ok(!can(role,"manageCompany"),role+" may not administer company");
}
for(const role of ["Company Driver","Employee Driver"]){
  for(const p of ["postLoad","award","invoice","dispatch"]){
    assert.ok(!can(role,p),role+" cannot "+p);
  }
}
const engine=read("app/try-xdrive-demo/components/OperationsDemo.tsx");
assert.ok(engine.includes("MASTER_WORKSPACE_TABS"),"Shell must use canonical shared sidebar");
assert.ok(engine.includes('readOnly={!live||!can("manageFleet")}'),"Fleet mutations must be role gated");
assert.ok(engine.includes('readOnly={!can("invoice")}'),"Invoicing actions must be role gated");
assert.ok(engine.includes('disabled={preview||!can("postLoad")}'),"Post Load must be role gated");
console.log("PASS single master, 17 canonical tabs, 13 master routes, role permission safeguards");
