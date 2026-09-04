import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(process.cwd(), 'app/api/billing/subscription/checkout/route.ts'),
  'utf8',
);

describe('Stripe subscription Checkout contract', () => {
  it('saves the billing address collected by Checkout for automatic tax', () => {
    expect(source).toContain("'automatic_tax[enabled]': true");
    expect(source).toContain("'customer_update[address]': 'auto'");
  });
});
