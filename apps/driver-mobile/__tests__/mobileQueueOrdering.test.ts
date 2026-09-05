/**
 * Unit tests for offline queue ordering and per-job dependency helpers.
 *
 * Covered:
 *  1. endpointOrder — canonical lifecycle including stop-status before POD
 *  2. sortJobActions — lifecycle endpoint order; createdAt tiebreaker
 *  3. getReadyActionsInOrder — stops before POD before delivered; per-job blocking;
 *     cross-job independence; synced items skipped
 *  4. isJobActionBlocked — blocks when any earlier sorted action is not synced
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { endpointOrder, getReadyActionsInOrder, isJobActionBlocked, sortJobActions } from '../src/offline/queueOrderingHelpers';
import type { QueuedAction } from '../src/offline/queue';

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

describe('endpointOrder', () => {
  it('multi-drop stop-status sorts before POD and delivered', () => {
    expect(endpointOrder('stop-status')).toBeLessThan(endpointOrder('pod'));
    expect(endpointOrder('stop-status')).toBeLessThan(endpointOrder('delivered'));
    expect(endpointOrder('pod')).toBeLessThan(endpointOrder('delivered'));
  });

  it('on-my-way-pickup sorts first', () => {
    const allKnown = [
      'on-my-way-pickup', 'arrived-pickup', 'loaded',
      'on-my-way-delivery', 'arrived-delivery', 'stop-status', 'pod', 'delivered',
    ];
    allKnown.slice(1).forEach((ep) => {
      expect(endpointOrder('on-my-way-pickup')).toBeLessThan(endpointOrder(ep));
    });
  });

  it('unknown endpoints sort after all known ones', () => {
    const known = [
      'on-my-way-pickup', 'arrived-pickup', 'loaded',
      'on-my-way-delivery', 'arrived-delivery', 'stop-status', 'pod', 'delivered',
    ];
    known.forEach((ep) => {
      expect(endpointOrder('unknown-endpoint')).toBeGreaterThan(endpointOrder(ep));
    });
  });
});

describe('sortJobActions', () => {
  it('sorts all stop updates before pod and delivered for the same job', () => {
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered', createdAt: '2026-08-01T10:00:00Z' });
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod', createdAt: '2026-08-01T09:59:00Z' });
    const stopArrived = makeAction({
      jobId: 'job-1',
      endpoint: 'stop-status',
      payload: { stop_id: 'stop-1', status: 'arrived' },
      createdAt: '2026-08-01T09:57:00Z',
    });
    const stopCompleted = makeAction({
      jobId: 'job-1',
      endpoint: 'stop-status',
      payload: { stop_id: 'stop-1', status: 'completed' },
      createdAt: '2026-08-01T09:58:00Z',
    });
    const sorted = sortJobActions([delivered, pod, stopCompleted, stopArrived]);
    expect(sorted.map((item) => item.endpoint)).toEqual(['stop-status', 'stop-status', 'pod', 'delivered']);
    expect(sorted[0].payload?.status).toBe('arrived');
    expect(sorted[1].payload?.status).toBe('completed');
  });

  it('sorts full lifecycle in canonical order', () => {
    const endpoints = ['delivered', 'pod', 'stop-status', 'arrived-delivery', 'on-my-way-pickup', 'loaded'];
    const actions = endpoints.map((ep) => makeAction({ jobId: 'job-1', endpoint: ep }));
    const sorted = sortJobActions(actions).map((a) => a.endpoint);
    expect(sorted).toEqual(['on-my-way-pickup', 'loaded', 'arrived-delivery', 'stop-status', 'pod', 'delivered']);
  });

  it('uses createdAt ascending as a tiebreaker for same endpoint', () => {
    const a1 = makeAction({ jobId: 'job-1', endpoint: 'stop-status', createdAt: '2026-08-01T10:00:00Z' });
    const a2 = makeAction({ jobId: 'job-1', endpoint: 'stop-status', createdAt: '2026-08-01T09:00:00Z' });
    const sorted = sortJobActions([a1, a2]);
    expect(sorted[0].id).toBe(a2.id);
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

describe('getReadyActionsInOrder — stop-status before POD before delivered', () => {
  it('returns the oldest stop update before POD even if POD was enqueued earlier', () => {
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod', createdAt: '2026-08-01T09:00:00Z' });
    const stop = makeAction({
      jobId: 'job-1',
      endpoint: 'stop-status',
      payload: { stop_id: 'stop-1', status: 'arrived' },
      createdAt: '2026-08-01T10:00:00Z',
    });
    const ready = getReadyActionsInOrder([pod, stop], alwaysReady);
    expect(ready).toHaveLength(1);
    expect(ready[0].endpoint).toBe('stop-status');
  });

  it('keeps multiple stop updates in creation order before POD', () => {
    const firstStop = makeAction({
      jobId: 'job-1',
      endpoint: 'stop-status',
      payload: { stop_id: 'stop-1', status: 'arrived' },
      createdAt: '2026-08-01T09:00:00Z',
    });
    const secondStop = makeAction({
      jobId: 'job-1',
      endpoint: 'stop-status',
      payload: { stop_id: 'stop-1', status: 'completed' },
      createdAt: '2026-08-01T09:01:00Z',
    });
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod', createdAt: '2026-08-01T09:02:00Z' });

    let queue = [pod, secondStop, firstStop];
    let ready = getReadyActionsInOrder(queue, alwaysReady);
    expect(ready[0].id).toBe(firstStop.id);

    queue = queue.map((item) => item.id === firstStop.id ? { ...item, status: 'synced' as const } : item);
    ready = getReadyActionsInOrder(queue, alwaysReady);
    expect(ready[0].id).toBe(secondStop.id);

    queue = queue.map((item) => item.id === secondStop.id ? { ...item, status: 'synced' as const } : item);
    ready = getReadyActionsInOrder(queue, alwaysReady);
    expect(ready[0].endpoint).toBe('pod');
  });

  it('returns delivered once stop updates and pod are synced', () => {
    const stop = makeAction({ jobId: 'job-1', endpoint: 'stop-status', status: 'synced' });
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod', status: 'synced' });
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered' });
    const ready = getReadyActionsInOrder([delivered, stop, pod], alwaysReady);
    expect(ready).toHaveLength(1);
    expect(ready[0].endpoint).toBe('delivered');
  });

  it('blocks POD when an earlier stop update failed and is not ready for retry', () => {
    const stop = makeAction({ jobId: 'job-1', endpoint: 'stop-status', status: 'failed' });
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod' });
    const ready = getReadyActionsInOrder([pod, stop], neverReady);
    expect(ready).toHaveLength(0);
  });

  it('enqueued delivered before pod still processes pod first when there are no stops', () => {
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

  it('separate jobs can continue independently when one job fails', () => {
    const failedJobAction = makeAction({ jobId: 'job-1', endpoint: 'stop-status', status: 'failed' });
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

describe('isJobActionBlocked', () => {
  it('blocks POD while an earlier stop update is unsynced', () => {
    const stop = makeAction({ jobId: 'job-1', endpoint: 'stop-status', status: 'pending' });
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod' });
    expect(isJobActionBlocked([pod, stop], pod)).toBe(true);
  });

  it('blocks the later stop-status action while an older stop-status action is unsynced', () => {
    const first = makeAction({
      jobId: 'job-1', endpoint: 'stop-status', status: 'pending', createdAt: '2026-08-01T09:00:00Z',
    });
    const second = makeAction({
      jobId: 'job-1', endpoint: 'stop-status', status: 'pending', createdAt: '2026-08-01T09:01:00Z',
    });
    expect(isJobActionBlocked([second, first], second)).toBe(true);
  });

  it('returns false when all predecessor actions are synced', () => {
    const stop = makeAction({ jobId: 'job-1', endpoint: 'stop-status', status: 'synced' });
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod', status: 'synced' });
    const delivered = makeAction({ jobId: 'job-1', endpoint: 'delivered' });
    expect(isJobActionBlocked([delivered, stop, pod], delivered)).toBe(false);
  });

  it('returns false for the first action in the lifecycle', () => {
    const action = makeAction({ jobId: 'job-1', endpoint: 'on-my-way-pickup' });
    expect(isJobActionBlocked([action], action)).toBe(false);
  });

  it('only considers actions for the same job', () => {
    const otherJobStop = makeAction({ jobId: 'job-2', endpoint: 'stop-status', status: 'pending' });
    const pod = makeAction({ jobId: 'job-1', endpoint: 'pod' });
    expect(isJobActionBlocked([otherJobStop, pod], pod)).toBe(false);
  });
});
