import { describe, expect, it } from 'vitest';
import { calculateNetInvoicePaid } from '../app/api/driver/finance/_lib/netInvoicePayments';

describe('FIN-01 Stripe net invoice settlement', () => {
  const attempts = [{ id: 'attempt-1', amount_minor: 10000 }];
  it('preserves gross payments when there are no reversals', () => {
    expect(calculateNetInvoicePaid(100, attempts, [], [])).toBe(100);
  });
  it('subtracts partial and full refunds', () => {
    expect(calculateNetInvoicePaid(100, attempts, [{ attempt_id: 'attempt-1', amount_minor: 2500 }], [])).toBe(75);
    expect(calculateNetInvoicePaid(100, attempts, [{ attempt_id: 'attempt-1', amount_minor: 10000 }], [])).toBe(0);
  });
  it('subtracts lost disputes but not won or pending disputes', () => {
    expect(calculateNetInvoicePaid(100, attempts, [], [{ attempt_id: 'attempt-1', amount_minor: 4000, status: 'lost' }])).toBe(60);
    expect(calculateNetInvoicePaid(100, attempts, [], [{ attempt_id: 'attempt-1', amount_minor: 4000, status: 'won' }])).toBe(100);
  });
  it('caps combined reversals per attempt, not across unrelated payments', () => {
    expect(calculateNetInvoicePaid(120, attempts, [{ attempt_id: 'attempt-1', amount_minor: 7000 }], [{ attempt_id: 'attempt-1', amount_minor: 6000, status: 'lost' }])).toBe(20);
  });
});
