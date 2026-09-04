import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('XDrive Stripe Connect direct-charge contract', () => {
  it('creates Standard connected accounts and keeps payout onboarding owner/admin gated', () => {
    const onboarding = source('app/api/payments/connect/onboarding/route.ts');
    expect(onboarding).toContain("type: 'standard'");
    expect(onboarding).toContain("new Set(['owner', 'admin'])");
    expect(onboarding).toContain("type: 'account_onboarding'");
  });

  it('creates transport Checkout directly on the supplier connected account with no XDrive fee', () => {
    const checkout = source('app/api/payments/jobs/checkout/route.ts');
    expect(checkout).toContain('connectedAccount: connected.stripe_account_id');
    expect(checkout).toContain("paymentModel: 'stripe_connect_direct_charge'");
    expect(checkout).toContain('platformCustodiesFunds: false');
    expect(checkout).toContain('xdriveApplicationFee: 0');
    expect(checkout).not.toContain('application_fee_amount');
    expect(checkout).not.toContain('transfer_data');
  });

  it('refuses Checkout until the supplier can both charge and receive payouts', () => {
    const checkout = source('app/api/payments/jobs/checkout/route.ts');
    expect(checkout).toContain('!connected.charges_enabled || !connected.payouts_enabled');
    expect(checkout).toContain('The carrier has not completed Stripe payment and payout onboarding.');
  });

  it('verifies Connect webhook signatures and never performs automatic refund or payout mutations', () => {
    const webhook = source('app/api/payments/webhooks/connect/route.ts');
    expect(webhook).toContain('STRIPE_CONNECT_WEBHOOK_SECRET');
    expect(webhook).toContain('verifyStripeWebhookSignature');
    expect(webhook).toContain("event.type === 'charge.dispute.created' || event.type === 'charge.refunded'");
    expect(webhook).not.toContain("'/refunds'");
    expect(webhook).not.toContain("'/payouts'");
  });
});
