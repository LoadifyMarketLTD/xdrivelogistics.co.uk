import { describe, expect, it } from 'vitest';
import {
  AVAILABILITY_TABS_BY_ROLE,
  availabilityFreshness,
  matchesAvailabilityFilters,
} from '../lib/availability/canonicalAvailability';

describe('canonical availability engine', () => {
  it('keeps Live, Future and Nearby available to every operational transport role', () => {
    for (const role of ['carrier','fleet_manager','dispatcher','owner_driver','driver'] as const) {
      expect(AVAILABILITY_TABS_BY_ROLE[role]).toEqual(['live','future','nearby']);
    }
  });

  it('filters vehicle capabilities consistently', () => {
    const position = {
      scope: 'exchange' as const,
      member_name: 'Example Carrier',
      vehicle_type: 'luton',
      body_type: 'box',
      payload_kg: 1200,
      pallets_capacity: 6,
      has_tail_lift: true,
    };
    expect(matchesAvailabilityFilters(position, {
      search: 'example',
      scope: 'exchange',
      vehicleType: 'luton',
      bodyType: 'box',
      minPayloadKg: 1000,
      minPallets: 4,
      tailLiftOnly: true,
    })).toBe(true);
    expect(matchesAvailabilityFilters(position, {
      search: '',
      scope: 'exchange',
      vehicleType: 'luton',
      bodyType: 'box',
      minPayloadKg: 1500,
      minPallets: null,
      tailLiftOnly: false,
    })).toBe(false);
  });

  it('classifies availability tracking freshness', () => {
    const now = Date.parse('2026-10-09T10:00:00Z');
    expect(availabilityFreshness('2026-10-09T09:50:00Z', now)).toBe('live');
    expect(availabilityFreshness('2026-10-09T09:20:00Z', now)).toBe('stale');
    expect(availabilityFreshness(null, now)).toBe('missing');
  });
});
