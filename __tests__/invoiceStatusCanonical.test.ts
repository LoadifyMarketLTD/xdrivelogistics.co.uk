import { describe, expect, it } from 'vitest';
import {
  buildInvoiceStatusSummary,
  toCanonicalInvoiceDisplayStatus,
  toCanonicalInvoiceStatus,
  toCanonicalInvoiceStatusWithDueDate,
} from '../lib/invoiceStatus';

describe('canonical invoice status aliases', () => {
  it('maps hosted void status to terminal Cancelled', () => {
    expect(toCanonicalInvoiceStatus('void')).toBe('Cancelled');
    expect(toCanonicalInvoiceStatusWithDueDate('void', '2000-01-01')).toBe('Cancelled');
    expect(toCanonicalInvoiceDisplayStatus('void', '2000-01-01', 'unpaid')).toBe('Cancelled');
  });

  it('never reports a void invoice as Draft in summaries', () => {
    expect(buildInvoiceStatusSummary(['void', 'Pending', 'paid'])).toMatchObject({
      total: 3,
      cancelled: 1,
      draft: 1,
      paid: 1,
    });
  });
});
