/**
 * Account-scoped offline queue isolation regression tests.
 *
 * These tests deliberately use lifecycle actions that do not require media
 * evidence. `loaded` is covered separately and must keep requiring a collection
 * photo in production.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage[key] ?? null,
    setItem: async (key: string, value: string) => { storage[key] = value; },
    removeItem: async (key: string) => { delete storage[key]; },
    multiRemove: async (keys: string[]) => { keys.forEach((key) => { delete storage[key]; }); },
  },
}));

vi.mock('expo-network', () => ({
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
}));

vi.mock('../src/offline/collectionEvidencePersistence', () => ({
  clearPersistedCollectionEvidenceForUser: async () => undefined,
  persistQueuedCollectionPayload: async (_userId: string, _jobId: string, payload: Record<string, unknown>) => payload,
}));

vi.mock('../src/offline/podEvidencePersistence', () => ({
  clearPersistedPodEvidenceForUser: async () => undefined,
  persistQueuedPodPayload: async (_userId: string, _jobId: string, payload: Record<string, unknown>) => payload,
}));

import {
  clearQueue,
  enqueueAction,
  getQueue,
  markQueueItemFailed,
  queueStorageKey,
  reconcileQueueState,
  retryQueueItem,
  type QueuedAction,
} from '../src/offline/queue';
import { handleSessionLoss } from '../src/auth/sessionLoss';

const USER_A = 'user-aaa-111';
const USER_B = 'user-bbb-222';
const SAFE_ENDPOINT = 'arrived-pickup';

beforeEach(() => {
  Object.keys(storage).forEach((key) => delete storage[key]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('queueStorageKey', () => {
  it('is account scoped and never uses the legacy global key', () => {
    expect(queueStorageKey(USER_A)).not.toBe(queueStorageKey(USER_B));
    expect(queueStorageKey(USER_A)).toContain(USER_A);
    expect(queueStorageKey(USER_A)).not.toBe('xdrive.driver.offlineQueue');
  });
});

describe('enqueueAction account isolation', () => {
  it('writes only under the authenticated user key', async () => {
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: SAFE_ENDPOINT });
    expect(storage[queueStorageKey(USER_A)]).toBeDefined();
    expect(storage[queueStorageKey(USER_B)]).toBeUndefined();
    expect(storage['xdrive.driver.offlineQueue']).toBeUndefined();
  });

  it('keeps user queues independent even for the same job and endpoint', async () => {
    await enqueueAction(USER_A, { jobId: 'shared-job', endpoint: SAFE_ENDPOINT });
    await enqueueAction(USER_B, { jobId: 'shared-job', endpoint: SAFE_ENDPOINT });

    const [queueA, queueB] = await Promise.all([getQueue(USER_A), getQueue(USER_B)]);
    expect(queueA).toHaveLength(1);
    expect(queueB).toHaveLength(1);
    expect(queueA[0].jobId).toBe('shared-job');
    expect(queueB[0].jobId).toBe('shared-job');
  });

  it('deduplicates the same action only within one account', async () => {
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: SAFE_ENDPOINT });
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: SAFE_ENDPOINT });
    expect(await getQueue(USER_A)).toHaveLength(1);
  });

  it('keeps different multi-drop stop transitions distinct', async () => {
    await enqueueAction(USER_A, {
      jobId: 'job-a',
      endpoint: 'stop-status',
      payload: { stop_id: 'stop-1', status: 'arrived' },
    });
    await enqueueAction(USER_A, {
      jobId: 'job-a',
      endpoint: 'stop-status',
      payload: { stop_id: 'stop-1', status: 'completed' },
    });
    await enqueueAction(USER_A, {
      jobId: 'job-a',
      endpoint: 'stop-status',
      payload: { stop_id: 'stop-2', status: 'arrived' },
    });
    expect(await getQueue(USER_A)).toHaveLength(3);
  });

  it('does not weaken the mandatory collection evidence gate for Loaded', async () => {
    await expect(
      enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'loaded' }),
    ).rejects.toThrow('A collection photo is required before Loaded can be queued.');
  });
});

describe('retry and clear isolation', () => {
  it('a different account cannot retry another user queue item', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-a', endpoint: SAFE_ENDPOINT });
    await markQueueItemFailed(USER_A, item.id, 'network error', 0);

    await retryQueueItem(USER_B, item.id);

    const queueA = await getQueue(USER_A);
    expect(queueA[0].status).toBe('failed');
  });

  it('clearQueue removes only the selected account plus the legacy unscoped key', async () => {
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: SAFE_ENDPOINT });
    await enqueueAction(USER_B, { jobId: 'job-b', endpoint: SAFE_ENDPOINT });
    storage['xdrive.driver.offlineQueue'] = 'legacy';

    await clearQueue(USER_A);

    expect(await getQueue(USER_A)).toHaveLength(0);
    expect(await getQueue(USER_B)).toHaveLength(1);
    expect(storage['xdrive.driver.offlineQueue']).toBeUndefined();
  });
});

describe('session loss isolation', () => {
  it('clears the previously authenticated account without touching another account', async () => {
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: SAFE_ENDPOINT });
    await enqueueAction(USER_B, { jobId: 'job-b', endpoint: SAFE_ENDPOINT });

    await handleSessionLoss(USER_A);

    expect(await getQueue(USER_A)).toHaveLength(0);
    expect(await getQueue(USER_B)).toHaveLength(1);
  });

  it('is a no-op when there was no previous authenticated account', async () => {
    await expect(handleSessionLoss(null)).resolves.toBeUndefined();
  });
});

function makeItem(id: string, endpoint: string, jobId = 'job-1'): QueuedAction {
  return {
    id,
    jobId,
    endpoint,
    status: 'pending',
    createdAt: '2026-09-05T00:00:00.000Z',
    retryCount: 0,
  };
}

describe('reconcileQueueState immutable upsert', () => {
  it('adds a new item once and updates the same id instead of duplicating it', () => {
    const original = makeItem('id-1', SAFE_ENDPOINT);
    const failed = { ...original, status: 'failed' as const, lastError: 'network error' };

    let state = reconcileQueueState([], original);
    state = reconcileQueueState(state, original);
    state = reconcileQueueState(state, failed);

    expect(state).toHaveLength(1);
    expect(state[0].status).toBe('failed');
    expect(state[0].lastError).toBe('network error');
  });

  it('retains independent POD and Delivered rows without duplicate UI state', () => {
    const pod = makeItem('pod-1', 'pod');
    const delivered = makeItem('delivered-1', 'delivered');

    let state = reconcileQueueState([], pod);
    state = reconcileQueueState(state, delivered);
    state = reconcileQueueState(state, pod);
    state = reconcileQueueState(state, delivered);

    expect(state).toHaveLength(2);
    expect(state.filter((item) => item.endpoint === 'pod')).toHaveLength(1);
    expect(state.filter((item) => item.endpoint === 'delivered')).toHaveLength(1);
  });
});
