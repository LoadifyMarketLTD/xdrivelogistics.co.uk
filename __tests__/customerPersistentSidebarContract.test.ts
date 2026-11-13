import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('Customer persistent Master sidebar',()=>{
 it('hosts all customer routes, including Dashboard, in one layout instance',()=>{
  const gate=read('app/customer/CustomerMasterLayoutGate.tsx');
  expect(gate).toContain('role="Customer"');
  expect(gate).toContain('customerMasterTab(pathname)');
  expect(gate).not.toContain("if(pathname==='/customer')");
 });
 it('does not nest a second MasterWorkspace inside the Dashboard',()=>{
  const dashboard=read('app/customer/page.tsx');
  expect(dashboard).toContain('<Company3150LiveProvider>');
  expect(dashboard).toContain('<CompanyMasterDashboard role="Customer"/>');
  expect(dashboard).not.toContain('<MasterWorkspace');
 });
});
