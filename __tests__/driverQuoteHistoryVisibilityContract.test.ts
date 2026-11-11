import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
describe('canonical Driver quote history visibility', () => {
  it('retains real quote identifiers and lifecycle statuses', () => {
    const page = read('app/driver/quotes/page.tsx');
    expect(page).toContain('bid.id');
    expect(page).toContain('canonicalQuoteStage');
    expect(page).toContain('isTerminalQuoteStage');
  });
  it('verifies live booking offer status for submitted quotes', () => {
    const page = read('app/driver/quotes/page.tsx');
    expect(page).toContain('fetchAllBookingOfferPages');
    expect(page).toContain("'/api/booking-offers'");
  });
});
