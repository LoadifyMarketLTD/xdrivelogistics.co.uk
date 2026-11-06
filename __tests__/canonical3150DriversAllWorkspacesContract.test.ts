import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(file:string)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

describe('approved 3150 Drivers across authenticated workspaces',()=>{
 it('uses the actual approved demo Drivers board as the shared production surface',()=>{
  const shared=read('app/components/workspace/MemberFleetOverview.tsx');
  expect(shared).toContain("import DemoDriversBoard from '../../try-xdrive-demo/components/DemoDriversBoard'");
  expect(shared).toContain('<DemoDriversBoard verifiedDrivers=');
  for(const p of ['app/admin/drivers/page.tsx','app/customer/drivers/page.tsx','app/broker/drivers/page.tsx','app/driver/drivers/page.tsx']){
   expect(read(p),p).toContain('MemberFleetOverview');
   expect(read(p),p).toContain('section="drivers"');
  }
 });
 it('does not render fictive profile fields, localStorage or demo writes in authenticated driver dossier',()=>{
  const board=read('app/try-xdrive-demo/components/DemoDriversBoard.tsx');
  const dossier=read('app/try-xdrive-demo/components/VerifiedDriverProfile.tsx');
  expect(board).toContain('verifiedDrivers.drivers.map');
  expect(board).toContain('<VerifiedDriverProfile');
  expect(dossier).not.toContain('localStorage.');
  expect(dossier).not.toContain('Demo only');
  for(const tab of ['Identity & Contacts','Employment & RTW','Licences & Qualifications','Documents','Vehicles','Availability & Shifts','Bookings & POD','Performance & Incidents','Compliance & Expiry','Audit History']){
   expect(dossier).toContain(tab);
  }
 });
 it('server limits driver documents to active company and authorised members',()=>{
  const api=read('app/api/workspace/fleet-overview/route.ts');
  expect(api).toContain(".eq('company_id',companyId)");
  expect(api).toContain('canReadDocuments');
  expect(api).toContain(".from('driver_documents')");
  expect(api).toContain(".in('driver_id', driverIds)");
  expect(api).toContain('documentsRestricted');
 });
});
