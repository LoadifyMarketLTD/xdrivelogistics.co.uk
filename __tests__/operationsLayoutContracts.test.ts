import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const fleetMapClient = readFileSync(
  resolve(process.cwd(), 'app/admin/fleet/FleetPositionMapClient.tsx'),
  'utf8',
);

const fleetMapWrapper = readFileSync(
  resolve(process.cwd(), 'app/admin/fleet/FleetPositionMap.tsx'),
  'utf8',
);

describe('live-map layout contracts', () => {
  it('keeps the fleet live map fallback and Leaflet container within a fixed-height wrapper', () => {
    expect(fleetMapClient).toContain("height: '440px'");
    expect(fleetMapClient).toContain("width: '100%'");
    expect(fleetMapClient).toContain("overflow: 'hidden'");
    expect(fleetMapWrapper).toContain("minHeight: '440px'");
    expect(fleetMapWrapper).toContain('Loading live map…');
  });
});
