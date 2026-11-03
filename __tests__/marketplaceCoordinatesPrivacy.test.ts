import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { marketplaceCoordinates, publicAreaLabel, publicOutcode } from '../app/api/driver/_lib/marketplacePublic';

describe('driver marketplace pre-award location integrity', () => {
  it.each([
    [null, null],
    [undefined, undefined],
    ['', ''],
    ['  ', '-0.2'],
    [false, 1],
    [51.5, null],
    [null, -0.13],
    [Number.NaN, -0.13],
    [51.5, Number.POSITIVE_INFINITY],
    [91, -0.13],
    [-91, -0.13],
    [51.5, 181],
    [51.5, -181],
  ])('never fabricates a GPS point from invalid coordinates (%s, %s)', (lat, lng) => {
    expect(marketplaceCoordinates(lat, lng)).toBeNull();
  });

  it('preserves genuine zero coordinates and parses valid UK GPS points', () => {
    expect(marketplaceCoordinates(0, 0)).toEqual({ lat: 0, lng: 0 });
    expect(marketplaceCoordinates('51.5014', '-0.141')).toEqual({ lat: 51.5014, lng: -0.141 });
    expect(marketplaceCoordinates(-90, 180)).toEqual({ lat: -90, lng: 180 });
  });

  it('displays public town/outcode but not exact delivery details before award', () => {
    expect(publicOutcode('DA8 1NY')).toBe('DA8');
    expect(publicOutcode('BB1 9QL')).toBe('BB1');
    expect(publicAreaLabel('DA8 1NY', 'GB', 'Unknown')).toBe('DA8');

    const source = readFileSync(join(process.cwd(), 'app/api/driver/marketplace/loads/route.ts'), 'utf8');
    expect(source).toContain('pickup_postcode_full: null');
    expect(source).toContain('delivery_postcode_full: null');
    expect(source).toContain('const validCoordinates = marketplaceCoordinates;');
    expect(source).toContain('distance_to_pickup_miles: null');
    expect(source).toContain('pickup_eta_minutes: null');
    expect(source).toContain('distance_to_pickup_miles: distanceToPickupMiles');
    expect(source).toContain('pickup_eta_minutes: pickupEtaMinutes');
    expect(source).not.toMatch(/pickup_lat:\s*job\.pickup_lat/);
    expect(source).not.toMatch(/delivery_lat:\s*job\.delivery_lat/);
  });
});
