import { describe, expect, it } from 'vitest';

import { resolveMembershipEntitlement } from '../lib/membershipEntitlement';

describe('membership entitlement', () => {
  const now = new Date('2026-09-03T09:00:00Z');

  it('allows an active subscription', () => {
    expect(resolveMembershipEntitlement({ status: 'active', now }).workspaceAllowed).toBe(true);
  });

  it('allows a live trial', () => {
    expect(resolveMembershipEntitlement({ status: 'trialing', trialEndsAt: '2026-12-03T09:00:00Z', now }).workspaceAllowed).toBe(true);
  });

  it('blocks an expired trial but keeps billing repair accessible', () => {
    const entitlement = resolveMembershipEntitlement({ status: 'trialing', trialEndsAt: '2026-09-03T08:59:59Z', now });
    expect(entitlement.workspaceAllowed).toBe(false);
    expect(entitlement.mode).toBe('billing_only');
    expect(entitlement.billingAllowed).toBe(true);
  });

  it.each(['pending', 'past_due', 'unpaid', 'paused', 'cancelled', 'incomplete', 'incomplete_expired'] as const)(
    'fails closed for %s',
    (status) => {
      const entitlement = resolveMembershipEntitlement({ status, now });
      expect(entitlement.workspaceAllowed).toBe(false);
      expect(entitlement.billingAllowed).toBe(true);
    },
  );

  it('fails closed when membership is missing', () => {
    expect(resolveMembershipEntitlement({ status: null, now }).workspaceAllowed).toBe(false);
  });
});
