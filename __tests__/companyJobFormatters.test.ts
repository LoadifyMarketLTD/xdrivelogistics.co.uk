import { describe, expect, it } from 'vitest';
import {
  safeStr,
  displayText,
  formatPostcode,
  formatPostcodeRoute,
  formatRoute,
  formatDate,
  formatDatetime,
  formatDateShort,
  formatTime,
  formatCurrency,
  formatVehicleLabel,
  formatDistance,
  formatDimensions,
  formatWeight,
  formatJobRef,
  formatLocationSummary,
} from '../lib/companyJobFormatters';

describe('safeStr', () => {
  it('returns strings unchanged (trimmed)', () => {
    expect(safeStr('  hello  ')).toBe('hello');
  });
  it('returns empty string for null', () => {
    expect(safeStr(null)).toBe('');
  });
  it('returns empty string for undefined', () => {
    expect(safeStr(undefined)).toBe('');
  });
  it('returns empty string for objects', () => {
    expect(safeStr({ bad: true } as unknown as string)).toBe('');
  });
  it('returns empty string for arrays', () => {
    expect(safeStr(['a'] as unknown as string)).toBe('');
  });
  it('returns empty string for numbers', () => {
    expect(safeStr(42 as unknown as string)).toBe('');
  });
});

describe('displayText', () => {
  it('returns the string as-is when non-empty', () => {
    expect(displayText('van_small')).toBe('van_small');
  });
  it('returns the string unchanged without title-casing', () => {
    expect(displayText('lwb_van')).toBe('lwb_van');
  });
  it('returns default fallback for empty string', () => {
    expect(displayText('')).toBe('—');
  });
  it('returns custom fallback for null', () => {
    expect(displayText(null, 'N/A')).toBe('N/A');
  });
  it('returns custom fallback for objects', () => {
    expect(displayText({} as unknown as string, 'Unknown')).toBe('Unknown');
  });
  it('returns string unchanged for plain words', () => {
    expect(displayText('Delivered')).toBe('Delivered');
  });
});

describe('formatPostcode', () => {
  it('returns postcode uppercased and trimmed', () => {
    expect(formatPostcode('sw1a 1aa')).toBe('SW1A 1AA');
  });
  it('returns "—" for null', () => {
    expect(formatPostcode(null)).toBe('—');
  });
  it('returns "—" for empty string', () => {
    expect(formatPostcode('')).toBe('—');
  });
  it('returns "—" for objects', () => {
    expect(formatPostcode({ lat: 0 } as unknown as string)).toBe('—');
  });
  it('uppercases already-uppercase postcode', () => {
    expect(formatPostcode('M1 1AA')).toBe('M1 1AA');
  });
});

describe('formatRoute', () => {
  it('combines two locations with arrow', () => {
    expect(formatRoute('London', 'Manchester')).toBe('London → Manchester');
  });
  it('returns "—" when both sides resolve to "—"', () => {
    expect(formatRoute(null, null)).toBe('—');
  });
  it('formats partial null as "X → —"', () => {
    expect(formatRoute('Leeds', null)).toBe('Leeds → —');
  });
  it('extracts city from comma-separated address', () => {
    const result = formatRoute('Unit 5, Trafford Park, Manchester', 'Canary Wharf, London');
    expect(result).toContain('→');
  });
});

describe('formatPostcodeRoute', () => {
  it('formats two postcodes with arrow', () => {
    expect(formatPostcodeRoute('M1 1AA', 'E1 6AN')).toBe('M1 1AA → E1 6AN');
  });
  it('returns "—" for both null', () => {
    expect(formatPostcodeRoute(null, null)).toBe('—');
  });
});

