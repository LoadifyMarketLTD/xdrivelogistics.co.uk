import fs from 'node:fs';import path from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('Owner Driver Reports use genuine company finance records',()=>{
 it('uses authorised invoice API only for Driver reports while keeping other roles unchanged',()=>{
  expect(read('app/driver/reports/page.tsx')).toContain('includeDriverFinance');
  expect(read('app/admin/reports/page.tsx')).not.toContain('includeDriverFinance');
  const source=read('app/components/workspace/MemberOperationalReports.tsx');
  expect(source).toContain("readRouteAuthAccessToken()");
  expect(source).toContain("'/api/driver/finance/invoices?view=receivables&limit=500'");
  expect(source).toContain('body.rows.length===body.invoiceSummary?.total');
  expect(source).toContain('includeDriverFinance ? driverFinance!==null && !driverFinancePartial');
 });
 it('does not fabricate invoice values or expose unauthorised company data',()=>{
  const component=read('app/components/workspace/MemberOperationalReports.tsx');
  expect(component).toContain("data.invoices.filter");
  expect(component).toContain("invoicesVerified && invoiceCurrencySet.size===1");
  expect(component).toContain("if(amount===null)return 'Unavailable'");
  const api=read('app/api/driver/finance/invoices/route.ts');
  expect(api).toContain('if (!driver.canManageFinance)');
  expect(api).toContain(".eq('company_id', driver.companyId)");
 });
});
