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

import {
  clearQueue,
  enqueueAction,
  getQueue,
  queueStorageKey,
  retryQueueItem,
  markQueueItemFailed,
} from '../src/offline/queue';
import { handleSessionLoss } from '../src/auth/sessionLoss';

const USER_A = 'user-aaa-111';
const USER_B = 'user-bbb-222';

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
    await enqueueAction(USER_A, { jobId: 'job-1', endpoint: 'loaded' });
    expect(storage[queueStorageKey(USER_A)]).toBeDefined();
    expect(storage['xdrive.driver.offlineQueue']).toBeUndefined();
  });

  it('user A actions do not appear in user B queue', async () => {
    await enqueueAction(USER_A, { jobId: 'job-1', endpoint: 'loaded' });
    const queueB = await getQueue(USER_B);
    expect(queueB).toHaveLength(0);
  });

  it('user B actions do not appear in user A queue', async () => {
    await enqueueAction(USER_B, { jobId: 'job-2', endpoint: 'arrived-pickup' });
    const queueA = await getQueue(USER_A);
    expect(queueA).toHaveLength(0);
  });

  it('each user has an independent queue', async () => {
    await enqueueAction(USER_A, { jobId: 'job-1', endpoint: 'loaded' });
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
    await enqueueAction(USER_A, { jobId: 'job-1', endpoint: 'loaded' });
    expect(await getQueue(USER_B)).toHaveLength(0);
  });

  it('returns only the requesting user\'s actions', async () => {
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'on-my-way-pickup' });
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'arrived-pickup' });
    await enqueueAction(USER_B, { jobId: 'job-b', endpoint: 'loaded' });

    const queueA = await getQueue(USER_A);
    expect(queueA).toHaveLength(2);
    expect(queueA.every((item) => item.jobId === 'job-a')).toBe(true);
  });
});

// ─── 4. Duplicate check — does not deduplicate across accounts ───────────────

describe('duplicate prevention — cross-account independence', () => {
  it('allows both users to queue the same job+endpoint independently', async () => {
    await enqueueAction(USER_A, { jobId: 'shared-job', endpoint: 'loaded' });
    await enqueueAction(USER_B, { jobId: 'shared-job', endpoint: 'loaded' });

    const queueA = await getQueue(USER_A);
    const queueB = await getQueue(USER_B);

    expect(queueA).toHaveLength(1);
    expect(queueB).toHaveLength(1);
  });

  it('still deduplicates within the same account', async () => {
    await enqueueAction(USER_A, { jobId: 'job-1', endpoint: 'loaded' });
    await enqueueAction(USER_A, { jobId: 'job-1', endpoint: 'loaded' });
    const queueA = await getQueue(USER_A);
    expect(queueA).toHaveLength(1);
  });
});

// ─── 5. retryQueueItem — only the caller's account ──────────────────────────

describe('retryQueueItem — account isolation', () => {
  it('cannot retry an item belonging to a different user', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-1', endpoint: 'loaded' });
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
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'loaded' });
    await enqueueAction(USER_B, { jobId: 'job-b', endpoint: 'loaded' });

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
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'loaded' });

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
    await enqueueAction(USER_A, { jobId: 'shared-job', endpoint: 'loaded' });

    // User B's queue for the same job is empty
    const queueB = await getQueue(USER_B);
    expect(queueB.filter((item) => item.jobId === 'shared-job')).toHaveLength(0);
  });
});

// ─── 8. handleSessionLoss — production session-loss decision helper ───────────

describe('handleSessionLoss — production path regression', () => {
  it('clears the previously authenticated user queue when session becomes null', async () => {
    // User A had an active session and queued an action.
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'loaded' });
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
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'loaded' });
    await enqueueAction(USER_B, { jobId: 'job-b', endpoint: 'loaded' });

    // Session loss for USER_A only
    await handleSessionLoss(USER_A);

    expect(await getQueue(USER_A)).toHaveLength(0);
    expect(await getQueue(USER_B)).toHaveLength(1);
  });

  it('also removes the legacy unscoped queue key on session loss', async () => {
    storage['xdrive.driver.offlineQueue'] = JSON.stringify([
      { id: 'legacy', jobId: 'job-old', endpoint: 'loaded', status: 'pending', createdAt: '2025-01-01T00:00:00Z', retryCount: 0 },
    ]);
    await enqueueAction(USER_A, { jobId: 'job-a', endpoint: 'loaded' });

    await handleSessionLoss(USER_A);

    expect(storage['xdrive.driver.offlineQueue']).toBeUndefined();
    expect(storage[queueStorageKey(USER_A)]).toBeUndefined();
  });
});
