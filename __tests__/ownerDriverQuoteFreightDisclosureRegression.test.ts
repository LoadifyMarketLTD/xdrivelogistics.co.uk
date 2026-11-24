import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const quotes = readFileSync(join(process.cwd(), 'app/driver/quotes/page.tsx'), 'utf8');
const loads = readFileSync(join(process.cwd(), 'app/driver/loads/page.tsx'), 'utf8');
const api = readFileSync(join(process.cwd(), 'app/api/driver/marketplace/loads/route.ts'), 'utf8');

describe('Owner Driver Quotes CX disclosure and fail-closed controls', () => {
  it('displays only quote-safe freight and payment fields already emitted by the authorized API', () => {
    for (const field of ['weight_kg', 'pallets', 'packaging', 'length_cm', 'width_cm', 'height_cm', 'payment_terms', 'public_quote_notes']) {
      expect(api).toContain(`${field}:`);
      expect(quotes).toContain(field);
    }
    for (const label of ['Weight:', 'Packaging:', 'Dimensions:', 'Payment terms:', 'Load Notes:']) expect(quotes).toContain(label);
  });
  it('does not reveal restricted job details when the quote-history API provides none', () => {
    expect(quotes).toContain("access: 'protected'");
    expect(quotes).toContain('view.freightDetails &&');
    expect(quotes).toContain('view.freightDetails?.publicNotes');
    expect(quotes).toContain("'Not Supplied'");
  });
  it('prevents optimistic withdrawal and suppresses cancellation for sold work', () => {
    expect(loads).toContain('canWithdraw:false');
    expect(quotes).toContain('!pendingBookingOffer && !sold');
    expect(quotes).toContain('Cancel Quote');
  });
});
