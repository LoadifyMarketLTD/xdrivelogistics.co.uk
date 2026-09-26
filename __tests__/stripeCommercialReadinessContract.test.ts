import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('canonical Stripe commercial readiness contract', () => {
  const readiness = read('app/api/_lib/stripeCommercialReadiness.ts');
  const createJob = read('app/api/jobs/create/route.ts');
  const driverQuote = read('app/api/driver/_lib/submitQuote.ts');
  const companyMarketplace = read('app/api/marketplace/company/route.ts');
  const award = read('app/api/customer/bids/[id]/award/route.ts');

  it('defines one company-scoped fail-closed readiness rule', () => {
    expect(readiness).toContain("from('stripe_connected_accounts')");
    expect(readiness).toContain("details_submitted");
    expect(readiness).toContain("charges_enabled");
    expect(readiness).toContain("payouts_enabled");
    expect(readiness).toContain('detailsSubmitted && chargesEnabled && payoutsEnabled');
    expect(readiness).toContain('STRIPE_COMMERCIAL_READINESS_REQUIRED');
  });

  it('does not gate Post Load publication or Direct Booking on Stripe in the direct-party payment model', () => {
    expect(createJob).not.toContain('getStripeCommercialReadiness');
    expect(createJob).not.toContain('stripeCommercialReadinessPayload');
    expect(createJob).not.toContain('before publishing transport work');
    expect(createJob).not.toContain('before it can receive a Direct Booking');
  });

  it('requires carrier readiness on both driver and company quote paths', () => {
    expect(driverQuote).toContain('getStripeCommercialReadiness(supabaseAdmin, driver.companyId)');
    expect(driverQuote).toContain("denialReasons: ['stripe_commercial_readiness_required']");
    expect(companyMarketplace).toContain('getStripeCommercialReadiness(supabaseAdmin, input.companyId)');
    expect(companyMarketplace).toContain('before quoting for transport work');
  });

  it('rechecks both contracting parties immediately before award', () => {
    expect(award).toContain(".select('id, job_id, status, company_id')");
    expect(award).toContain('getStripeCommercialReadiness(supabaseAdmin, job.company_id as string)');
    expect(award).toContain('getStripeCommercialReadiness(supabaseAdmin, bid.company_id as string | null)');
    expect(award).toContain('before awarding transport work');
    expect(award).toContain('carrier cannot be awarded');
  });
});
