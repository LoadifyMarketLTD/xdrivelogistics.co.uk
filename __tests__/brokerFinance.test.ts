import { describe, expect, it } from 'vitest';
import {
  invoiceNetAmount,
  invoiceSignedNetAmount,
  isAwaitingPayment,
  isCarrierPayableInvoice,
  isOverdue,
  isRevenueInvoice,
  sumSignedNetInPeriod,
} from '../lib/brokerFinance';

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

  it('handles VAT, zero values and negative values safely', () => {
    expect(invoiceNetAmount({ amount: 0, vat_amount: 0 })).toBe(0);
    expect(invoiceNetAmount({ amount: 240, vat_amount: 40 })).toBe(200);
    expect(invoiceNetAmount({ amount: -50, vat_amount: 0 })).toBe(-50);
  });

  it('treats credit notes as negative accounting values', () => {
    expect(invoiceSignedNetAmount({ status: 'credit_note_issued', net_amount: 120 })).toBe(-120);
    expect(invoiceSignedNetAmount({ status: 'paid', net_amount: 120 })).toBe(120);
    expect(invoiceSignedNetAmount({ status: 'refund_processed', amount: 60, vat_amount: 10 })).toBe(-50);
  });

  it('supports period attribution by invoice_date for cross-period reporting', () => {
    const start = Date.UTC(2026, 6, 1);
    const end = Date.UTC(2026, 7, 1);
    const total = sumSignedNetInPeriod(
      [
        { status: 'sent', net_amount: 100, invoice_date: '2026-07-03' },
        { status: 'sent', net_amount: 40, invoice_date: '2026-08-03' },
        { status: 'credit_note', net_amount: 25, invoice_date: '2026-07-10' },
      ],
      start,
      end
    );
    expect(total).toBe(75);
  });

  it('excludes own-driver work from subcontract spend via supplier-company guard', () => {
    expect(
      isCarrierPayableInvoice(
        { buyer_company_id: companyId, supplier_company_id: companyId, status: 'approved' },
        companyId
      )
    ).toBe(false);
    expect(
      isCarrierPayableInvoice(
        { buyer_company_id: companyId, supplier_company_id: 'carrier-77', status: 'approved' },
        companyId
      )
    ).toBe(true);
  });
});
