/**
 * Canonical lifecycle status tests.
 *
 * Verifies that:
 *  1. statusFlow uses DB canonical status names (not mobile aliases).
 *  2. getNextStep correctly maps pre-workflow statuses → first step.
 *  3. Full transition matrix proceeds in the correct order.
 *  4. getNextStep returns undefined after the final step (no runaway).
 *  5. Unknown status does not crash and returns undefined.
 */

import { getNextStep, statusFlow } from '../statusFlow';
import type { CanonicalJobStatus } from '../types';

// ---------------------------------------------------------------------------
// 1. Canonical DB status names
// ---------------------------------------------------------------------------
describe('statusFlow canonical status names', () => {
  const canonicalStatuses = ['on_my_way', 'on_site_pickup', 'loaded', 'in_transit', 'on_site_delivery', 'delivered'];
  const forbiddenAliases = ['on_my_way_pickup', 'arrived_pickup', 'on_my_way_delivery', 'arrived_delivery'];

  test('all steps use canonical DB status names', () => {
    for (const step of statusFlow) {
      expect(canonicalStatuses).toContain(step.status);
    }
  });

  test('no step uses a legacy mobile alias', () => {
    for (const step of statusFlow) {
      expect(forbiddenAliases).not.toContain(step.status);
    }
  });

  test('statusFlow has exactly 6 steps', () => {
    expect(statusFlow).toHaveLength(6);
  });

  test('statusFlow is ordered correctly', () => {
    expect(statusFlow.map((s) => s.status)).toEqual([
      'on_my_way',
      'on_site_pickup',
      'loaded',
      'in_transit',
      'on_site_delivery',
      'delivered',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. Pre-workflow status entry points
// ---------------------------------------------------------------------------
describe('getNextStep — pre-workflow entry statuses', () => {
  test.each<CanonicalJobStatus>(['awarded', 'allocated', 'accepted'])(
    '%s maps to the first workflow step (on_my_way)',
    (status) => {
      const step = getNextStep(status);
      expect(step).toBeDefined();
      expect(step?.status).toBe('on_my_way');
      expect(step?.endpoint).toBe('on-my-way-pickup');
    },
  );
});

// ---------------------------------------------------------------------------
// 3. Full transition matrix
// ---------------------------------------------------------------------------
describe('getNextStep — full transition matrix', () => {
  const expectedTransitions: Array<[CanonicalJobStatus, CanonicalJobStatus]> = [
    ['on_my_way', 'on_site_pickup'],
    ['on_site_pickup', 'loaded'],
    ['loaded', 'in_transit'],
    ['in_transit', 'on_site_delivery'],
    ['on_site_delivery', 'delivered'],
  ];

  test.each(expectedTransitions)(
    '%s → %s',
    (from, to) => {
      const step = getNextStep(from);
      expect(step?.status).toBe(to);
    },
  );
});

// ---------------------------------------------------------------------------
// 4. Terminal status returns undefined
// ---------------------------------------------------------------------------
describe('getNextStep — terminal state', () => {
  test('delivered returns undefined (no further step)', () => {
    expect(getNextStep('delivered')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Unknown / invalid status
// ---------------------------------------------------------------------------
describe('getNextStep — unknown status', () => {
  test('unknown status does not throw and returns undefined', () => {
    expect(() => getNextStep('unknown_status' as CanonicalJobStatus)).not.toThrow();
    expect(getNextStep('unknown_status' as CanonicalJobStatus)).toBeUndefined();
  });
});
