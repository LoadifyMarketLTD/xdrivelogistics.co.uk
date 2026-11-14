import { describe, expect, it } from 'vitest';
import {
  convertPostLoadMeasurement,
  displayPostLoadMeasurement,
} from '../lib/postLoadUnits';
import fs from 'node:fs';
import path from 'node:path';

describe('Post Load unit selection preserves canonical database units', () => {
  it('converts weight from lbs to kg', () => {
    expect(Number(convertPostLoadMeasurement('10', 'lb', 'kg'))).toBeCloseTo(4.535924, 5);
  });

  it('converts tonne to kg', () => {
    expect(convertPostLoadMeasurement('1.5', 't', 'kg')).toBe('1500');
  });

  it('converts metres, inches, and feet to cm', () => {
    expect(convertPostLoadMeasurement('1.2', 'm', 'cm')).toBe('120');
    expect(convertPostLoadMeasurement('12', 'in', 'cm')).toBe('30.48');
    expect(convertPostLoadMeasurement('4', 'ft', 'cm')).toBe('121.92');
  });

  it('converts canonical dimensions back to the selected display unit', () => {
    expect(displayPostLoadMeasurement('304.8', 'ft', 'cm')).toBe('10');
    expect(displayPostLoadMeasurement('150', 'm', 'cm')).toBe('1.5');
  });

  it('preserves blank inputs and does not turn malformed input into a valid measurement', () => {
    expect(convertPostLoadMeasurement('', 'lb', 'kg')).toBe('');
    expect(displayPostLoadMeasurement('', 'in', 'cm')).toBe('');
    expect(convertPostLoadMeasurement('-10', 'lb', 'kg')).toBe('-10');
    expect(convertPostLoadMeasurement('invalid', 'ft', 'cm')).toBe('invalid');
  });

  it('does not change API or data contract for weight/dimensions', () => {
    const root = process.cwd();
    const src = fs.readFileSync(path.join(root, 'app/components/workspace/LoadPostingForm.tsx'), 'utf8');
    expect(src).toContain('weightKg: numberOrNull(form.weight)');
    expect(src).toContain('lengthCm: numberOrNull(form.length)');
    expect(src).toContain('widthCm: numberOrNull(form.width)');
    expect(src).toContain('heightCm: numberOrNull(form.height)');
    expect(src).toContain('aria-label="Weight unit"');
    expect(src).toContain('aria-label="Dimension unit"');
  });
});
