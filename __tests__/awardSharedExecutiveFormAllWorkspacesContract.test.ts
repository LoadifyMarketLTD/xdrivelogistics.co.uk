import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const customerQuotes = read('app/customer/quotes/CustomerQuotesCxPage.tsx');
const broker = read('app/broker/bids/page.tsx');
const customerJob = read('app/customer/jobs/[id]/page.tsx');
const customerWorkspace = read('app/customer/CustomerWorkspaceModules.tsx');
const companyAdmin = read('app/admin/bids/page.tsx');
const shared = read('app/customer/quotes/BookingConfirmationFullPage.tsx');
const reviewDetails = read('app/customer/quotes/bookingOfferReviewDetails.ts');
const serverCustomer = read('app/api/customer/bids/[id]/award/route.ts');
const serverAdmin = read('app/api/admin/bids/[id]/accept/route.ts');
const requestBody = read('lib/legal/paymentObligationClient.ts');

describe('Executive Booking Confirmation remains canonical across buyer workspaces', () => {
  it('uses one real award form in every customer, broker, and company-admin entry', () => {
    for (const source of [customerQuotes, broker, customerJob, customerWorkspace, companyAdmin]) {
      expect(source).toContain('BookingConfirmationFullPage');
    }
    for (const source of [broker, customerJob, customerWorkspace, companyAdmin]) {
      expect(source).toContain('bookingOfferReviewDetails(');
      expect(source).toContain('onConfirm=');
    }
  });

  it('requires all three explicit acknowledgements before any offer is sent', () => {
    expect(shared).toContain('detailsAccepted && paymentAccepted && availabilityAcknowledged && !working');
    expect(shared).toContain('Carrier Availability &amp; Booking Acceptance');
    expect(shared).toContain('The selected carrier may have submitted quotations for other transport jobs');
    expect(shared).toContain('All three acknowledgements required before sending');
    expect(shared).toContain('disabled={!ready}');
    expect(shared).toContain('Carrier acceptance required');
    for (const source of [broker, customerJob, customerWorkspace, companyAdmin]) {
      expect(source).not.toContain('confirmBookingPaymentObligation()');
    }
  });

  it('rejects the missing carrier-availability acknowledgement at both award endpoints', () => {
    expect(requestBody).toContain('carrierAvailabilityAcknowledged: true');
    for (const source of [serverCustomer, serverAdmin]) {
      expect(source).toContain('body.carrierAvailabilityAcknowledged !== true');
      expect(source).toContain('CARRIER_AVAILABILITY_ACK_REQUIRED');
    }
  });

  it('retains the distinct, server-owned award authorization and canonical pending offer', () => {
    expect(broker).toContain('/api/customer/bids/');
    expect(customerJob).toContain('/api/customer/bids/');
    expect(customerWorkspace).toContain('/api/customer/bids/');
    expect(companyAdmin).toContain('/api/admin/bids/');
    expect(serverCustomer).toContain('award_job_bid_pending_atomic');
    expect(serverAdmin).toContain('award_job_bid_pending_atomic');
    expect(serverCustomer).toContain('role_in_company');
  });

  it('never fabricates identity, payment terms or confirmed compliance facts', () => {
    expect(reviewDetails).toContain('job.payment_terms || null');
    expect(reviewDetails).toContain('Carrier identity unavailable');
    expect(reviewDetails).toContain('job.pallets ?? null');
    expect(shared).toContain('Not verified in this view');
    expect(shared).toContain('Awaiting send');
  });
});