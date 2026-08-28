import fs from 'node:fs';
import path from 'node:path';

describe('CX-benchmark nearby jobs contract', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'app/api/driver/mobile/nearby-jobs/route.ts'),
    'utf8',
  );

  it('returns route intelligence fields that the driver app renders', () => {
    expect(source).toContain("'job_distance_miles', 'job_distance_minutes', 'distance_to_pickup_miles'");
    expect(source).toContain('distanceToPickupMiles: marketplaceNumber(row.distance_to_pickup_miles)');
    expect(source).toContain('estimatedJourneyMinutes: marketplaceNumber(row.job_distance_minutes)');
  });

  it('supports Return IQ radii up to 300 miles', () => {
    expect(source).toContain('Math.min(300, Math.max(10, Math.round(requestedRadius)))');
  });

  it('does not return expired exchange loads and exposes expiry to the client', () => {
    expect(source).toContain('exchange_expires_at: string | null');
    expect(source).toContain('exchangePostActive(row)');
    expect(source).toContain('expiresAt: row.exchange_expires_at');
  });
});
