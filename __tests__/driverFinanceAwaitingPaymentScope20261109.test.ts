import { describe, expect, it } from 'vitest';
import { isAwaitingPaymentInvoiceStatus, summarizeInvoiceValueScopes, type CanonicalInvoiceStatus } from '../lib/invoiceStatus';

describe('driver finance Awaiting Payment ledger scope', () => {
  it('includes every issued open invoice status counted by the finance KPI', () => {
    const statuses: CanonicalInvoiceStatus[] = [
      'Draft', 'Sent', 'Overdue', 'Paid', 'Disputed', 'Cancelled',
    ];
    expect(statuses.filter(isAwaitingPaymentInvoiceStatus)).toEqual([
      'Sent', 'Overdue', 'Disputed',
    ]);
  });

  it('separates issued debt from draft balances without altering payment history', () => {
    const totals = summarizeInvoiceValueScopes([
      { status: 'Draft', amount: 840, net_amount: 840, paid_amount: 50, outstanding_amount: 790 },
      { status: 'Sent', amount: 66, net_amount: 66, paid_amount: 0, outstanding_amount: 66 },
      { status: 'Overdue', amount: 32, net_amount: 32, paid_amount: 0, outstanding_amount: 32 },
    ]);
    expect(totals.gross).toBe(938);
    expect(totals.paid).toBe(50);
    expect(totals.outstanding).toBe(888);
    expect(totals.issuedGross).toBe(98);
    expect(totals.issuedOutstanding).toBe(98);
  });

  it('never treats drafts, fully paid or cancelled invoices as payable debt', () => {
    expect(isAwaitingPaymentInvoiceStatus('Draft')).toBe(false);
    expect(isAwaitingPaymentInvoiceStatus('Paid')).toBe(false);
    expect(isAwaitingPaymentInvoiceStatus('Cancelled')).toBe(false);
  });
});
