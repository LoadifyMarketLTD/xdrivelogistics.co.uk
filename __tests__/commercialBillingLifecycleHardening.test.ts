import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('XDrive commercial billing lifecycle hardening', () => {
  it('preserves an existing launch trial instead of restarting it at Checkout', () => {
    const checkout = source('app/api/billing/subscription/checkout/route.ts');
    expect(checkout).toContain('preservedTrialEnd');
    expect(checkout).toContain('trialPreserved');
    expect(checkout).toContain('Entering a payment method must never restart or extend their three free calendar months.');
  });

  it('keeps Platform Owner outside commercial membership billing', () => {
    const checkout = source('app/api/billing/subscription/checkout/route.ts');
    const gate = source('app/components/MembershipEntitlementGate.tsx');
    expect(checkout).toContain('Platform Owner is outside the commercial membership billing lifecycle.');
    expect(gate).toContain("profile.role?.toLowerCase() === 'owner'");
  });

  it('requires company billing authority and buyer payments authority', () => {
    const checkout = source('app/api/billing/subscription/checkout/route.ts');
    const paymentCheckout = source('app/api/payments/jobs/checkout/route.ts');
    expect(checkout).toContain("COMPANY_BILLING_ROLES = new Set(['owner', 'admin'])");
    expect(paymentCheckout).toContain("membershipHasCapability(buyerRole, 'payments.manage')");
  });

  it('prevents Stripe billing webhooks from prematurely ending a live trial', () => {
    const webhook = source('app/api/billing/webhooks/stripe/route.ts');
    expect(webhook).toContain("row?.status === 'trialing' && isFutureTimestamp(row.trial_ends_at)");
    expect(webhook).toContain("nextStatus = 'trialing'");
  });

  it('provisions one server-governed commercial trial per eligible company', () => {
    const migration = source('supabase/migrations/20260903102705_commercial_membership_company_uniqueness_and_trial_provisioning.sql');
    expect(migration).toContain('create unique index if not exists platform_membership_subscriptions_company_uq');
    expect(migration).toContain('create schema if not exists private');
    expect(migration).toContain('security definer');
    expect(migration).toContain("now() + interval '3 months'");
    expect(migration).toContain('revoke execute on function private.ensure_xdrive_commercial_trial_for_active_membership() from anon, authenticated');
  });

  it('gates commercial workspaces but leaves billing recovery outside those layouts', () => {
    for (const [path, workspacePath] of [
      ['app/admin/layout.tsx', '/admin'],
      ['app/broker/layout.tsx', '/broker'],
      ['app/customer/layout.tsx', '/customer'],
      ['app/driver/layout.tsx', '/driver'],
    ] as const) {
      const layout = source(path);
      expect(layout).toContain('MembershipEntitlementGate');
      expect(layout).toContain(`workspacePath=\"${workspacePath}\"`);
    }
    const billing = source('app/settings/billing/page.tsx');
    expect(billing).not.toContain('<MembershipEntitlementGate');
  });
});
