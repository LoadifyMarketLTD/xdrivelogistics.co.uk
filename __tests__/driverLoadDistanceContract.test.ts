import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync(new URL('../app/api/driver/mobile/nearby-jobs/route.ts', import.meta.url), 'utf8');

describe('driver load distance contract', () => {
  it('never trusts persisted distance_to_pickup_miles for live card distance', () => {
    expect(route).toContain('distanceToPickupMiles: null');
    expect(route).not.toContain('distanceToPickupMiles: marketplaceNumber(row.distance_to_pickup_miles)');
  });

  it('rejects implausible Great Britain pickup distances', () => {
    expect(route).toContain("const gbPickup = String(row.pickup_country_code || 'GB').toUpperCase() === 'GB';");
    expect(route).toContain('rawMiles > 700 ? null : rawMiles');
  });
});
