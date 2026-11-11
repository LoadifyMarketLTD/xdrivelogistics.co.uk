import { describe, expect, it } from 'vitest';
import { isValidMapPoint, operationalDriverAppearance, operationalMarkerSize } from '../app/super-admin/_components/operationalMapGuards';

describe('Super Admin operational map truthfulness', () => {
  it('colors availability rather than speed or GPS motion', () => {
    expect(operationalDriverAppearance('online')).toEqual({
      color: '#168553', textColor: '#FFFFFF', label: 'AVAILABLE', glyph: 'A',
    });
    expect(operationalDriverAppearance('busy')).toEqual({
      color: '#F5A300', textColor: '#101828', label: 'BUSY', glyph: 'B',
    });
    expect(operationalDriverAppearance('offline')).toEqual({
      color: '#D92D20', textColor: '#FFFFFF', label: 'OFFLINE', glyph: 'O',
    });
    expect(operationalDriverAppearance('sold').label).toBe('UNAVAILABLE');
  });

  it('uses 44px tap targets for coarse pointers without enlarging desktop pins', () => {
    expect(operationalMarkerSize(true)).toBe(44);
    expect(operationalMarkerSize(false)).toBe(28);
  });

  it('accepts real geographic points including valid zero coordinates', () => {
    expect(isValidMapPoint(51.5074, -0.1278)).toBe(true);
    expect(isValidMapPoint(0, 0)).toBe(true);
    expect(isValidMapPoint(90, 180)).toBe(true);
    expect(isValidMapPoint(-90, -180)).toBe(true);
  });

  it('rejects missing, out-of-range and non-finite coordinates', () => {
    for (const [lat, lng] of [
      [null, 0], [0, null], [91, 0], [-91, 0], [0, 181], [0, -181],
      [Number.NaN, 0], [0, Number.POSITIVE_INFINITY],
    ] as Array<[number | null, number | null]>) {
      expect(isValidMapPoint(lat, lng)).toBe(false);
    }
  });
});
