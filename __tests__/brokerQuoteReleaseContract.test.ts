import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const broker = readFileSync(join(process.cwd(), 'app/broker/bids/page.tsx'), 'utf8');
const buyerEndpoint = readFileSync(join(process.cwd(), 'app/api/customer/booking-offers/route.ts'), 'utf8');
const identityEndpoint = readFileSync(join(process.cwd(), 'app/api/workspace/bids/identities/route.ts'), 'utf8');

describe('Broker quote lifecycle on current main baseline', () => {
  it('uses the same scoped bidder identities as Customer and validates company membership', () => {
    expect(broker).toContain("fetch('/api/workspace/bids/identities'");
    expect(identityEndpoint).toContain('getBuyerViewMemberships(');
    expect(broker).not.toContain("fetch('/api/admin/bids/identities'");
  });
  it('loads real buyer booking offers from the shared paginated API', () => {
    expect(broker).toContain("fetchAllBookingOfferPages<BuyerBookingOffer>('/api/customer/booking-offers', token)");
    expect(buyerEndpoint).toContain('getBuyerViewMemberships(');
    expect(broker).toContain("bookingOffers.filter((offer) => offer.status === 'pending')");
  });
  it('displays pending carrier acceptance instead of incorrect Submitted', () => {
    expect(broker).toContain("awaitingCarrierAcceptance ? 'Awaiting Carrier Acceptance' : quoteStageLabel(quoteStage)");
    expect(broker).toContain('Offer sent — awaiting carrier acceptance');
  });
  it('fails closed on missing, pending, or unverified offer data', () => {
    expect(broker).toContain('setBookingOffersLoaded(false)');
    expect(broker).toContain('setBookingOffersLoaded(true)');
    expect(broker).toContain('pendingOfferByJob.has(awardCandidate.job.id)');
    expect(broker).toContain("bid.status === 'submitted' && bookingOffersLoaded && !bookingOfferError && !bookingPendingForJob");
  });
  it('preserves the approved award confirmation contract from current main', () => {
    expect(broker).toContain('bidId: awardCandidate.bid.id');
    expect(broker).toContain('bookingPaymentObligationRequestBody');
  });
});
