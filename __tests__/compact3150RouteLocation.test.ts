import {describe, expect, it} from 'vitest';
import {compactRouteLocation} from '../lib/jobs/compactRouteLocation';

describe('approved 3150 card location privacy and compactness',()=>{
  it('uses town and outcode without street-level details',()=>{
    expect(compactRouteLocation('Cornelian Street, Blackburn, BB1 9QL, GB','BB1 9QL','Collection')).toBe('Blackburn, BB1');
    expect(compactRouteLocation('2 Sandcliff Road, Erith, DA8 1NY','DA8 1NY','Delivery')).toBe('Erith, DA8');
    expect(compactRouteLocation('Trafford Park Road, Trafford, M17 1WH','M17 1WH','Collection')).toBe('Trafford, M17');
  });
  it('does not invent a town when only a street and postcode are available',()=>{
    expect(compactRouteLocation('101 Cornelian Street, BB1 9QL','BB1 9QL','Collection')).toBe('BB1');
    expect(compactRouteLocation('2 Sandcliff Road','DA8 1NY','Delivery')).toBe('DA8');
  });
  it('preserves meaningful location when postcode is absent',()=>{
    expect(compactRouteLocation('Manchester',null,'Collection')).toBe('Manchester');
    expect(compactRouteLocation(null,null,'Delivery')).toBe('Delivery');
  });
  it('does not reveal complete postcodes in card labels',()=>{
    const label=compactRouteLocation('E2E TEST ONLY - NO DELIVERY - Worthing, BN11 1AA','BN11 1AA','Delivery');
    expect(label).toBe('Worthing, BN11');
    expect(label).not.toContain('1AA');
  });
});
