import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('pending booking offer quote detail navigation', () => {
  const source = readFileSync('app/driver/quotes/page.tsx', 'utf8');
  it('routes pending booking offer details to the authorised booking offer review, not pre-award load detail', () => {
    expect(source).toContain("if (pendingBookingOffer) router.push('/driver/won-work');");
    expect(source).toContain("{pendingBookingOffer ? 'Review Booking Offer' : fullDetailsRestricted");
    expect(source.indexOf("if (pendingBookingOffer) router.push('/driver/won-work');")).toBeLessThan(source.indexOf('else if (fullDetailsRestricted) setExpandedIds'));
  });
  it('retains the protected quote summary for non-offer records', () => {
    expect(source).toContain("else if (fullDetailsRestricted) setExpandedIds");
    expect(source).toContain('`/driver/loads/${bid.job_id}`');
  });
});
