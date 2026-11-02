import { describe, expect, it } from 'vitest';
import { calculateConsolidatedInvoice } from '../lib/consolidatedInvoice';
const first = { ref: 'JOB-101', pickup: 'Blackburn', delivery: 'Erith', amount: 70 };
const second = { ref: 'JOB-102', pickup: 'Erith', delivery: 'Leeds', amount: 80 };
describe('3118 consolidated invoice calculations from Invoice Pro', () => {
  it('sums jobs and VAT 20% in integer pence', () => {
    const result = calculateConsolidatedInvoice([first, second]);
    expect(result.netAmount).toBe(150);
    expect(result.vatAmount).toBe(30);
    expect(result.totalAmount).toBe(180);
    expect(result.lines).toHaveLength(2);
  });
  it('supports non-VAT-registered invoices', () => {
    const result = calculateConsolidatedInvoice([first], 'not_registered');
    expect(result.totalAmount).toBe(70);
    expect(result.vatAmount).toBe(0);
  });
  it('rejects duplicated job references', () => {
    expect(() => calculateConsolidatedInvoice([first, { ...second, ref: 'job-101' }])).toThrow(/Duplicate/);
  });
  it('rejects missing route, invalid amounts and empty invoices', () => {
    expect(() => calculateConsolidatedInvoice([])).toThrow();
    expect(() => calculateConsolidatedInvoice([{ ...first, pickup: '' }])).toThrow();
    expect(() => calculateConsolidatedInvoice([{ ...first, amount: -1 }])).toThrow();
  });
});
