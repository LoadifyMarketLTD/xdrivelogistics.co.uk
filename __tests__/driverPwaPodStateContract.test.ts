import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isDriverPodComplete } from '../lib/jobs/driverPodCompletion';

describe('Driver PWA POD state', () => {
  it('keeps unsigned delivery evidence pending', () => {
    expect(isDriverPodComplete({ pod_generated: false })).toBe(false);
    expect(isDriverPodComplete({ pod_generated: null })).toBe(false);
    expect(isDriverPodComplete({})).toBe(false);
  });

  it('requires the persisted POD completion flag, not an inferred photo state', () => {
    expect(isDriverPodComplete({ pod_generated: true })).toBe(true);
  });

  it('uses the canonical POD flag in both bookings list and detail APIs', () => {
    const list = readFileSync('app/api/driver/web/jobs/route.ts', 'utf8');
    const detail = readFileSync('app/api/driver/web/jobs/[id]/route.ts', 'utf8');
    expect(list).toContain('podGenerated: isDriverPodComplete(row)');
    expect(detail).toContain('podCompleted: isDriverPodComplete(row)');
  });
});
