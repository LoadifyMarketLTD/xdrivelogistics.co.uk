import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const route = readFileSync(new URL('../app/api/driver/marketplace/loads/route.ts', import.meta.url), 'utf8');

describe('driver marketplace list latency contract', () => {
  it('does not repair missing route metrics inside the list request', () => {
    expect(route).not.toContain('missingRouteJobs');
    expect(route).not.toContain('calculateJobRouteMetrics');
  });

  it('only performs driver-to-pickup routing enrichment for a requested load detail', () => {
    expect(route).toContain('if (requestedId && driverPosition');
    expect(route).toContain('The list endpoint must never fan out external routing requests for every load.');
  });
});
