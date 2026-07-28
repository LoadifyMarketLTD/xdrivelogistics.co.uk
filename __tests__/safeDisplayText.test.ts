import { describe, it, expect } from 'vitest';
import { safeDisplayText } from '../lib/safeDisplayText';

describe('safeDisplayText', () => {
  // --- string inputs ---
  it('returns trimmed non-empty string', () => {
    expect(safeDisplayText('  hello  ')).toBe('hello');
  });

  it('returns fallback for empty string', () => {
    expect(safeDisplayText('')).toBe('—');
  });

  it('returns fallback for whitespace-only string', () => {
    expect(safeDisplayText('   ')).toBe('—');
  });

  it('accepts custom fallback for empty string', () => {
    expect(safeDisplayText('', 'N/A')).toBe('N/A');
  });

  // --- finite number ---
  it('converts finite number to string', () => {
    expect(safeDisplayText(42)).toBe('42');
  });

  it('converts zero to string', () => {
    expect(safeDisplayText(0)).toBe('0');
  });

  it('converts negative finite number to string', () => {
    expect(safeDisplayText(-7.5)).toBe('-7.5');
  });

  // --- non-finite numbers ---
  it('returns fallback for NaN', () => {
    expect(safeDisplayText(NaN)).toBe('—');
  });

  it('returns fallback for Infinity', () => {
    expect(safeDisplayText(Infinity)).toBe('—');
  });

  it('returns fallback for -Infinity', () => {
    expect(safeDisplayText(-Infinity)).toBe('—');
  });

  // --- null / undefined ---
  it('returns fallback for null', () => {
    expect(safeDisplayText(null)).toBe('—');
  });

  it('returns fallback for undefined', () => {
    expect(safeDisplayText(undefined)).toBe('—');
  });

  // --- objects / arrays / other types ---
  it('returns fallback for plain object (never JSON.stringify)', () => {
    const result = safeDisplayText({ source: 'customer_workspace_v2', targetCarrierCost: null });
    expect(result).toBe('—');
    expect(result).not.toContain('{');
    expect(result).not.toContain('source');
  });

  it('returns fallback for array', () => {
    expect(safeDisplayText(['a', 'b'])).toBe('—');
  });

  it('returns fallback for boolean true', () => {
    expect(safeDisplayText(true)).toBe('—');
  });

  it('returns fallback for boolean false', () => {
    expect(safeDisplayText(false)).toBe('—');
  });

  it('returns fallback for function', () => {
    expect(safeDisplayText(() => 'x')).toBe('—');
  });

  it('returns fallback for Symbol', () => {
    expect(safeDisplayText(Symbol('test'))).toBe('—');
  });

  it('returns fallback for BigInt', () => {
    expect(safeDisplayText(BigInt(9007199254740991))).toBe('—');
  });
});
