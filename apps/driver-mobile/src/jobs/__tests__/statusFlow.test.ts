/**
 * Canonical lifecycle status tests.
 *
 * Verifies that:
 *  1. statusFlow uses the DB canonical status names (not legacy aliases).
 *  2. Forbidden legacy aliases are absent from statusFlow.
 *  3. statusFlow has the expected number of driver-executable steps.
 *  4. The ordered step list is correct.
 *  5. getNextStep maps pre-workflow entry statuses to the first step (accept).
 *  6. Full explicit transition matrix from allocated → delivered.
 *  7. getNextStep returns undefined after the final step (no runaway).
 *  8. posted and quoted are not driver-executable (return undefined).
 *  9. Unknown status does not crash and returns undefined.
 */

import { getNextStep, statusFlow } from '../statusFlow';
import type { CanonicalJobStatus } from '../types';

// ---------------------------------------------------------------------------
// 1. Canonical DB status names
// ---------------------------------------------------------------------------
describe('statusFlow canonical status names', () => {
  const canonicalStatuses: CanonicalJobStatus[] = [
    'accepted',
    'on_my_way_to_pickup',
    'on_site_pickup',
    'loaded',
    'on_my_way_to_delivery',
    'on_site_delivery',
    'delivered',
  ];

  test('all steps use canonical DB status names', () => {
    for (const step of statusFlow) {
      expect(canonicalStatuses).toContain(step.status);
    }
  });

  // 2. Forbidden legacy aliases
  test('legacy aliases on_my_way and in_transit are absent from statusFlow', () => {
    const forbiddenAliases = ['on_my_way', 'in_transit'];
    for (const step of statusFlow) {
      expect(forbiddenAliases).not.toContain(step.status);
    }
  });

  // 3. Step count
  test('statusFlow has exactly 7 driver-executable steps', () => {
    expect(statusFlow).toHaveLength(7);
  });

  // 4. Order
  test('statusFlow is ordered correctly', () => {
    expect(statusFlow.map((s) => s.status)).toEqual([
      'accepted',
      'on_my_way_to_pickup',
      'on_site_pickup',
      'loaded',
      'on_my_way_to_delivery',
      'on_site_delivery',
      'delivered',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 5. Pre-workflow entry statuses — first driver action is accept
// ---------------------------------------------------------------------------
describe('getNextStep — pre-workflow entry statuses', () => {
  test.each<CanonicalJobStatus>(['awarded', 'allocated'])(
    '%s maps to the accept step',
    (status) => {
      const step = getNextStep(status);
      expect(step).toBeDefined();
      expect(step?.status).toBe('accepted');
      expect(step?.endpoint).toBe('accept');
      expect(step?.requiresConfirmation).toBe(true);
    },
  );

  test('accepted maps to on_my_way_to_pickup (start physical workflow)', () => {
    const step = getNextStep('accepted');
    expect(step).toBeDefined();
    expect(step?.status).toBe('on_my_way_to_pickup');
    expect(step?.endpoint).toBe('on-my-way-pickup');
  });
});

// ---------------------------------------------------------------------------
// 6. Full transition matrix
// ---------------------------------------------------------------------------
describe('getNextStep — full transition matrix', () => {
  const expectedTransitions: Array<[CanonicalJobStatus, CanonicalJobStatus]> = [
    ['allocated',             'accepted'],
    ['accepted',              'on_my_way_to_pickup'],
    ['on_my_way_to_pickup',   'on_site_pickup'],
    ['on_site_pickup',        'loaded'],
    ['loaded',                'on_my_way_to_delivery'],
    ['on_my_way_to_delivery', 'on_site_delivery'],
    ['on_site_delivery',      'delivered'],
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
// 7. Terminal status
// ---------------------------------------------------------------------------
describe('getNextStep — terminal state', () => {
  test('delivered returns undefined (no further step)', () => {
    expect(getNextStep('delivered')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 8. Non-executable statuses
// ---------------------------------------------------------------------------
describe('getNextStep — non-executable statuses', () => {
  test.each<CanonicalJobStatus>(['posted', 'quoted'])(
    '%s returns undefined (not driver-executable)',
    (status) => {
      expect(getNextStep(status)).toBeUndefined();
    },
  );
});

// ---------------------------------------------------------------------------
// 9. Unknown / invalid status
// ---------------------------------------------------------------------------
describe('getNextStep — unknown status', () => {
  test('unknown status does not throw and returns undefined', () => {
    expect(() => getNextStep('unknown_status' as CanonicalJobStatus)).not.toThrow();
    expect(getNextStep('unknown_status' as CanonicalJobStatus)).toBeUndefined();
  });
});

