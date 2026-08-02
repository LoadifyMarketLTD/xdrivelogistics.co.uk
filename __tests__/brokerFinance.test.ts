import { describe, expect, it } from 'vitest';
import { invoiceNetAmount, isAwaitingPayment, isCarrierPayableInvoice, isOverdue, isRevenueInvoice } from '../lib/brokerFinance';

describe('broker finance semantics', () => {
  const companyId = 'company-a';

  it('treats issued non-draft invoices as revenue only for owning company', () => {
    expect(isRevenueInvoice({ company_id: companyId, status: 'Sent' }, companyId)).toBe(true);
    expect(isRevenueInvoice({ company_id: companyId, status: 'draft' }, companyId)).toBe(false);
    expect(isRevenueInvoice({ company_id: 'other', status: 'Sent' }, companyId)).toBe(false);
  });

  it('treats supplier invoices as payables and excludes own-company rows', () => {
    expect(
      isCarrierPayableInvoice(
        { buyer_company_id: companyId, supplier_company_id: 'carrier-1', status: 'Approved' },
        companyId
      )
    ).toBe(true);
    expect(
      isCarrierPayableInvoice(
        { buyer_company_id: companyId, supplier_company_id: companyId, status: 'Approved' },
        companyId
      )
    ).toBe(false);
  });

  it('uses net amount when available and falls back safely', () => {
    expect(invoiceNetAmount({ net_amount: 100, amount: 120, vat_amount: 20 })).toBe(100);
    expect(invoiceNetAmount({ amount: 120, vat_amount: 20 })).toBe(100);
    expect(invoiceNetAmount({ amount: 120 })).toBe(120);
  });

  it('derives awaiting and overdue payment states from canonical fields', () => {
    const now = Date.UTC(2026, 7, 2);
    expect(isAwaitingPayment({ status: 'Sent', payment_status: 'unpaid', due_date: '2026-08-10' }, now)).toBe(true);
    expect(isOverdue({ status: 'Sent', payment_status: 'unpaid', due_date: '2026-07-10' }, now)).toBe(true);
    expect(isAwaitingPayment({ status: 'Paid', payment_status: 'paid', due_date: '2026-07-10' }, now)).toBe(false);
  });
});
