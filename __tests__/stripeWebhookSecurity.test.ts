import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { verifyStripeWebhookSignature } from '../app/api/_lib/stripeServer';

const secret = 'whsec_test_xdrive';
const payload = JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' });

const headerFor = (timestamp: number, body = payload, signingSecret = secret) => {
  const signature = crypto.createHmac('sha256', signingSecret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${signature}`;
};

describe('Stripe webhook signature verification', () => {
  it('accepts a valid v1 signature inside the tolerance window', () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const timestamp = Math.floor(now / 1000);
    expect(verifyStripeWebhookSignature(payload, headerFor(timestamp), secret)).toBe(true);
    vi.restoreAllMocks();
  });

  it('rejects a modified body', () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const timestamp = Math.floor(now / 1000);
    expect(verifyStripeWebhookSignature(`${payload}x`, headerFor(timestamp), secret)).toBe(false);
    vi.restoreAllMocks();
  });

  it('rejects stale signed events', () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const staleTimestamp = Math.floor(now / 1000) - 301;
    expect(verifyStripeWebhookSignature(payload, headerFor(staleTimestamp), secret)).toBe(false);
    vi.restoreAllMocks();
  });
});
