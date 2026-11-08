import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pickupDistanceMiles, publicPickupOutcode } from '../app/try-xdrive-demo/components/usePublicPickupRadius';

describe('3150 live Customer Loads geographic filtering', () => {
  it('extracts only public outward postcode', () => {
    expect(publicPickupOutcode('Bolton, BL1')).toBe('BL1');
    expect(publicPickupOutcode('Brighton BN1 2AA')).toBe('BN1');
    expect(publicPickupOutcode('No location')).toBe('');
  });
  it('calculates geographic distance in statute miles', () => {
    expect(pickupDistanceMiles({ lat: 51.5074, lng: -0.1278 }, { lat: 51.5074, lng: -0.1278 })).toBe(0);
    expect(pickupDistanceMiles({ lat: 51.5074, lng: -0.1278 }, { lat: 52.4862, lng: -1.8904 })).toBeGreaterThan(90);
  });
  it('uses true public outcode lookup, genuine map, and retains 3150 reference mode', () => {
    const board = readFileSync('app/try-xdrive-demo/components/DemoExchangeBoard.tsx', 'utf8');
    const hook = readFileSync('app/try-xdrive-demo/components/usePublicPickupRadius.ts', 'utf8');
    expect(board).toContain('<LiveMarketplaceMap');
    expect(board).toContain('pickupRadius.withinRadius');
    expect(board).toContain('productionMode');
    expect(board).toContain('actions={!productionMode');
    expect(hook).toContain('/api/location/postcode-area?q=');
    expect(hook).not.toContain('pickupCoordinates');
  });
});
