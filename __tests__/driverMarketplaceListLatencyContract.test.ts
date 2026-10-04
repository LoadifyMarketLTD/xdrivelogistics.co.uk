import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync(new URL('../app/api/driver/marketplace/loads/route.ts', import.meta.url), 'utf8');

describe('driver marketplace list latency contract', () => {
  it('does not repair route metrics or geocode postcodes inside the marketplace list request', () => {
    expect(route).not.toContain('missingRouteJobs');
    expect(route).not.toContain('calculateJobRouteMetrics');
    expect(route).not.toContain('api.postcodes.io');
    expect(route).not.toContain('AbortSignal.timeout(5_000)');
  });

  it('keeps list distance calculation local and non-blocking', () => {
    expect(route).toContain('function distanceMiles');
    expect(route).toContain('Number(distanceMiles(driverPosition, pickup).toFixed(1))');
    expect(route).toContain('The list endpoint must not wait on external routing/geocoding per job.');
  });

  it('only performs exact road-route enrichment for a requested Load Detail', () => {
    expect(route).toContain('if (requestedId && driverPosition && pickup)');
    expect(route).toContain('calculateDrivingRoute([driverPosition, pickup])');
  });

  it('preserves the current Driver availability location fallback', () => {
    expect(route).toContain(".from('driver_availability_presence')");
    expect(route).toContain('const driverPosition = jobLocationFresh');
    expect(route).toContain('availabilityLocationFresh');
  });
});
