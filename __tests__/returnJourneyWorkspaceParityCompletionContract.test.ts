import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => fs.readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('Return Journey company/Owner Driver parity completion', () => {
  const fleet = read('app/admin/fleet/returns/page.tsx');
  const driver = read('app/driver/returns/page.tsx');
  const api = read('app/api/admin/return-journeys/route.ts');

  it('preserves the already-built Driver/Owner Driver return journey capabilities', () => {
    for (const term of ['viaLocations', 'bodyType', 'weightKg', 'spaceUnits', 'goAnywhere', "'regular'"]) {
      expect(driver).toContain(term);
    }
  });

  it('adds the same return capacity metadata to Fleet Manager / Dispatcher management instead of replacing the existing workflow', () => {
    expect(fleet).toContain('VIA LOCATIONS');
    expect(fleet).toContain('BODY TYPE');
    expect(fleet).toContain('WEIGHT KG');
    expect(fleet).toContain('SPACE / PALLETS');
    expect(fleet).toContain('GO ANYWHERE');
    expect(fleet).toContain('JOURNEY TYPE');
    expect(fleet).toContain('decodeJourneyMeta');
    expect(fleet).toContain("meta.journeyKind === 'regular'");
  });

  it('keeps the canonical atomic company binding while carrying structured Return Journey metadata', () => {
    expect(api).toContain("source: 'xdrive_return_exchange_v2'");
    expect(api).toContain('journeyKind: parsed.data.journeyKind');
    expect(api).toContain('viaLocations: parsed.data.viaLocations');
    expect(api).toContain('bodyType: parsed.data.bodyType');
    expect(api).toContain('weightKg: parsed.data.weightKg');
    expect(api).toContain('spaceUnits: parsed.data.spaceUnits');
    expect(api).toContain("p_notes: fromPostcode ? encodedNotes : null");
    expect(api).toContain(".rpc('replace_driver_return_journey_canonical'");
  });

  it('adds fleet-side parity filters without removing existing route/driver/status controls', () => {
    for (const term of ['JOURNEY TYPE', 'VEHICLE', 'BODY TYPE', 'FROM', 'TO', 'DRIVER']) {
      expect(fleet).toContain(term);
    }
    expect(fleet).toContain('Map View');
    expect(fleet).toContain('Close Return');
    expect(fleet).toContain('Open Route');
  });
});
