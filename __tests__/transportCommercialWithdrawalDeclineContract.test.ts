import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOKING_DECLINE_REASONS, bookingDeclineReasonText } from '../lib/bookingOfferDeclineReasons';
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const carrier = read('app/components/workspace/PendingBookingOffers.tsx');
const respond = read('app/api/booking-offers/[id]/respond/route.ts');
const company = read('app/api/marketplace/company/route.ts');
const owner = read('app/api/driver/bids/[id]/withdraw/route.ts');
const webBid = read('app/api/driver/web/bids/[id]/route.ts');
const mobileBid = read('app/api/driver/mobile/bids/[id]/route.ts');
const atomicGuard = read('supabase/migrations/20261124033132_guard_quote_withdrawal_after_booking_offer.sql');
const bookingInsertGuard = read('supabase/migrations/20261124040846_guard_pending_booking_offer_quote_state.sql');
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
    expect(company).toContain('job.awarded_carrier_company_id === input.companyId || job.assigned_company_id === input.companyId');
    expect(owner).toContain('job.assigned_driver_id === driver.driverId');
    expect(company).toContain('if (!updated) return respond(409');
    expect(owner).toContain('PENDING_BOOKING_OFFER');
  });
  it('blocks award-vs-withdraw race at the database row update boundary', () => {
    expect(atomicGuard).toContain('BEFORE UPDATE OF status ON public.job_bids');
    expect(atomicGuard).toContain("NEW.status = 'withdrawn'");
    expect(atomicGuard).toContain("o.bid_id = OLD.id AND o.status = 'pending'");
    expect(atomicGuard).toContain('a.bid_id = OLD.id');
    expect(atomicGuard).toContain("ERRCODE = '23514'");
    expect(company).toContain("updateError?.code === '23514'");
    expect(owner).toContain("updateError?.code === '23514'");
  });
  it('keeps Company Driver excluded from personal quote withdrawal despite any legacy bid flag', () => {
    expect(owner).toContain("driver.driverType !== 'owner_driver' || !driver.canCommercialBid");
    expect(owner).toContain('Only an authorised Owner Driver');
  });
  it('also locks the bid on direct privileged pending booking-offer insert', () => {
    expect(bookingInsertGuard).toContain('BEFORE INSERT ON public.job_booking_offers');
    expect(bookingInsertGuard).toContain('FOR UPDATE');
    expect(bookingInsertGuard).toContain("v_quote_status IS DISTINCT FROM 'submitted'");
    expect(bookingInsertGuard).toContain("ERRCODE = '23514'");
  });
  it('secures both legacy web and mobile withdrawal endpoints against Company Driver and award races', () => {
    for (const source of [webBid, mobileBid]) {
      expect(source).toContain("driver.driverType !== 'owner_driver' || !driver.canCommercialBid");
      expect(source).toContain("withdrawError?.code === '23514'");
      expect(source).toContain(".eq('status', 'submitted')");
    }
  });
  it('refuses Company Driver commercial booking responses even with a legacy bidding flag', () => {
    expect(respond).toContain(".select('driver_type')");
    expect(respond).toContain("actorDriver?.driver_type === 'company_driver'");
    expect(respond).toContain('Company Drivers cannot accept or decline commercial booking offers.');
  });
  it('keeps Withdrawn in quote history and not in the Unsuccessful tab', () => {
    for (const source of [buyer, broker, exchange]) {
      expect(source).toContain("'withdrawn'].includes(stage)");
      expect(source).toContain("['unsuccessful', 'expired'].includes(stage)");
    }
  });
});
