import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const onboardingHandlers = read('app/api/onboarding/_lib/handlers.ts');
const adminAward = read('app/api/admin/bids/[id]/accept/route.ts');
const carrierRespond = read('app/api/booking-offers/[id]/respond/route.ts');
const jobsCreate = read('app/api/jobs/create/route.ts');
const onboardingReview = read('app/api/super-admin/onboarding/[id]/route.ts');
const companyGovernance = read('app/api/super-admin/companies/[id]/route.ts');
const controlledLegal = read('lib/legal/controlledLegalDocuments.ts');
const registrationDeclarations = read('lib/legal/registrationDeclarations.ts');

describe('Contract & Payment Protection hard gates', () => {
  it('blocks onboarding submission without a complete signed legal package', () => {
    expect(onboardingHandlers).toContain("registration_legal_acceptances");
    expect(onboardingHandlers).toContain("SIGNED_LEGAL_ACCEPTANCE_REQUIRED");
    expect(onboardingHandlers).toContain("signed_pdf_hash");
    expect(onboardingHandlers).toContain("signature_payload_hash");
    expect(onboardingHandlers).toContain("typed_name_explicit_acceptance");
  });

  it('requires Stripe readiness for both payer and carrier in admin award', () => {
    expect(adminAward).toContain("getStripeCommercialReadiness");
    expect(adminAward).toContain("company_id, bid_price_gbp");
    expect(adminAward).toContain("Complete and activate your company Stripe account before awarding transport work.");
    expect(adminAward).toContain("This carrier cannot be awarded the job until its Stripe account is fully activated.");
  });

  it('revalidates both buyer and carrier Stripe before carrier acceptance', () => {
    expect(carrierRespond).toContain("buyer_company_id, carrier_company_id");
    expect(carrierRespond).toContain("getStripeCommercialReadiness");
    expect(carrierRespond).toContain("Booking acceptance is blocked");
    expect(carrierRespond).toContain("before accepting this booking");
  });

  it('blocks Direct Booking to a carrier that is not Stripe-ready', () => {
    expect(jobsCreate).toContain("direct-target-stripe");
    expect(jobsCreate).toContain("cannot receive a Direct Booking until its Stripe account is fully activated");
  });

  it('blocks commercial approval and activation until Stripe is ready', () => {
    expect(onboardingReview).toContain("Approval is blocked until the company completes and activates Stripe");
    expect(onboardingReview).toContain("SIGNED_LEGAL_ACCEPTANCE_REQUIRED");
    expect(companyGovernance).toContain("Company activation is blocked until Stripe onboarding is complete");
  });

  it('keeps the carrier payment obligation explicit in every controlled legal language', () => {
    expect(controlledLegal).toContain("CONTROLLED_LEGAL_VERSION = '2026-09-29-r3'");
    expect(controlledLegal).toContain("not conditional on whether the buyer, broker or ordering party");
    expect(controlledLegal).toContain("nu depinde de faptul că buyer-ul, brokerul");
    expect(controlledLegal).toContain("ne dépend pas du fait que l’acheteur, le courtier");
    expect(controlledLegal).toContain("no depende de que el comprador, broker");
    expect(controlledLegal).toContain("nie zależy od tego, czy nabywca, broker");
    expect(registrationDeclarations).toContain("not conditional on the buyer, broker or ordering party");
  });
});
