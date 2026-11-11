import fs from 'node:fs';import path from 'node:path';
import {describe,expect,it} from 'vitest';
const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
describe('Finance payment reconciliation presentation',()=>{
 it('distinguishes paid amount from the number of fully settled invoices',()=>{
  const page=read('app/driver/finance/page.tsx');
  expect(page).toContain('Payments recorded');
  expect(page).toContain('fully paid invoices · partial payments included');
  expect(page).toContain('Includes partial settlements');
  expect(page).toContain('money(values?.paid ?? 0)');
  const api=read('app/api/driver/finance/invoices/route.ts');
  expect(api).toContain("from('invoice_payment_history')");
  expect(api).toContain('paid_amount: paidAmount');
  expect(api).toContain('outstanding_amount: Math.max(0, grossAmount - paidAmount)');
 });
 it('separates label/description/arrow in the action centre',()=>{
  const css=read('app/components/workspace/InvoiceProFinance.module.css');
  expect(css).toContain('.actionButton>span:nth-child(2){display:flex;flex-direction:column');
  expect(css).toContain('.actionButton .actionLabel,.actionButton .actionSub{display:block;');
 });
});
