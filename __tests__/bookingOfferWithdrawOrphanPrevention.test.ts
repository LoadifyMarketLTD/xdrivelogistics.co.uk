import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (p: string) => readFileSync(p, 'utf8');

const mobile = src('app/api/driver/mobile/bids/[id]/route.ts');
const web = src('app/api/driver/web/bids/[id]/route.ts');
const driverClassic = src('app/api/driver/bids/[id]/withdraw/route.ts');
const marketplace = src('app/api/marketplace/company/route.ts');
const customer = src('app/customer/quotes/CustomerQuotesCxPage.tsx');
const broker = src('app/broker/bids/page.tsx');

describe('Booking offers are not orphaned by a carrier quote withdrawal', () => {
  it.each([
    ['mobile', mobile],
    ['web', web],
    ['classic', driverClassic],
  ])('%s route checks pending booking offers before withdrawing quote', (_label, source) => {
    expect(source).toContain(".from('job_booking_offers')");
    expect(source).toContain(".eq('bid_id',");
    expect(source).toMatch(/\.eq\('status',\s*'pending'\)/);
    expect(source).toMatch(/PENDING_BOOKING_OFFER|Pending booking offers could not be verified/);
    expect(source.indexOf(".from('job_booking_offers')")).toBeLessThan(source.indexOf(".update({ status: 'withdrawn'"));
  });

  it('marketplace company quotation withdrawal is protected too', () => {
    expect(marketplace).toContain("if (input.action === 'withdraw_bid')");
    expect(marketplace).toContain(".from('job_booking_offers')");
    expect(marketplace).toContain("code: 'PENDING_BOOKING_OFFER'");
    const block = marketplace.indexOf('if (pendingBookingOffers?.length)');
    const update = marketplace.indexOf(".update({ status: 'withdrawn' })", block);
    expect(block).toBeGreaterThan(0);
    expect(update).toBeGreaterThan(block);
  });

  it('customer Received and Awaiting Acceptance never infer a pending offer from withdrawn bid', () => {
    expect(customer).toContain("const validPendingOffer = pendingOffer?.bid_id === bid.id && String(bid.status).toLowerCase() === 'submitted'");
    expect(customer).toContain("if (statusFilter === 'received') return ['submitted', 'viewed', 'shortlisted'].includes(stage) || validPendingOffer;");
    expect(customer).toContain("if (statusFilter === 'pending') return validPendingOffer;");
    expect(customer).toContain("const isPendingSelectedBid = pendingOffer?.bid_id === bid.id && String(bid.status).toLowerCase() === 'submitted'");
    expect(customer).toContain('const awardLocked = Boolean(pendingOffer)');
  });

  it('broker card does not show Awaiting Carrier Acceptance for withdrawn quotes', () => {
    expect(broker).toContain("const awaitingCarrierAcceptance = pendingBookingOffer?.bid_id === bid.id && String(bid.status).toLowerCase() === 'submitted'");
    expect(broker).toContain('const bookingPendingForJob = Boolean(pendingBookingOffer)');
  });

  it.each([['mobile', mobile], ['web', web]])('%s withdrawal checks allocation after pending offer guard', (_name, code) => {
    expect(code).toContain('relatedJob.awarded_carrier_company_id || relatedJob.assigned_company_id || relatedJob.assigned_driver_id');
    expect(code.indexOf("if (pendingOffers?.length)")).toBeLessThan(code.indexOf("if (relatedJob.awarded_carrier_company_id"));
  });
});
