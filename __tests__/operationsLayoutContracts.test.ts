import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const operationsCentre = readFileSync(
  resolve(process.cwd(), 'app/admin/operations-centre/page.tsx'),
  'utf8',
);

const fleetMapClient = readFileSync(
  resolve(process.cwd(), 'app/admin/fleet/FleetPositionMapClient.tsx'),
  'utf8',
);

const fleetMapWrapper = readFileSync(
  resolve(process.cwd(), 'app/admin/fleet/FleetPositionMap.tsx'),
  'utf8',
);

describe('operations and live-map layout contracts', () => {
  it('keeps the operations centre page on an explicit styled workspace shell', () => {
    expect(operationsCentre).toContain('className="ops-page"');
    expect(operationsCentre).toContain('.ops-page { min-height: calc(100vh - 92px);');
    expect(operationsCentre).toContain('.metric-grid { display: grid;');
    expect(operationsCentre).toContain('.workspace { display: grid;');
  });

  it('keeps the live operations map bounded inside its panel for data and no-data states', () => {
    expect(operationsCentre).toContain('.map { min-height: 410px;');
    expect(operationsCentre).toContain("overflow: hidden");
    expect(operationsCentre).toContain('.map svg { position: absolute; inset: 0; width: 100%; height: 100%; }');
    expect(operationsCentre).toContain('{payload.mapPoints.length === 0 && <div className="empty map-empty">No live coordinates available.</div>}');
    expect(operationsCentre).toContain('.map-empty { position: absolute; inset: 0; display: grid; place-items: center; z-index: 2; }');
  });

  it('keeps the fleet live map fallback and Leaflet container within a fixed-height wrapper', () => {
    expect(fleetMapClient).toContain("height: '440px'");
    expect(fleetMapClient).toContain("width: '100%'");
    expect(fleetMapClient).toContain("overflow: 'hidden'");
    expect(fleetMapWrapper).toContain("minHeight: '440px'");
    expect(fleetMapWrapper).toContain('Loading live map…');
  });
});
