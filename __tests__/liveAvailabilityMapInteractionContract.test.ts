import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'app/admin/fleet/FleetPositionMapClient.tsx'),
  'utf8',
);

describe('Live Availability map interaction contract', () => {
  it('keeps pan/drag and wheel zoom enabled on the Leaflet map', () => {
    expect(source).toContain('<MapContainer');
    expect(source).toContain('scrollWheelZoom');
    expect(source).not.toContain('scrollWheelZoom={false}');
  });

  it('keeps automatic focus, fit-bounds and marker popups', () => {
    expect(source).toContain('map.setView([selected.lat, selected.lng], 12, { animate: true });');
    expect(source).toContain('map.fitBounds(bounds');
    expect(source).toContain('<CircleMarker');
    expect(source).toContain('<Popup>');
  });
});