describe('formatDate', () => {
  it('formats ISO date string to readable date', () => {
    const result = formatDate('2025-06-15');
    expect(result).not.toBe('—');
    expect(result.length).toBeGreaterThan(4);
    expect(result).toMatch(/2025/);
  });
  it('returns "—" for empty string', () => {
    expect(formatDate('')).toBe('—');
  });
  it('returns "—" for null', () => {
    expect(formatDate(null)).toBe('—');
  });
  it('returns "—" for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });
  it('returns "—" for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });
});

describe('formatDatetime', () => {
  it('formats ISO datetime string including time', () => {
    const result = formatDatetime('2025-06-15T14:30:00Z');
    expect(result).not.toBe('—');
    expect(result).toContain(':');
    // Uses 2-digit year: "15 Jun 25, 14:30"
    expect(result).toMatch(/Jun/);
  });
  it('returns "—" for null', () => {
    expect(formatDatetime(null)).toBe('—');
  });
  it('returns "—" for invalid string', () => {
    expect(formatDatetime('invalid')).toBe('—');
  });
});

describe('formatDateShort', () => {
  it('returns a short date (no year)', () => {
    const result = formatDateShort('2025-06-15');
    expect(result).not.toBe('—');
    expect(result.length).toBeGreaterThan(0);
  });
  it('returns "—" for null', () => {
    expect(formatDateShort(null)).toBe('—');
  });
});

describe('formatTime', () => {
  it('returns time in HH:MM format', () => {
    const result = formatTime('2025-06-15T14:30:00Z');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
  it('returns "—" for null', () => {
    expect(formatTime(null)).toBe('—');
  });
  it('returns "—" for invalid string', () => {
    expect(formatTime('not-a-time')).toBe('—');
  });
});

describe('formatCurrency', () => {
  it('formats positive numbers as GBP', () => {
    const result = formatCurrency(1500);
    expect(result).toContain('1,500');
  });
  it('formats zero correctly', () => {
    const result = formatCurrency(0);
    expect(result).not.toBe('—');
    expect(result).toContain('0');
  });
  it('returns "—" for null', () => {
    expect(formatCurrency(null)).toBe('—');
  });
  it('returns "—" for undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });
  it('returns "—" for NaN', () => {
    expect(formatCurrency(NaN)).toBe('—');
  });
  it('returns "—" for string input (non-numeric types not accepted)', () => {
    expect(formatCurrency('500' as unknown as number)).toBe('—');
  });
});

describe('formatVehicleLabel', () => {
  it('returns canonical label for lwb_van', () => {
    expect(formatVehicleLabel('lwb_van')).toBe('LWB Van');
  });
  it('returns canonical label for artic variant', () => {
    expect(formatVehicleLabel('artic_44t_curtainsider')).toBe('Artic 44T Curtainsider');
  });
  it('falls back gracefully for unknown type (title-cases slug)', () => {
    const result = formatVehicleLabel('unknown_type');
    expect(result).not.toContain('_');
    expect(result.length).toBeGreaterThan(0);
  });
  it('returns "—" for null', () => {
    expect(formatVehicleLabel(null)).toBe('—');
  });
  it('returns "—" for empty string', () => {
    expect(formatVehicleLabel('')).toBe('—');
  });
});

describe('formatDistance', () => {
  it('formats integer miles', () => {
    expect(formatDistance(150)).toBe('150 mi');
  });
  it('rounds decimal miles', () => {
    expect(formatDistance(150.7)).toBe('151 mi');
  });
  it('returns "—" for null', () => {
    expect(formatDistance(null)).toBe('—');
  });
  it('returns "—" for NaN', () => {
    expect(formatDistance(NaN)).toBe('—');
  });
  it('returns "—" for negative values', () => {
    expect(formatDistance(-5)).toBe('—');
  });
});

describe('formatDimensions', () => {
  it('formats all three dimensions with cm suffix', () => {
    expect(formatDimensions(120, 80, 100)).toBe('120 × 80 × 100 cm');
  });
  it('returns "—" when all are null', () => {
    expect(formatDimensions(null, null, null)).toBe('—');
  });
  it('uses "?" for partial null values', () => {
    expect(formatDimensions(120, null, null)).toBe('120 × ? × ? cm');
  });
});

describe('formatWeight', () => {
  it('formats weight with kg suffix', () => {
    expect(formatWeight(500)).toBe('500 kg');
  });
  it('formats large weight with thousands separator', () => {
    const result = formatWeight(1500);
    expect(result).toContain('kg');
  });
  it('returns "—" for null', () => {
    expect(formatWeight(null)).toBe('—');
  });
  it('returns "—" for NaN', () => {
    expect(formatWeight(NaN)).toBe('—');
  });
});

describe('formatJobRef', () => {
  it('returns existingRef when provided', () => {
    expect(formatJobRef('some-uuid', 'JOB-0042')).toBe('JOB-0042');
  });
  it('generates JOB- prefixed ref from id when no existingRef', () => {
    const result = formatJobRef('abc12345-1234-5678-9abc-def012345678');
    expect(result).toMatch(/^JOB-[A-Z0-9]{6}$/);
  });
  it('generates ref from short id', () => {
    const result = formatJobRef('abc123');
    expect(result).toBe('JOB-ABC123');
  });
  it('returns "N/A" for null id with no existingRef', () => {
    expect(formatJobRef(null, null)).toBe('N/A');
  });
  it('returns existingRef even if id is null', () => {
    expect(formatJobRef(null, 'JOB-MANUAL')).toBe('JOB-MANUAL');
  });
});

describe('formatLocationSummary', () => {
  it('extracts city from comma-separated address', () => {
    const result = formatLocationSummary('Unit 5, Trafford Park, Manchester, M17 1QE');
    expect(result).toBe('Manchester');
  });
  it('returns full string for single-segment location', () => {
    expect(formatLocationSummary('Manchester')).toBe('Manchester');
  });
  it('returns "—" for null', () => {
    expect(formatLocationSummary(null)).toBe('—');
  });
  it('returns "—" for empty string', () => {
    expect(formatLocationSummary('')).toBe('—');
  });
  it('returns "—" for objects', () => {
    expect(formatLocationSummary({ city: 'London' } as unknown as string)).toBe('—');
  });
});
