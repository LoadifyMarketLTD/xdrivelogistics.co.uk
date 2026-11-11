import { describe, expect, it } from 'vitest';
import { public3150RouteLabel } from '../lib/jobs/public3150RouteLabel';
describe('Approved 3150 quote modal public town/outcode privacy', () => {
  it('shows an authorised town and only the outward code', () => {
    expect(public3150RouteLabel('Brighton','BN1 4FG')).toBe('Brighton, BN1');
    expect(public3150RouteLabel('St Ives','TR26 2AB')).toBe('St Ives, TR26');
  });
  it('never displays a full address or street even if backend returns it', () => {
    expect(public3150RouteLabel('12 High Street, Brighton','BN1 4FG')).toBe('BN1');
    expect(public3150RouteLabel('George Road','BN1 4FG')).toBe('BN1');
    expect(public3150RouteLabel('Unit 4 Industrial Estate','BN1 4FG')).toBe('BN1');
  });
  it('does not expose unrecognised postcode strings', () => {
    expect(public3150RouteLabel('12 Example Street','not a postcode')).toBe('Location restricted');
  });
});