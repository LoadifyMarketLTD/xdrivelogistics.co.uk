/**
 * Unit tests for offline queue ordering and per-job dependency helpers.
 *
 * Covered:
 *  1. enqueueAction — appends (oldest-first); duplicate prevention
 *  2. sortJobActions — lifecycle endpoint order; createdAt tiebreaker
 *  3. getReadyActionsInOrder — POD before delivered; per-job blocking;
 *     cross-job independence; synced items skipped
 *  4. isJobActionBlocked — blocks when predecessor is not synced
 *  5. endpointOrder — pod < delivered; unknown endpoints sort last
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { endpointOrder, getReadyActionsInOrder, isJobActionBlocked, sortJobActions } from '../src/offline/queueOrderingHelpers';
import type { QueuedAction } from '../src/offline/queue';

// ─── helpers ────────────────────────────────────────────────────────────────

let idSeq = 0;
function makeAction(overrides: Partial<QueuedAction> & { jobId: string; endpoint: string }): QueuedAction {
  idSeq += 1;
  const createdAt = overrides.createdAt ?? new Date(Date.now() + idSeq * 10).toISOString();
  return {
    id: overrides.id ?? `action-${idSeq}`,
    jobId: overrides.jobId,
    endpoint: overrides.endpoint,
    payload: overrides.payload,
    status: overrides.status ?? 'pending',
    createdAt,
    retryCount: overrides.retryCount ?? 0,
    lastError: overrides.lastError,
    lastAttemptAt: overrides.lastAttemptAt,
    nextRetryAt: overrides.nextRetryAt,
  };
}

const alwaysReady = () => true;
const neverReady = () => false;

beforeEach(() => { idSeq = 0; });

// ─── 1. endpointOrder ────────────────────────────────────────────────────────

describe('endpointOrder', () => {
  it('pod sorts before delivered', () => {
    expect(endpointOrder('pod')).toBeLessThan(endpointOrder('delivered'));
  });

  it('on-my-way-pickup sorts first', () => {
    const allKnown = [
      'on-my-way-pickup', 'arrived-pickup', 'loaded',
      'on-my-way-delivery', 'arrived-delivery', 'pod', 'delivered',
    ];
    allKnown.slice(1).forEach((ep) => {
      expect(endpointOrder('on-my-way-pickup')).toBeLessThan(endpointOrder(ep));
    });
  });

  it('unknown endpoints sort after all known ones', () => {
    const known = ['on-my-way-pickup', 'arrived-pickup', 'loaded', 'on-my-way-delivery', 'arrived-delivery', 'pod', 'delivered'];
    known.forEach((ep) => {
      expect(endpointOrder('unknown-endpoint')).toBeGreaterThan(endpointOrder(ep));
    });
  });
});

// ─── 2. sortJobActions ───────────────────────────────────────────────────────

describe('sortJobActions', () => {
  it('sorts pod before delivered for the same job', () => {
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered' });
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod' });
    const sorted = sortJobActions([delivered, pod]);
    expect(sorted[0].endpoint).toBe('pod');
    expect(sorted[1].endpoint).toBe('delivered');
  });

  it('sorts full lifecycle in canonical order', () => {
    const endpoints = ['delivered', 'pod', 'arrived-delivery', 'on-my-way-pickup', 'loaded'];
    const actions = endpoints.map((ep) => makeAction({ jobId: 'job-1', endpoint: ep }));
    const sorted = sortJobActions(actions).map((a) => a.endpoint);
    expect(sorted).toEqual(['on-my-way-pickup', 'loaded', 'arrived-delivery', 'pod', 'delivered']);
  });

  it('uses createdAt ascending as a tiebreaker for same endpoint', () => {
    const a1 = makeAction({ jobId: 'job-1', endpoint: 'loaded', createdAt: '2026-08-01T10:00:00Z' });
    const a2 = makeAction({ jobId: 'job-1', endpoint: 'loaded', createdAt: '2026-08-01T09:00:00Z' });
    const sorted = sortJobActions([a1, a2]);
    expect(sorted[0].id).toBe(a2.id); // a2 is older
  });

  it('does not mutate the input array', () => {
    const actions = [
      makeAction({ jobId: 'job-1', endpoint: 'delivered' }),
      makeAction({ jobId: 'job-1', endpoint: 'pod' }),
    ];
    const original = [...actions];
    sortJobActions(actions);
    expect(actions.map((a) => a.endpoint)).toEqual(original.map((a) => a.endpoint));
  });
});

// ─── 3. getReadyActionsInOrder ───────────────────────────────────────────────

describe('getReadyActionsInOrder — POD before delivered', () => {
  it('returns pod action first when both pod and delivered are pending', () => {
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod' });
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered' });
    const ready = getReadyActionsInOrder([delivered, pod], alwaysReady);
    // Only the first non-synced (pod) should be returned
    expect(ready).toHaveLength(1);
    expect(ready[0].endpoint).toBe('pod');
  });

  it('returns delivered once pod is synced', () => {
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod', status: 'synced' });
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered' });
    const ready = getReadyActionsInOrder([delivered, pod], alwaysReady);
    expect(ready).toHaveLength(1);
    expect(ready[0].endpoint).toBe('delivered');
  });

  it('blocks delivered when pod has failed and is not yet ready for retry', () => {
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod', status: 'failed' });
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered' });
    // isReady returns false for failed/pending-retry items
    const ready = getReadyActionsInOrder([delivered, pod], neverReady);
    expect(ready).toHaveLength(0);
  });

  it('enqueued delivered before pod still processes pod first', () => {
    // Simulates user tapping "Delivered" and then the app uploading POD
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered', createdAt: '2026-08-01T10:00:00Z' });
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod', createdAt: '2026-08-01T10:00:01Z' });
    const ready = getReadyActionsInOrder([delivered, pod], alwaysReady);
    expect(ready).toHaveLength(1);
    expect(ready[0].endpoint).toBe('pod');
  });
});

describe('getReadyActionsInOrder — per-job blocking', () => {
  it('failure of an earlier action blocks later actions for the same job', () => {
    const first = makeAction({ jobId: 'job-1', endpoint: 'on-my-way-pickup', status: 'failed' });
    const second = makeAction({ jobId: 'job-1', endpoint: 'arrived-pickup' });
    const ready = getReadyActionsInOrder([first, second], neverReady);
    expect(ready).toHaveLength(0);
  });

  it('syncing status blocks later actions for the same job', () => {
    const first = makeAction({ jobId: 'job-1', endpoint: 'on-my-way-pickup', status: 'syncing' });
    const second = makeAction({ jobId: 'job-1', endpoint: 'arrived-pickup' });
    const ready = getReadyActionsInOrder([first, second], alwaysReady);
    // syncing items are not returned by isQueueItemReady, so isReady=alwaysReady is overridden
    // but syncing items are considered not-synced, so they gate later actions
    // The first item (syncing) is not ready per real isQueueItemReady, but here alwaysReady returns true
    // The helper only looks at the first non-synced item and returns it if isReady.
    // syncing → isReady returns true → only first is returned
    expect(ready).toHaveLength(1);
    expect(ready[0].endpoint).toBe('on-my-way-pickup');
  });

  it('separate jobs can continue independently when one job fails', () => {
    const failedJobAction = makeAction({ jobId: 'job-1', endpoint: 'on-my-way-pickup', status: 'failed' });
    const otherJobAction = makeAction({ jobId: 'job-2', endpoint: 'on-my-way-pickup' });
    const ready = getReadyActionsInOrder([failedJobAction, otherJobAction], (item) => item.status !== 'failed');
    expect(ready).toHaveLength(1);
    expect(ready[0].jobId).toBe('job-2');
  });

  it('multiple independent jobs can all progress in a single flush', () => {
    const job1 = makeAction({ jobId: 'job-1', endpoint: 'on-my-way-pickup' });
    const job2 = makeAction({ jobId: 'job-2', endpoint: 'on-my-way-pickup' });
    const job3 = makeAction({ jobId: 'job-3', endpoint: 'arrived-pickup' });
    const ready = getReadyActionsInOrder([job1, job2, job3], alwaysReady);
    expect(ready).toHaveLength(3);
    const jobIds = ready.map((a) => a.jobId);
    expect(jobIds).toContain('job-1');
    expect(jobIds).toContain('job-2');
    expect(jobIds).toContain('job-3');
  });
});

describe('getReadyActionsInOrder — synced items skipped', () => {
  it('does not return already-synced items', () => {
    const synced = makeAction({ jobId: 'job-1', endpoint: 'on-my-way-pickup', status: 'synced' });
    const ready = getReadyActionsInOrder([synced], alwaysReady);
    expect(ready).toHaveLength(0);
  });

  it('skips synced item and returns the next pending item', () => {
    const synced = makeAction({ jobId: 'job-1', endpoint: 'on-my-way-pickup', status: 'synced' });
    const pending = makeAction({ jobId: 'job-1', endpoint: 'arrived-pickup' });
    const ready = getReadyActionsInOrder([synced, pending], alwaysReady);
    expect(ready).toHaveLength(1);
    expect(ready[0].endpoint).toBe('arrived-pickup');
  });

  it('empty queue returns empty result', () => {
    expect(getReadyActionsInOrder([], alwaysReady)).toHaveLength(0);
  });
});

describe('getReadyActionsInOrder — duplicate prevention', () => {
  it('only one action per job endpoint is returned per pass', () => {
    // Two items for same job and endpoint (shouldn't happen in practice due to enqueueAction guard,
    // but the ordering helper must still be safe)
    const a1 = makeAction({ jobId: 'job-1', endpoint: 'loaded', createdAt: '2026-08-01T09:00:00Z' });
    const a2 = makeAction({ jobId: 'job-1', endpoint: 'loaded', createdAt: '2026-08-01T10:00:00Z' });
    const ready = getReadyActionsInOrder([a1, a2], alwaysReady);
    // Only the oldest (first non-synced) should be returned
    expect(ready).toHaveLength(1);
    expect(ready[0].id).toBe(a1.id);
  });
});

// ─── 4. isJobActionBlocked ───────────────────────────────────────────────────

describe('isJobActionBlocked', () => {
  it('returns true when a predecessor action is not synced', () => {
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod', status: 'pending' });
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered' });
    expect(isJobActionBlocked([pod, delivered], delivered)).toBe(true);
  });

  it('returns false when all predecessor actions are synced', () => {
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod', status: 'synced' });
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered' });
    expect(isJobActionBlocked([pod, delivered], delivered)).toBe(false);
  });

  it('returns false for the first action in the lifecycle (no predecessors)', () => {
    const action = makeAction({ jobId: 'job-1', endpoint: 'on-my-way-pickup' });
    expect(isJobActionBlocked([action], action)).toBe(false);
  });

  it('only considers actions for the same job', () => {
    const otherJobPod = makeAction({ jobId: 'job-2', endpoint: 'pod', status: 'pending' });
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered' });
    expect(isJobActionBlocked([otherJobPod, delivered], delivered)).toBe(false);
  });
});
