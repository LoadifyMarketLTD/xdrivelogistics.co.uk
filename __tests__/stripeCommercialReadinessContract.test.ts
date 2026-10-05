import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('canonical Stripe commercial readiness contract', () => {
  const readiness = read('app/api/_lib/stripeCommercialReadiness.ts');
  const createJob = read('app/api/jobs/create/route.ts');
  const driverQuote = read('app/api/driver/_lib/submitQuote.ts');
  const companyMarketplace = read('app/api/marketplace/company/route.ts');
  const award = read('app/api/customer/bids/[id]/award/route.ts');

  it('keeps Stripe commercial readiness behind the future-phase feature flag', () => {
    expect(readiness).toContain("getFeatureFlag(supabaseAdmin, 'stripe_billing_future_phase')");
    expect(readiness).toContain("onboardingStatus: 'not_required'");
    expect(readiness).toContain('required: false');
    expect(readiness).toContain("from('stripe_connected_accounts')");
    expect(readiness).toContain("details_submitted");
    expect(readiness).toContain("charges_enabled");
    expect(readiness).toContain("payouts_enabled");
    expect(readiness).toContain('detailsSubmitted && chargesEnabled && payoutsEnabled');
    expect(readiness).toContain('STRIPE_COMMERCIAL_READINESS_REQUIRED');
  });

  it('gates Post Load publication and Direct Booking on Stripe readiness', () => {
    expect(createJob).toContain('getStripeCommercialReadiness');
    expect(createJob).toContain('stripeCommercialReadinessPayload');
    expect(createJob).toContain('before publishing transport work');
    expect(createJob).toContain('before it can receive a Direct Booking');
  });

  it('requires carrier readiness on both driver and company quote paths', () => {
    expect(driverQuote).toContain('getStripeCommercialReadiness(supabaseAdmin, driver.companyId)');
    expect(driverQuote).toContain("denialReasons: ['stripe_commercial_readiness_required']");
    expect(companyMarketplace).toContain('getStripeCommercialReadiness(supabaseAdmin, input.companyId)');
    expect(companyMarketplace).toContain('before quoting for transport work');
  });

  it('rechecks both contracting parties immediately before award', () => {
    expect(award).toContain(".select('id, job_id, status, company_id, bid_price_gbp, amount')");
    expect(award).toContain('getStripeCommercialReadiness(supabaseAdmin, payerCompanyId)');
    expect(award).toContain('getStripeCommercialReadiness(supabaseAdmin, carrierCompanyId)');
    expect(award).toContain('before awarding transport work');
    expect(award).toContain('carrier cannot be awarded');
  });
});
