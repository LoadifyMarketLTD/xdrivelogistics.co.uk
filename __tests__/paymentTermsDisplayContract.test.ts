import { describe, expect, it } from 'vitest';
import { formatPaymentTermsLabel } from '../lib/paymentTermsDisplay';

describe('payment terms display labels', () => {
  it('formats canonical XDrive/CX terms consistently', () => {
    expect(formatPaymentTermsLabel('Pay now')).toBe('Pay Now');
    expect(formatPaymentTermsLabel('14 days')).toBe('14 Days (From Invoice)');
    expect(formatPaymentTermsLabel('30 days')).toBe('30 Days (From Invoice)');
    expect(formatPaymentTermsLabel('14 Days (From Invoice)')).toBe('14 Days (From Invoice)');
  });

  it('preserves non-standard commercial terms verbatim', () => {
    expect(formatPaymentTermsLabel('45 Days End Of Month')).toBe('45 Days End Of Month');
    expect(formatPaymentTermsLabel(null)).toBeNull();
  });
});