/**
 * Unit tests for the driver-mobile status flow module.
 *
 * Covered:
 *  1. statusFlow array — expected order, labels, and backendOnly flags
 *  2. getNextStep — returns correct next step, skips backend-only steps,
 *     returns undefined at end of driver-visible flow
 *  3. canTransitionTo — blocks skipped steps, blocks backend-only transitions,
 *     always blocks 'completed'
 *  4. statusIndex — consistent ordering
 *  5. isStatusAtLeast — comparison helper
 *  6. FULL_TIMELINE — contains all statuses in correct order
 */
import { describe, expect, it } from 'vitest';

// The status flow module lives in the driver-mobile package.
// We import it via a relative path from the repo root.
import {
  FULL_TIMELINE,
  canTransitionTo,
  getNextStep,
  isStatusAtLeast,
  statusFlow,
  statusIndex,
} from '../apps/driver-mobile/src/jobs/statusFlow';
import type { CanonicalJobStatus } from '../apps/driver-mobile/src/jobs/types';

// ─── 1. statusFlow array ────────────────────────────────────────────────────

describe('statusFlow array', () => {
  it('starts with on_my_way_pickup', () => {
    expect(statusFlow[0].status).toBe('on_my_way_pickup');
  });

  it('last driver-visible step is arrived_delivery or delivered (requiresPod)', () => {
    const driverVisible = statusFlow.filter((s) => !s.backendOnly);
    const last = driverVisible[driverVisible.length - 1];
    expect(last.status).toBe('delivered');
    expect(last.requiresPod).toBe(true);
  });

  it('pod_completed, invoice_generated, completed are all backendOnly', () => {
    const backendSteps = statusFlow.filter((s) => s.backendOnly).map((s) => s.status);
    expect(backendSteps).toContain('pod_completed');
    expect(backendSteps).toContain('invoice_generated');
    expect(backendSteps).toContain('completed');
  });

  it('no duplicate statuses', () => {
    const statuses = statusFlow.map((s) => s.status);
    expect(new Set(statuses).size).toBe(statuses.length);
  });
});

// ─── 2. getNextStep ─────────────────────────────────────────────────────────

describe('getNextStep', () => {
  it('returns on_my_way_pickup as first step when awarded', () => {
    const step = getNextStep('awarded');
    expect(step?.status).toBe('on_my_way_pickup');
  });

  it('advances through each driver-visible step in sequence', () => {
    const chain: CanonicalJobStatus[] = [
      'on_my_way_pickup',
      'arrived_pickup',
      'loaded',
      'on_my_way_delivery',
      'arrived_delivery',
    ];
    chain.forEach((status, i) => {
      if (i < chain.length - 1) {
        const next = getNextStep(status);
        expect(next?.status).toBe(chain[i + 1]);
      }
    });
  });

  it('returns delivered (with requiresPod) as next after arrived_delivery', () => {
    const step = getNextStep('arrived_delivery');
    expect(step?.status).toBe('delivered');
    expect(step?.requiresPod).toBe(true);
  });

  it('returns undefined after delivered (next step is backend-only pod_completed)', () => {
    expect(getNextStep('delivered')).toBeUndefined();
  });

  it('returns undefined for backend-only statuses', () => {
    expect(getNextStep('pod_completed')).toBeUndefined();
    expect(getNextStep('invoice_generated')).toBeUndefined();
    expect(getNextStep('completed')).toBeUndefined();
  });
});

// ─── 3. canTransitionTo ──────────────────────────────────────────────────────

