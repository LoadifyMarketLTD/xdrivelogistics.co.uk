import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const helper = read('app/api/_lib/commercialLegalReadiness.ts');
const jobsCreate = read('app/api/jobs/create/route.ts');
const adminManage = read('app/api/admin/jobs/[id]/manage/route.ts');
const quoteConvert = read('app/api/admin/quotes/[id]/convert/route.ts');
const companyMarketplace = read('app/api/marketplace/company/route.ts');
const driverQuote = read('app/api/driver/_lib/submitQuote.ts');
const customerAward = read('app/api/customer/bids/[id]/award/route.ts');
const adminAward = read('app/api/admin/bids/[id]/accept/route.ts');
const bookingRespond = read('app/api/booking-offers/[id]/respond/route.ts');
const onboardingReview = read('app/api/super-admin/onboarding/[id]/route.ts');
const companyGovernance = read('app/api/super-admin/companies/[id]/route.ts');

describe('commercial legal re-acceptance hard gates', () => {
  it('derives company readiness from immutable legal evidence and current controlled documents', () => {
    expect(helper).toContain("registration_legal_acceptances");
    expect(helper).toContain("onboarding_applications");
    expect(helper).toContain("buildCurrentLegalRequirement");
    expect(helper).toContain("evaluateLegalAcceptance");
    expect(helper).toContain("COMMERCIAL_LEGAL_REACCEPTANCE_REQUIRED");
    expect(helper).toContain("currentLegalVersion");
    expect(helper).toContain("acceptedLegalVersion");
  });

  it('blocks publish and direct booking when current company legal acceptance is missing', () => {
    expect(jobsCreate).toContain("getCommercialLegalReadiness");
    expect(jobsCreate).toContain("before publishing transport work");
    expect(jobsCreate).toContain("before it can receive a Direct Booking");
  });

  it('closes republish/direct-invite and accepted-quote conversion bypasses', () => {
    expect(adminManage).toContain("getCommercialLegalReadiness");
    expect(adminManage).toContain("getStripeCommercialReadiness");
    expect(adminManage).toContain("getTransportBuyerRiskSnapshot");
    expect(adminManage).toContain("before it can receive a Direct Booking");

    expect(quoteConvert).toContain("getCommercialLegalReadiness");
    expect(quoteConvert).toContain("getStripeCommercialReadiness");
    expect(quoteConvert).toContain("getTransportBuyerRiskSnapshot");
    expect(quoteConvert).toContain("before converting this quote into transport work");
  });

  it('blocks company and driver quotes until the carrier company has current legal acceptance', () => {
    expect(companyMarketplace).toContain("getCommercialLegalReadiness");
    expect(companyMarketplace).toContain("before quoting for transport work");
    expect(driverQuote).toContain("getCommercialLegalReadiness");
    expect(driverQuote).toContain("commercial_legal_reacceptance_required");
  });

  it('requires current legal acceptance from both commercial parties at award and carrier acceptance', () => {
    expect(customerAward.match(/getCommercialLegalReadiness/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(adminAward.match(/getCommercialLegalReadiness/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(bookingRespond.match(/getCommercialLegalReadiness/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(customerAward).toContain("carrier must re-accept");
    expect(adminAward).toContain("carrier must re-accept");
    expect(bookingRespond).toContain("before this booking can be accepted");
  });

  it('prevents approval or activation on superseded legal acceptance', () => {
    expect(onboardingReview).toContain("getCommercialLegalReadiness");
    expect(onboardingReview).toContain("Approval is blocked until the company re-accepts");
    expect(companyGovernance).toContain("getCommercialLegalReadiness");
    expect(companyGovernance).toContain("Company activation is blocked until the current XDrive legal agreements are re-accepted");
  });
});
