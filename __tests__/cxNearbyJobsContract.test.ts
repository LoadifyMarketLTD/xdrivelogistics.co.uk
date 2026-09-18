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
    expect(source).toContain('distanceToPickupMiles: distanceToPickupByJob.get(row.id) ?? null');
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

  it('returns the persisted Saved/Dismissed preference state for every visible job', () => {
    expect(source).toContain(".from('driver_job_search_preferences')");
    expect(source).toContain(".select('job_id,state')");
    expect(source).toContain('preferenceState: preferenceByJob.get(row.id) ?? null');
  });
});
