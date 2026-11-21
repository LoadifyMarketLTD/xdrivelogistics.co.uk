import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const ui = readFileSync(new URL('../driver-pwa-reserve/src/LiveInvoiceFlow.tsx', import.meta.url),'utf8');
const shell=readFileSync(new URL('../driver-pwa-reserve/src/ReserveApp.tsx', import.meta.url),'utf8');
describe('issued invoice loading safety',()=>{
 it('never renders Create Invoice while the finance record is loading',()=>{
  expect(ui).toContain('if (loading || !eligibilityChecked) return');
  expect(ui).toContain('<h1>Checking Invoice…</h1>');
  expect(ui).toContain('Creation is unavailable until this check completes.');
 });
 it('shows a retry instead of creation after finance lookup failure',()=>{
  expect(ui).toContain('if (error && !invoice) return');
  expect(ui).toContain('Invoice status unavailable');
  expect(ui).toContain('Retry Finance Check');
 });
 it('invalidates cached Create actions after entering a real invoice',()=>{
  expect(shell).toContain("if(view==='invoiceJob'){setFinanceHistory({});setFinanceHistoryLoaded(false);}");
  expect(shell).toContain("if(state?.invoiceExists)return {label:'View Invoice',target:'invoiceJob'};");
  expect(shell).toContain("if(role==='Owner Driver'&&!financeHistoryLoaded)return {label:'Checking Invoice…',target:'invoiceJob'};");
 });
 it('preserves server authority and disables sent invoice draft editing',()=>{
  expect(ui).toContain("const canEdit=draft&&invoice?.delivery_state!=='sending'&&!sent");
 });
});
