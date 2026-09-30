import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync(new URL('../app/api/driver/marketplace/loads/route.ts', import.meta.url), 'utf8');

describe('driver marketplace Alerts contract', () => {
  it('does not repair missing route metrics inside the Alerts list request', () => {
    expect(route).not.toContain('missingRouteJobs');
    expect(route).not.toContain('calculateJobRouteMetrics');
  });

  it('uses the driver live GPS position and configured alert radius for list candidates', () => {
    expect(route).toContain(".from('driver_locations')");
    expect(route).toContain(".from('driver_load_alert_preferences')");
    expect(route).toContain('current_location_max_age_minutes');
    expect(route).toContain('radius_miles');
    expect(route).toContain('miles <= radiusMiles');
    expect(route).toContain('const driverPosition = gpsFresh && currentRadiusEnabled ? latestPosition : null');
  });

  it('orders matching Alerts newest first', () => {
    expect(route).toContain(".order('exchange_posted_at', { ascending: false })");
    expect(route).toContain('return postedB - postedA');
  });

  it('only performs road-route enrichment for a requested load detail', () => {
    expect(route).toContain('if (requestedId && driverPosition && pickup)');
    expect(route).toContain('Alerts stay instant by using the driver\'s live GPS + stored pickup coordinates.');
  });
});
