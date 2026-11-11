import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const src=(f:string)=>readFileSync(f,'utf8');
describe('Customer Loads uses exact approved original 3150 page',()=>{
 it('replaces independent operational page with original approved component',()=>{
  const route=src('app/customer/loads/page.tsx');
  expect(route).toContain("import DemoExchangeBoard from '../../try-xdrive-demo/components/DemoExchangeBoard'");
  expect(route).toContain('<DemoExchangeBoard role="Customer" productionMode />');
  expect(route).not.toContain('CustomerLoadsOperationalPage');
 });
 it('wraps original in authenticated RLS-scoped real data provider',()=>{
  const route=src('app/customer/loads/page.tsx');
  expect(route).toContain('<Company3150LiveProvider publicLocations>');
  const provider=src('app/try-xdrive-demo/components/Company3150LiveData.tsx');
  expect(provider).toContain('useCompanyWorkspaceData()');
  expect(provider).toContain('const loads = data.jobs.map');
 });
 it('uses original 3150 load card, filters, and original Transport Details modal',()=>{
  const original=src('app/try-xdrive-demo/components/DemoExchangeBoard.tsx');
  for(const c of ['XDriveLoadCard','DemoTransportDetails','All Loads','On Demand','Same Day','Next Day','My Loads','Find Loads','Payment Terms'])expect(original).toContain(c);
  expect(src('app/components/workspace/canonical3150-customer-load-details.css')).toContain('.master3150-production .xd-detail-dialog');
 });
 it('customer cannot access quote action or demo submission',()=>{
  const original=src('app/try-xdrive-demo/components/DemoExchangeBoard.tsx');
  expect(original).toContain('const canQuote=');
  expect(original).toContain('const actual=tab==="My Loads"||!canQuote?live:exchange.loads');
  expect(original).toContain('canQuote&&tab!=="My Loads"');
 });
});