import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOKING_DECLINE_REASONS, bookingDeclineReasonText } from '../lib/bookingOfferDeclineReasons';
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const carrier = read('app/components/workspace/PendingBookingOffers.tsx');
const respond = read('app/api/booking-offers/[id]/respond/route.ts');
const company = read('app/api/marketplace/company/route.ts');
const owner = read('app/api/driver/bids/[id]/withdraw/route.ts');
const buyer = read('app/customer/quotes/CustomerQuotesCxPage.tsx');
const broker = read('app/broker/bids/page.tsx');
const exchange = read('app/components/workspace/CompanyMarketplaceExchange.tsx');

describe('Commercial withdrawal and carrier booking refusal', () => {
  it('offers standard, readable booking refusal reasons with an optional explanation', () => {
    expect(Object.keys(BOOKING_DECLINE_REASONS)).toHaveLength(5);
    expect(bookingDeclineReasonText('already_committed')).toBe('Already committed to another job');
    expect(bookingDeclineReasonText('schedule_conflict', '  Delayed at previous delivery  ')).toBe('Collection or delivery time conflict — Delayed at previous delivery');
    expect(carrier).toContain('Decline Booking Offer');
    expect(carrier).toContain('Confirm Decline');
    expect(carrier).toContain('reasonCode:declineReason');
  });
  it('validates booking decline reasons server-side before recording an auditable decline', () => {
    expect(respond).toContain("z.discriminatedUnion('action'");
    expect(respond).toContain('reasonCode: reasonCodeSchema');
    expect(respond).toContain("reasonCode==='other'");
    expect(respond).toContain("'decline_job_booking_offer_atomic'");
    expect(respond).toContain('reasonCode: reasonCodeSchema.optional()');
    expect(respond).toContain('legacy client; reason not supplied');
    expect(carrier).toContain("useState<BookingDeclineReasonCode | ''>('')");
    expect(respond).toContain('p_reason: parsed.data.reasonCode ? bookingDeclineReasonText');
  });
  it('prevents company quote withdrawal when a booking offer is pending or a job is allocated', () => {
    expect(company).toContain(".eq('bid_id', input.bidId)");
    expect(company).toContain(".eq('status', 'pending')");
    expect(company).toContain('job.awarded_carrier_company_id || job.assigned_company_id || job.assigned_driver_id');
    expect(company).toContain('if (!updated) return respond(409');
    expect(owner).toContain('PENDING_BOOKING_OFFER');
  });
  it('keeps Withdrawn in quote history and not in the Unsuccessful tab', () => {
    for (const source of [buyer, broker, exchange]) {
      expect(source).toContain("'withdrawn'].includes(stage)");
      expect(source).toContain("['unsuccessful', 'expired'].includes(stage)");
    }
  });
});
