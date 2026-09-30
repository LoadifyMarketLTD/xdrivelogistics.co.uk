import { describe, expect, it } from 'vitest';
import { stripeOnboardingFailure } from '../lib/stripeOnboardingFailure';
describe('Stripe company onboarding failures', () => {
  it('identifies the platform-profile blocker without blaming the customer account', () => {
    const result = stripeOnboardingFailure(new Error('You must complete your platform profile to use Connect and create live connected accounts.'));
    expect(result.status).toBe(503);
    expect(result.code).toBe('STRIPE_PLATFORM_SETUP_REQUIRED');
    expect(result.error).toContain('platform setup issue');
    expect(result.error).toContain('not missing details in your company account');
  });
  it('keeps the form and provides a retry for timeouts', () => {
    expect(stripeOnboardingFailure(new DOMException('timeout', 'TimeoutError')).status).toBe(504);
  });
  it('does not expose unknown upstream errors, secrets or stack traces', () => {
    const result = stripeOnboardingFailure(new Error('private request data sk_fake_secret'));
    expect(result.status).toBe(502);
    expect(result.error).not.toContain('sk_fake');
    expect(result.error).toContain('form has been kept');
  });
});
