import fs from 'node:fs';import path from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('Owner Driver dashboard 3150 real performance and fleet truth',()=>{
 it('preserves approved original component and displays verified vehicle availability when API supplies it',()=>{
  const dashboard=read('app/try-xdrive-demo/components/DemoCompanyDashboard.tsx');
  const owner=read('app/driver/_components/OwnerDriver3150LiveDashboard.tsx');
  expect(owner).toContain("fetch(`/api/workspace/fleet-overview?companyId=");
  expect(owner).toContain('is_available?: boolean | null');
  expect(dashboard).toContain('verifiedFleet.vehicles.filter(v=>v.is_available===true).length');
  expect(dashboard).toContain('Availability not verified');
  expect(dashboard).toContain('real?{background:\'conic-gradient(#b9c6d4 0 100%)\'}');
 });
 it('keeps Owner Driver dashboard ETA and visual status consistent with job lifecycle',()=>{
  const dashboard=read('app/try-xdrive-demo/components/DemoCompanyDashboard.tsx');
  expect(dashboard).toContain('j.status==="Completed"?"Delivered"');
  expect(dashboard).toContain('status:j.status==="Completed"?"Completed"');
  expect(dashboard).toContain('j.status==="In Progress"?"In transit"');
  expect(dashboard).toContain('j.status==="In Progress"?"intransit"');
  expect(dashboard).not.toContain('i===0?"intransit"');
 });
 it('humanises recent operational status tokens without altering stored events',()=>{
  const dashboard=read('app/try-xdrive-demo/components/DemoCompanyDashboard.tsx');
  expect(dashboard).toContain("replaceAll('_',' ')");
  expect(dashboard).toContain("String(j.current_status||j.status||'Unknown')");
 });
});
