import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pickupDistanceMiles, publicPickupOutcode, matchesPublicPickupRadius } from '../app/try-xdrive-demo/components/usePublicPickupRadius';

describe('3150 live Customer Loads geographic filtering', () => {
  it('extracts only public outward postcode', () => {
    expect(publicPickupOutcode('Bolton, BL1')).toBe('BL1');
    expect(publicPickupOutcode('Brighton BN1 2AA')).toBe('BN1');
    expect(publicPickupOutcode('No location')).toBe('');
  });
  it('always includes matching BN17 jobs, including Completed history, even when geocoding fails', () => {
    expect(matchesPublicPickupRadius('BN17', 'BN17', {}, 5)).toBe(true);
    expect(matchesPublicPickupRadius('Littlehampton, BN17', 'BN17', { BN17: null }, 10)).toBe(true);
    expect(matchesPublicPickupRadius('BN17', 'BN17', { BN17: { lat: 50.8151, lng: -0.5400 } }, 5)).toBe(true);
    expect(matchesPublicPickupRadius('BN1', 'BN17', { BN17: null }, 10)).toBe(false);
  });
  it('keeps nearby geocoded areas within radius and rejects distant postcodes', () => {
    const coordinates = { BN17: { lat: 50.8151, lng: -0.5400 }, BN16: { lat: 50.8100, lng: -0.5000 }, BL1: { lat: 53.5905, lng: -2.4450 } };
    expect(matchesPublicPickupRadius('BN16', 'BN17', coordinates, 5)).toBe(true);
    expect(matchesPublicPickupRadius('BL1', 'BN17', coordinates, 100)).toBe(false);
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
