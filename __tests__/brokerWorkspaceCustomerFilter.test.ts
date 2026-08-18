import { describe, expect, it } from 'vitest';

import { getBrokerCustomerFilter } from '../lib/brokerCustomerFilter';

describe('broker customer filter decoding', () => {
  it.each([
    ['customer=ACME%25', 'ACME%'],
    ['customer=ACME%20Logistics', 'ACME Logistics'],
    ['customer=ACME%2BLogistics', 'ACME+Logistics'],
    ['customer=ACME%252BLogistics', 'ACME%2BLogistics'],
  ])('preserves URLSearchParams decoding for "%s"', (query, expected) => {
    const searchParams = new URLSearchParams(query);

    expect(() => getBrokerCustomerFilter(searchParams)).not.toThrow();
    expect(getBrokerCustomerFilter(searchParams)).toBe(expected);
  });
});
