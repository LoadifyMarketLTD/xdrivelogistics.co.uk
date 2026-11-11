import { describe, expect, it } from 'vitest';
import { formatPublicOutcode } from '../lib/jobs/formatPublicOutcode';

describe('public postcode scope before award', () => {
  it.each([
    ['BB1 9QL', 'BB1'],
    ['DA8 1NY', 'DA8'],
    ['SW1A 1AA', 'SW1A'],
    ['SW1A1AA', 'SW1A'],
    ['EC1A 1BB', 'EC1A'],
    ['M1 1AE', 'M1'],
    ['BB1', 'BB1'],
    ['AB12', 'AB12'],
    [null, 'Location not supplied'],
    ['', 'Location not supplied'],
    ['12 Test Street, BB1 9QL', 'Location restricted'],
    ['Blackburn, BB1 9QL', 'Location restricted'],
    ['unverified address', 'Location restricted'],
  ])('reduces %s to %s', (input, expected) => {
    expect(formatPublicOutcode(input)).toBe(expected);
  });
});
