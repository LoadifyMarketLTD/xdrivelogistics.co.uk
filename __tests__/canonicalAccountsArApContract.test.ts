import { describe, expect, it } from 'vitest';
import { classifyAccountsDirection, invoiceAgingBucket } from '../lib/finance/accounts';

describe('canonical AR/AP accounts helpers', () => {
  it('classifies supplier-owned invoices as receivables and buyer-owned invoices as payables', () => {
    const invoice = { company_id: 'supplier', supplier_company_id: 'supplier', buyer_company_id: 'buyer' };
    expect(classifyAccountsDirection(invoice, 'supplier')).toBe('receivable');
    expect(classifyAccountsDirection(invoice, 'buyer')).toBe('payable');
    expect(classifyAccountsDirection(invoice, 'other')).toBeNull();
  });

  it('preserves legacy issuer ownership when supplier_company_id is absent', () => {
    expect(classifyAccountsDirection({ company_id: 'issuer', buyer_company_id: 'buyer' }, 'issuer')).toBe('receivable');
  });

  it('uses canonical aging buckets from due date and outstanding balance', () => {
    const now = Date.parse('2026-10-09T12:00:00Z');
    expect(invoiceAgingBucket('2026-10-10', 100, now)).toBe('current');
    expect(invoiceAgingBucket('2026-10-01', 100, now)).toBe('1_30');
    expect(invoiceAgingBucket('2026-08-20', 100, now)).toBe('31_60');
    expect(invoiceAgingBucket('2026-07-20', 100, now)).toBe('61_90');
    expect(invoiceAgingBucket('2026-06-01', 100, now)).toBe('90_plus');
    expect(invoiceAgingBucket(null, 100, now)).toBe('no_due_date');
    expect(invoiceAgingBucket('2026-01-01', 0, now)).toBe('current');
  });
});
