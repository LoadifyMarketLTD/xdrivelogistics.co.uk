import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const customerQuotes = fs.readFileSync(path.join(root, 'app/customer/quotes/CustomerQuotesCxPage.tsx'), 'utf8');
const customerOffers = fs.readFileSync(path.join(root, 'app/api/customer/booking-offers/route.ts'), 'utf8');
const awardRoute = fs.readFileSync(path.join(root, 'app/api/customer/bids/[id]/award/route.ts'), 'utf8');
const carrierOffers = fs.readFileSync(path.join(root, 'app/api/booking-offers/route.ts'), 'utf8');
const carrierInbox = fs.readFileSync(path.join(root, 'app/components/workspace/PendingBookingOffers.tsx'), 'utf8');

describe('customer pending carrier acceptance parity', () => {
  it('projects server-authoritative pending booking offers into Customer Quotes', () => {
    expect(customerOffers).toContain(".from('job_booking_offers')");
    expect(customerOffers).toContain(".in('buyer_company_id', companyIds)");
    expect(customerQuotes).toContain("fetch('/api/customer/booking-offers'");
    expect(customerQuotes).toContain("statusFilter === 'pending_acceptance'");
    expect(customerQuotes).toContain('Awaiting Carrier Acceptance');
    expect(customerQuotes).toContain('Offer sent · awaiting carrier');
  });

  it('never presents buyer award as an already-formed transport agreement', () => {
    expect(customerQuotes).toContain('Send Booking Offer');
    expect(customerQuotes).toContain('No transport agreement is formed until the carrier accepts.');
    expect(customerQuotes).not.toContain('Selecting Confirm Award records this acknowledgement');
  });

  it('prevents duplicate award attempts while a carrier response is pending', () => {
    expect(customerQuotes).toContain('const awardLocked = Boolean(pendingOffer)');
    expect(customerQuotes).toContain("bid.status === 'submitted' && !awardLocked");
    expect(awardRoute).toContain(".from('job_booking_offers')");
    expect(awardRoute).toContain(".eq('status', 'pending')");
    expect(awardRoute).toContain('alreadyPending: true');
    expect(awardRoute).toContain("code: 'BOOKING_OFFER_ALREADY_PENDING'");
  });

  it('matches the carrier-side contract used by desktop/mobile-capable driver surfaces', () => {
    expect(carrierOffers).toContain(".from('job_booking_offers')");
    expect(carrierInbox).toContain('Booking offers awaiting your acceptance');
    expect(carrierInbox).toContain('A buyer award is not a confirmed transport booking until you accept');
    expect(carrierInbox).toContain("action:'accept'|'decline'");
  });
});
