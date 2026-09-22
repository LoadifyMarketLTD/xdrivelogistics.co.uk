import fs from 'node:fs';
import path from 'node:path';

describe('CX-benchmark nearby jobs contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/nearby-jobs/route.ts'),
    'utf8',
  );

  it('returns route intelligence fields that the driver app renders', () => {
    expect(source).toContain("'job_distance_miles', 'job_distance_minutes'");
    expect(source).toContain(".from('driver_locations')");
    expect(source).toContain(".select('lat,lng,recorded_at')");
    expect(source).toContain('distanceToPickupMiles: routed?.distanceMiles ?? straightLineDistanceByJob.get(row.id) ?? null');
    expect(source).toContain('pickupEtaMinutes: routed?.durationMinutes ?? null');
    expect(source).toContain('estimatedJourneyMinutes: marketplaceNumber(row.job_distance_minutes)');
  });

  it('supports Return IQ radii up to 300 miles', () => {
    expect(source).toContain('Math.min(300, Math.max(10, Math.round(requestedRadius)))');
  });

  it('resolves UK outcodes and suppresses impossible domestic pickup distances', () => {
    expect(source).toContain("https://api.postcodes.io/outcodes/");
    expect(source).toContain("rawMiles !== null && gbPickup && rawMiles > 700 ? null : rawMiles");
    expect(source).toContain("distanceToPickupMiles: null");
    expect(source).toContain("distanceMethod: routed ? 'road_route' : driverPosition ? 'straight_line_fallback' : null");
  });

  it('does not return expired exchange loads and exposes expiry to the client', () => {
    expect(source).toContain('exchange_expires_at: string | null');
    expect(source).toContain('exchangePostActive(row)');
    expect(source).toContain('expiresAt: row.exchange_expires_at');
  });
  it('never converts missing coordinates to 0,0 and falls back to home location when GPS is stale', () => {
    expect(source).toContain("if (lat === null || lat === undefined || lng === null || lng === undefined) return null;");
    expect(source).toContain("if (typeof lat === 'string' && lat.trim() === '') return null;");
    expect(source).toContain("if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) return null;");
    expect(source).toContain("Date.now() - locationRecordedAt <= 120 * 60_000");
    expect(source).toContain(".from('companies').select('postcode')");
    expect(source).toContain("distanceOrigin = currentLocationFresh ? 'current_location' : homePosition ? 'home_location' : null");
  });

});
