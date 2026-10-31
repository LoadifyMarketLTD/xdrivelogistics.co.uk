import fs from 'node:fs';
import path from 'node:path';
import {describe,expect,it} from 'vitest';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
const root='app/driver-pwa-fresh/bookings/[id]/workflow/';
describe('Driver storyboard invoice issued and tracking',()=>{
 it('renders page 10 only for a persisted invoice and actual issued status',()=>{
  const s=read('app/components/workspace/DriverJobExecutionPage.tsx');
  expect(s).toContain('approvedScreen.number===10 && sheet?.invoices[0]?.id');
  expect(s).toContain('<InvoiceIssuedStep');
  expect(s).toContain('invoice.amount!=null?money(invoice.amount,invoice.currency):null');
 });
 it('renders page 11 only for a persisted invoice and real payment state',()=>{
  const s=read('app/components/workspace/DriverJobExecutionPage.tsx');
  expect(s).toContain('approvedScreen.number===11 && sheet?.invoices[0]?.id');
  expect(s).toContain('<InvoicePaymentTrackingStep');
  expect(s).toContain('paymentStatus={invoice.paymentStatus}');
 });
 it('does not directly send an invoice or mark a payment successful',()=>{
  const issued=read(root+'InvoiceIssuedStep.tsx');
  const tracking=read(root+'InvoicePaymentTrackingStep.tsx');
  expect(issued).toContain('onReviewAndSend');
  expect(tracking).toContain('No payment is simulated.');
  expect(tracking).toContain('onViewInvoice');
  expect(issued).not.toContain('fetch(');
  expect(tracking).not.toContain('fetch(');
 });
 it('has individual inspectable preview routes',()=>{
  expect(read('app/driver-pwa-fresh/visual-preview/workflow/page-10/page.tsx')).toContain('InvoiceIssuedStep');
  expect(read('app/driver-pwa-fresh/visual-preview/workflow/page-11/page.tsx')).toContain('InvoicePaymentTrackingStep');
 });
});
