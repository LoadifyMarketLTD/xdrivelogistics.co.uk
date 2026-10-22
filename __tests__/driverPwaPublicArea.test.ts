import { describe, expect, it } from 'vitest';
import { mobilePublicArea, publicTown } from '../app/api/driver/_lib/mobilePublicArea';

describe('Driver PWA pre-award town and outward postcode presentation', () => {
  it('presents the posting town and outward postcode without the inward portion', () => {
    expect(mobilePublicArea('M1 2AB', 'Manchester')).toBe('Manchester M1');
    expect(mobilePublicArea('SW1A 1AA', 'London')).toBe('London SW1A');
    expect(mobilePublicArea('BN1 3PX', 'Brighton & Hove')).toBe('Brighton & Hove BN1');
    expect(mobilePublicArea('PE30 1AB', 'King\u2019s Lynn')).toBe('King\u2019s Lynn PE30');
  });

  it('does not echo street-level or multiline data supplied as a city', () => {
    expect(publicTown('10 Downing Street')).toBe('');
    expect(publicTown('Flat 2, Old Street')).toBe('');
    expect(publicTown('Manchester\n1 Canal St')).toBe('');
    expect(mobilePublicArea('SW1A 1AA', '10 Downing Street')).toBe('SW1A');
  });

  it('falls back safely when town or postcode is missing', () => {
    expect(mobilePublicArea('M1 2AB', null)).toBe('M1');
    expect(mobilePublicArea(null, 'Manchester')).toBe('Manchester');
    expect(mobilePublicArea(null, null)).toBe('Location not provided');
  });
});
