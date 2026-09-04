import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'app/api/billing/subscription/checkout/route.ts'),
  'utf8',
);

describe('Stripe subscription Checkout idempotency contract', () => {
  it('versions the Checkout idempotency key when request parameters evolve', () => {
    expect(source).toContain('xdrive-membership-checkout:v2:');
  });
});
