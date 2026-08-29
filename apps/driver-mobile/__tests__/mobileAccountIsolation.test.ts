/**
 * Unit tests for account-scoped offline queue isolation.
 *
 * Covered:
 *  1. queueStorageKey — unique per user, not shared across users
 *  2. enqueueAction — actions written under the correct user's key
 *  3. getQueue — user A cannot read user B's queue
 *  4. duplicate check — does not deduplicate across accounts
 *  5. retryQueueItem — only operates on the caller's account queue
 *  6. clearQueue — only clears the specified user's queue
 *  7. session loss — a null-session path cannot produce user A data for user B
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock AsyncStorage
const storage: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storage[key] ?? null,
    setItem: async (key: string, value: string) => { storage[key] = value; },
    removeItem: async (key: string) => { delete storage[key]; },
    multiRemove: async (keys: string[]) => { keys.forEach((k) => { delete storage[k]; }); },
  },
}));

// Mock expo-network (not used in these tests but imported by queue.ts)
vi.mock('expo-network', () => ({
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
}));

// Queue cleanup imports the durable evidence persistence modules, which import
// expo-file-system. Keep this unit test inside the Node/Vitest boundary instead
// of loading the React Native runtime (whose distributed entrypoint contains
// Flow syntax that Rolldown does not parse).
vi.mock('expo-file-system', () => ({
  documentDirectory: 'file:///xdrive-test-documents/',
  makeDirectoryAsync: vi.fn(async () => undefined),
  copyAsync: vi.fn(async () => undefined),
  deleteAsync: vi.fn(async () => undefined),
}));

import {
  clearQueue,
  enqueueAction,
  getQueue,
  queueStorageKey,
  reconcileQueueState,
  retryQueueItem,
  markQueueItemFailed,
  type QueuedAction,
} from '../src/offline/queue';
import { handleSessionLoss } from '../src/auth/sessionLoss';

const USER_A = 'user-aaa-111';
const USER_B = 'user-bbb-222';

function loadedAction(jobId: string) {
  return {
    jobId,
    endpoint: 'loaded',
    payload: {
      collectionPhotoUri: `persisted/${jobId}-collection.jpg`,
      collectionEvidenceId: `collection-${jobId}-evidence`,
    },
  };
}

beforeEach(() => {
  // Clear storage between tests
  for (const key of Object.keys(storage)) {
    delete storage[key];
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── 1. queueStorageKey ─────────────────────────────────────────────────────

describe('queueStorageKey', () => {
  it('produces different keys for different users', () => {
    expect(queueStorageKey(USER_A)).not.toBe(queueStorageKey(USER_B));
  });

  it('includes the userId in the key', () => {
    expect(queueStorageKey(USER_A)).toContain(USER_A);
    expect(queueStorageKey(USER_B)).toContain(USER_B);
  });

  it('does not equal the legacy unscoped key', () => {
    expect(queueStorageKey(USER_A)).not.toBe('xdrive.driver.offlineQueue');
  });
});

// ─── 2. enqueueAction — written under the correct key ───────────────────────

describe('enqueueAction — account-scoped storage', () => {
  it('writes to the user-specific key, not the global key', async () => {
    await enqueueAction(USER_A, loadedAction('job-1'));
    expect(storage[queueStorageKey(USER_A)]).toBeDefined();
    expect(storage['xdrive.driver.offlineQueue']).toBeUndefined();
  });

  it('user A actions do not appear in user B queue', async () => {
    await enqueueAction(USER_A, loadedAction('job-1'));
    const queueB = await getQueue(USER_B);
    expect(queueB).toHaveLength(0);
  });

  it('user B actions do not appear in user A queue', async () => {
    await enqueueAction(USER_B, { jobId: 'job-2', endpoint: 'arrived-pickup' });
    const queueA = await getQueue(USER_A);
    expect(queueA).toHaveLength(0);
  });

  it('each user has an independent queue', async () => {
    await enqueueAction(USER_A, loadedAction('job-1'));
    await enqueueAction(USER_B, { jobId: 'job-2', endpoint: 'delivered' });

    const queueA = await getQueue(USER_A);
    const queueB = await getQueue(USER_B);

    expect(queueA).toHaveLength(1);
    expect(queueA[0].jobId).toBe('job-1');
    expect(queueB).toHaveLength(1);
    expect(queueB[0].jobId).toBe('job-2');
  });
});

// ─── 3. getQueue — isolation ─────────────────────────────────────────────────

describe('getQueue — account isolation', () => {
  it('returns empty array for a user with no queue', async () => {
    await enqueueAction(USER_A, loadedAction('job-1'));
    expect(await getQueue(USER_B)).toHaveLength(0);
  });

  it('returns only the requesting user\'s actions', async () => {
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'on-my-way-pickup' });
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'arrived-pickup' });
    await enqueueAction(USER_B, loadedAction('job-b'));

    const queueA = await getQueue(USER_A);
    expect(queueA).toHaveLength(2);
    expect(queueA.every((item) => item.jobId === 'job-a')).toBe(true);
  });
});

// ─── 4. Duplicate check — does not deduplicate across accounts ───────────────

describe('duplicate prevention — cross-account independence', () => {
  it('allows both users to queue the same job+endpoint independently', async () => {
    await enqueueAction(USER_A, loadedAction('shared-job'));
    await enqueueAction(USER_B, loadedAction('shared-job'));

    const queueA = await getQueue(USER_A);
    const queueB = await getQueue(USER_B);

    expect(queueA).toHaveLength(1);
    expect(queueB).toHaveLength(1);
  });

  it('still deduplicates within the same account', async () => {
    await enqueueAction(USER_A, loadedAction('job-1'));
    await enqueueAction(USER_A, loadedAction('job-1'));
    const queueA = await getQueue(USER_A);
    expect(queueA).toHaveLength(1);
  });
});

// ─── 5. retryQueueItem — only the caller's account ──────────────────────────

describe('retryQueueItem — account isolation', () => {
  it('cannot retry an item belonging to a different user', async () => {
    const item = await enqueueAction(USER_A, loadedAction('job-1'));
    await markQueueItemFailed(USER_A, item.id, 'network error', 0);

    // User B tries to retry user A's item — should not affect USER_A's queue
    await retryQueueItem(USER_B, item.id);

    // USER_A's item should still be failed (unchanged by USER_B's retry call)
    const queueA = await getQueue(USER_A);
    expect(queueA[0].status).toBe('failed');
  });
});

// ─── 6. clearQueue — only clears the specified user's data ──────────────────
describe('clearQueue — account isolation', () => {
  it('clearing user A queue does not clear user B queue', async () => {
    await enqueueAction(USER_A, loadedAction('job-a'));
    await enqueueAction(USER_B, loadedAction('job-b'));

    await clearQueue(USER_A);

    const queueA = await getQueue(USER_A);
    const queueB = await getQueue(USER_B);

    expect(queueA).toHaveLength(0);
    expect(queueB).toHaveLength(1);
  });

  it('also removes the legacy unscoped key on clear', async () => {
    // Pre-populate the legacy key to simulate an app upgrade scenario
    storage['xdrive.driver.offlineQueue'] = JSON.stringify([
      { id: 'legacy-id', jobId: 'job-old', endpoint: 'loaded', status: 'pending', createdAt: '2025-01-01T00:00:00Z', retryCount: 0 },
    ]);
    await enqueueAction(USER_A, loadedAction('job-a'));

    await clearQueue(USER_A);

    // Legacy key must be removed
    expect(storage['xdrive.driver.offlineQueue']).toBeUndefined();
    // User A's scoped key also removed
    expect(storage[queueStorageKey(USER_A)]).toBeUndefined();
    // User B is unaffected
    expect(storage[queueStorageKey(USER_B)]).toBeUndefined();
  });
});

// ─── 7. Session loss — null session cannot leak user A data to user B ────────
describe('session loss — cross-account safety', () => {
  it('user B reading the queue after user A logout sees an empty queue', async () => {
    // User A enqueues an action and then signs out (clearQueue)
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'on-my-way-pickup' });
    await clearQueue(USER_A);

    // User B signs in — their queue must be empty
    const queueB = await getQueue(USER_B);
    expect(queueB).toHaveLength(0);
  });

  it('user B cannot flush user A actions even if both have the same jobId', async () => {
    await enqueueAction(USER_A, loadedAction('shared-job'));

    // User B's queue for the same job is empty
    const queueB = await getQueue(USER_B);
    expect(queueB.filter((item) => item.jobId === 'shared-job')).toHaveLength(0);
  });
});

// ─── 8. handleSessionLoss — production session-loss decision helper ───────────
describe('handleSessionLoss — production path regression', () => {
  it('clears the previously authenticated user queue when session becomes null', async () => {
    // User A had an active session and queued an action.
    await enqueueAction(USER_A, loadedAction('job-a'));
    expect(await getQueue(USER_A)).toHaveLength(1);

    // Session loss fires with null session. The app reads authenticatedUserIdRef,
    // which holds USER_A, and calls handleSessionLoss(USER_A).
    await handleSessionLoss(USER_A);

    // USER_A's queue must now be empty.
    expect(await getQueue(USER_A)).toHaveLength(0);
  });

  it('is a no-op when previousUserId is null (no prior session)', async () => {
    // No prior user — should not throw or write anything.
    await expect(handleSessionLoss(null)).resolves.toBeUndefined();
  });

  it('does not clear a different user\'s queue', async () => {
    await enqueueAction(USER_A, loadedAction('job-a'));
    await enqueueAction(USER_B, loadedAction('job-b'));

    // Session loss for USER_A only
    await handleSessionLoss(USER_A);

    expect(await getQueue(USER_A)).toHaveLength(0);
    expect(await getQueue(USER_B)).toHaveLength(1);
  });

  it('also removes the legacy unscoped queue key on session loss', async () => {
    storage['xdrive.driver.offlineQueue'] = JSON.stringify([
      { id: 'legacy', jobId: 'job-old', endpoint: 'loaded', status: 'pending', createdAt: '2025-01-01T00:00:00Z', retryCount: 0 },
    ]);
    await enqueueAction(USER_A, loadedAction('job-a'));

    await handleSessionLoss(USER_A);

    expect(storage['xdrive.driver.offlineQueue']).toBeUndefined();
    expect(storage[queueStorageKey(USER_A)]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// reconcileQueueState — React state immutable upsert
// ---------------------------------------------------------------------------

function makeItem(id: string, endpoint: string, jobId = 'job-1'): QueuedAction {
  return {
    id,
    jobId,
    endpoint,
    status: 'pending',
    createdAt: '2025-01-01T00:00:00.000Z',
    retryCount: 0,
  };
}

describe('reconcileQueueState — React queue deduplication', () => {
  it('1. inserting a new item adds exactly one row', () => {
    const state: QueuedAction[] = [];
    const item = makeItem('id-1', 'loaded');
    const next = reconcileQueueState(state, item);
    expect(next).toHaveLength(1);
    expect(next[0]).toBe(item);
  });

  it('2. inserting the same item twice keeps one row', () => {
    const item = makeItem('id-1', 'loaded');
    const after1 = reconcileQueueState([], item);
    const after2 = reconcileQueueState(after1, item);
    expect(after2).toHaveLength(1);
  });

  it('3. an existing item with the same id is updated rather than duplicated', () => {
    const original = makeItem('id-1', 'loaded');
    const updated = { ...original, status: 'failed' as const, lastError: 'network error' };
    const after1 = reconcileQueueState([], original);
    const after2 = reconcileQueueState(after1, updated);
    expect(after2).toHaveLength(1);
    expect(after2[0].status).toBe('failed');
    expect(after2[0].lastError).toBe('network error');
  });

  it('4. two different actions remain present and ordered correctly', () => {
    const a = makeItem('id-1', 'loaded', 'job-1');
    const b = makeItem('id-2', 'on-my-way-delivery', 'job-1');
    const state = reconcileQueueState(reconcileQueueState([], a), b);
    expect(state).toHaveLength(2);
    expect(state[0].id).toBe('id-1');
    expect(state[1].id).toBe('id-2');
  });

  it('5. POD and delivered queue items do not duplicate after repeated enqueue responses', () => {
    const pod = makeItem('job-1-pod-1000', 'pod', 'job-1');
    const delivered = makeItem('job-1-delivered-2000', 'delivered', 'job-1');
    // Simulate: first enqueue
    let state = reconcileQueueState([], pod);
    state = reconcileQueueState(state, delivered);
    // Double tap — same items returned again
    state = reconcileQueueState(state, pod);
    state = reconcileQueueState(state, delivered);
    expect(state).toHaveLength(2);
    expect(state.filter((i) => i.endpoint === 'pod')).toHaveLength(1);
    expect(state.filter((i) => i.endpoint === 'delivered')).toHaveLength(1);
  });
});
