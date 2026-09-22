import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync(new URL('../app/api/driver/mobile/nearby-jobs/route.ts', import.meta.url), 'utf8');

describe('driver live distance contract', () => {
  it('never reuses persisted distance_to_pickup_miles for live load-card distance', () => {
    expect(route).toContain('distanceToPickupMiles: null');
    expect(route).not.toContain('distanceToPickupMiles: marketplaceNumber(row.distance_to_pickup_miles)');
  });

  it('calculates load-card distance from fresh driver position or home postcode', () => {
    expect(route).toContain("const driverPosition = currentLocationFresh ? latestDriverPosition : homePosition");
    expect(route).toContain('distanceMiles(driverPosition, pickup)');
    expect(route).toContain('drivingMetricsFromDriver');
    expect(route).toContain('pickupEtaMinutes: routed?.durationMinutes ?? null');
  });

  it('fails closed on impossible UK crow-flight distance values', () => {
    expect(route).toContain("const gbPickup = String(row.pickup_country_code || 'GB').toUpperCase() === 'GB'");
    expect(route).toContain('rawMiles > 700 ? null : rawMiles');
  });
});