describe('canTransitionTo', () => {
  it('allows each valid sequential driver transition', () => {
    const validPairs: Array<[CanonicalJobStatus, CanonicalJobStatus]> = [
      ['awarded', 'on_my_way_pickup'],
      ['on_my_way_pickup', 'arrived_pickup'],
      ['arrived_pickup', 'loaded'],
      ['loaded', 'on_my_way_delivery'],
      ['on_my_way_delivery', 'arrived_delivery'],
      ['arrived_delivery', 'delivered'],
    ];
    validPairs.forEach(([current, next]) => {
      expect(canTransitionTo(current, next)).toBe(true);
    });
  });

  it('blocks skipping a step', () => {
    expect(canTransitionTo('awarded', 'arrived_pickup')).toBe(false);
    expect(canTransitionTo('awarded', 'loaded')).toBe(false);
    expect(canTransitionTo('on_my_way_pickup', 'loaded')).toBe(false);
    expect(canTransitionTo('loaded', 'arrived_delivery')).toBe(false);
    expect(canTransitionTo('arrived_pickup', 'on_my_way_delivery')).toBe(false);
  });

  it('blocks going backwards', () => {
    expect(canTransitionTo('loaded', 'arrived_pickup')).toBe(false);
    expect(canTransitionTo('delivered', 'arrived_delivery')).toBe(false);
  });

  it('blocks same-status transition', () => {
    expect(canTransitionTo('loaded', 'loaded')).toBe(false);
    expect(canTransitionTo('awarded', 'awarded')).toBe(false);
  });

  it('always blocks completed regardless of current status', () => {
    const allStatuses: CanonicalJobStatus[] = [
      'awarded', 'on_my_way_pickup', 'arrived_pickup', 'loaded',
      'on_my_way_delivery', 'arrived_delivery', 'delivered',
      'pod_completed', 'invoice_generated', 'completed',
    ];
    allStatuses.forEach((s) => {
      expect(canTransitionTo(s, 'completed')).toBe(false);
    });
  });

  it('blocks invoice_generated because it is backendOnly', () => {
    expect(canTransitionTo('pod_completed', 'invoice_generated')).toBe(false);
  });

  it('blocks pod_completed because it is backendOnly', () => {
    expect(canTransitionTo('delivered', 'pod_completed')).toBe(false);
  });
});

// ─── 4. statusIndex ──────────────────────────────────────────────────────────

describe('statusIndex', () => {
  it('awarded has a lower index than on_my_way_pickup', () => {
    expect(statusIndex('awarded')).toBeLessThan(statusIndex('on_my_way_pickup'));
  });

  it('delivered has a lower index than pod_completed', () => {
    expect(statusIndex('delivered')).toBeLessThan(statusIndex('pod_completed'));
  });

  it('completed has the highest index', () => {
    const allStatuses: CanonicalJobStatus[] = [
      'awarded', 'on_my_way_pickup', 'arrived_pickup', 'loaded',
      'on_my_way_delivery', 'arrived_delivery', 'delivered',
      'pod_completed', 'invoice_generated',
    ];
    allStatuses.forEach((s) => {
      expect(statusIndex(s)).toBeLessThan(statusIndex('completed'));
    });
  });
});

// ─── 5. isStatusAtLeast ──────────────────────────────────────────────────────

describe('isStatusAtLeast', () => {
  it('returns true when current equals target', () => {
    expect(isStatusAtLeast('delivered', 'delivered')).toBe(true);
  });

  it('returns true when current is further along than target', () => {
    expect(isStatusAtLeast('pod_completed', 'delivered')).toBe(true);
    expect(isStatusAtLeast('completed', 'awarded')).toBe(true);
  });

  it('returns false when current is behind target', () => {
    expect(isStatusAtLeast('loaded', 'delivered')).toBe(false);
    expect(isStatusAtLeast('awarded', 'on_my_way_pickup')).toBe(false);
  });
});

// ─── 6. FULL_TIMELINE ───────────────────────────────────────────────────────

describe('FULL_TIMELINE', () => {
  it('starts with awarded (Accepted)', () => {
    expect(FULL_TIMELINE[0].status).toBe('awarded');
  });

  it('ends with completed', () => {
    expect(FULL_TIMELINE[FULL_TIMELINE.length - 1].status).toBe('completed');
  });

  it('contains all 10 lifecycle statuses', () => {
    const statuses = FULL_TIMELINE.map((s) => s.status);
    const expected: CanonicalJobStatus[] = [
      'awarded', 'on_my_way_pickup', 'arrived_pickup', 'loaded',
      'on_my_way_delivery', 'arrived_delivery', 'delivered',
      'pod_completed', 'invoice_generated', 'completed',
    ];
    expect(statuses).toEqual(expected);
  });

  it('has no duplicate entries', () => {
    const statuses = FULL_TIMELINE.map((s) => s.status);
    expect(new Set(statuses).size).toBe(statuses.length);
  });

  it('every entry has a non-empty label', () => {
    FULL_TIMELINE.forEach((entry) => {
      expect(entry.label.trim().length).toBeGreaterThan(0);
    });
  });
});
