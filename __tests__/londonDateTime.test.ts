import { describe, expect, it } from 'vitest';
import { londonLocalDateTimeToIso } from '../lib/londonDateTime';

describe('londonLocalDateTimeToIso', () => {
  it('stores UK summer wall-clock time with the BST offset', () => {
    expect(londonLocalDateTimeToIso('2026-09-19', '10:00')).toBe('2026-09-19T09:00:00.000Z');
    expect(londonLocalDateTimeToIso('2026-09-19', '13:00')).toBe('2026-09-19T12:00:00.000Z');
  });

  it('stores UK winter wall-clock time as GMT', () => {
    expect(londonLocalDateTimeToIso('2026-12-19', '10:00')).toBe('2026-12-19T10:00:00.000Z');
  });

  it('handles the spring DST change and rejects a nonexistent UK local time', () => {
    expect(londonLocalDateTimeToIso('2026-03-29', '00:30')).toBe('2026-03-29T00:30:00.000Z');
    expect(londonLocalDateTimeToIso('2026-03-29', '02:00')).toBe('2026-03-29T01:00:00.000Z');
    expect(londonLocalDateTimeToIso('2026-03-29', '01:30')).toBeNull();
  });

  it('rejects malformed date/time inputs', () => {
    expect(londonLocalDateTimeToIso('', '10:00')).toBeNull();
    expect(londonLocalDateTimeToIso('2026-09-19', '25:00')).toBeNull();
  });
});
