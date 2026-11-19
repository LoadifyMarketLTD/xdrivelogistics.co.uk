import {describe,it,expect} from 'vitest';
import {isDashboardInvoiceAwaiting,dashboardInvoiceValue} from '../app/components/workspace/FinanceControlDashboardHome';
import type {WorkspaceInvoice} from '../app/components/workspace/useCompanyWorkspaceData';
const row=(overrides:Partial<WorkspaceInvoice>={}):WorkspaceInvoice=>({id:'test',created_at:'2026-11-19T00:00:00Z',status:'sent',currency:'GBP',amount:100,...overrides});
describe('Master finance display avoids false outstanding totals',()=>{
 it('includes only issued unsettled invoice values',()=>{
  for(const status of ['draft','Draft','Pending','cancelled','void','Paid'])expect(isDashboardInvoiceAwaiting(row({status}))).toBe(false);
  for(const payment_status of ['paid','refunded'])expect(isDashboardInvoiceAwaiting(row({payment_status}))).toBe(false);
  expect(isDashboardInvoiceAwaiting(row({document_type:'credit_note'}))).toBe(false);
  expect(isDashboardInvoiceAwaiting(row())).toBe(true);
  expect(isDashboardInvoiceAwaiting(row({status:'overdue'}))).toBe(true);
 });
 it('does not invent consolidated GBP values or partial balances',()=>{
  expect(dashboardInvoiceValue([row()],true)).toBe('£100.00');
  expect(dashboardInvoiceValue([row({currency:'EUR'})],true)).toBe('See register');
  expect(dashboardInvoiceValue([row({currency:null})],true)).toBe('See register');
  expect(dashboardInvoiceValue([row({amount:null})],true)).toBe('See register');
  expect(dashboardInvoiceValue([row({payment_status:'partially_paid'})],true)).toBe('See register');
 });
});
