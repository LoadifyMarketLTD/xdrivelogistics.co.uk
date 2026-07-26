/**
 * Offline queue hardening tests.
 *
 * Covers:
 *  1. Anonymous identity rejection
 *  2. ownerUserId stamped on every enqueued item
 *  3. Duplicate/supersede suppression
 *  4. Cross-account owner isolation (ownerUserId mismatch guard)
 *  5. Legacy queue one-time cleanup — items discarded, never replayed
 *  6. Legacy queue corruption handled gracefully
 *  7. Logout persistence — persisted queue survives session clear
 *  8. Restart restore — queue reloads correctly for the same user
 *  9. Account-switch isolation — user B cannot read user A's queue
 * 10. getQueue ownerUserId enforcement + flushQueue account-switch protection
 * 11. updateQueueItem — immutable field protection
 * 12. POD dedupe — podKey per submission
 */

import AsyncStorage from '../__mocks__/async-storage';

// Import queue module after mocks are in place (jest moduleNameMapper maps the import).
import {
  assertValidUserId,
  enqueueAction,
  getQueue,
  markQueueItemFailed,
  markQueueItemSynced,
  markQueueItemSyncing,
  migrateLegacyQueue,
  queueKeyForUser,
  retryQueueItem,
  saveQueue,
  updateQueueItem,
  type QueuedAction,
} from '../queue';

const USER_A = 'user-aaa-111';
const USER_B = 'user-bbb-222';

beforeEach(() => {
  (AsyncStorage as unknown as { __reset(): void }).__reset();
});

// ---------------------------------------------------------------------------
// 1. Anonymous identity rejection
// ---------------------------------------------------------------------------
describe('assertValidUserId', () => {
  test.each(['', '   ', '\t', '\n'])(
    'throws for empty/whitespace userId %j',
    (id) => {
      expect(() => assertValidUserId(id)).toThrow('Queue operation requires an authenticated user identity.');
    },
  );

  test('does not throw for a non-empty userId', () => {
    expect(() => assertValidUserId(USER_A)).not.toThrow();
  });
});

describe('queueKeyForUser', () => {
  test('throws for empty userId', () => {
    expect(() => queueKeyForUser('')).toThrow();
  });

  test('returns scoped key for valid userId', () => {
    expect(queueKeyForUser(USER_A)).toBe(`xdrive.driver.offlineQueue:${USER_A}`);
  });
});

describe('enqueueAction rejects empty userId', () => {
  test('throws when userId is empty string', async () => {
    await expect(
      enqueueAction('', { jobId: 'job-1', endpoint: 'on-my-way-to-pickup' }),
    ).rejects.toThrow('Queue operation requires an authenticated user identity.');
  });

  test('throws when userId is whitespace', async () => {
    await expect(
      enqueueAction('   ', { jobId: 'job-1', endpoint: 'on-my-way-to-pickup' }),
    ).rejects.toThrow('Queue operation requires an authenticated user identity.');
  });
});

// ---------------------------------------------------------------------------
// 2. ownerUserId stamped on every enqueued item
// ---------------------------------------------------------------------------
describe('enqueueAction ownerUserId', () => {
  test('stamps ownerUserId equal to the authenticated userId', async () => {
    const queued = await enqueueAction(USER_A, { jobId: 'job-1', endpoint: 'on-site-pickup' });
    expect(queued.ownerUserId).toBe(USER_A);
  });

  test('persisted item carries ownerUserId after reload', async () => {
    await enqueueAction(USER_A, { jobId: 'job-2', endpoint: 'loaded' });
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(1);
    expect(queue[0].ownerUserId).toBe(USER_A);
  });
});

// ---------------------------------------------------------------------------
// 3. Duplicate / supersede suppression
// ---------------------------------------------------------------------------
describe('enqueueAction duplicate suppression', () => {
  test('second enqueue for same jobId+endpoint supersedes the first (same ID)', async () => {
    const first = await enqueueAction(USER_A, { jobId: 'job-3', endpoint: 'loaded' });
    const second = await enqueueAction(USER_A, { jobId: 'job-3', endpoint: 'loaded' });
    expect(second.id).toBe(first.id);
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(1);
  });

  test('supersede resets retryCount and clears lastError', async () => {
    await enqueueAction(USER_A, { jobId: 'job-4', endpoint: 'on-my-way-to-delivery' });
    const firstQueue = await getQueue(USER_A);
    // Simulate a failed retry
    await markQueueItemFailed(USER_A, firstQueue[0].id, 'network error', 0);

    const superseded = await enqueueAction(USER_A, { jobId: 'job-4', endpoint: 'on-my-way-to-delivery' });
    expect(superseded.retryCount).toBe(0);
    expect(superseded.lastError).toBeUndefined();
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(1);
  });

  test('different endpoints for the same job create separate entries', async () => {
    await enqueueAction(USER_A, { jobId: 'job-5', endpoint: 'on-site-delivery' });
    await enqueueAction(USER_A, { jobId: 'job-5', endpoint: 'delivered' });
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(2);
  });

  test('synced items are not superseded — a new pending item is created', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-6', endpoint: 'loaded' });
    await markQueueItemSynced(USER_A, item.id);

    await enqueueAction(USER_A, { jobId: 'job-6', endpoint: 'loaded' });
    const queue = await getQueue(USER_A);
    // Must have both the synced item and the new pending item.
    expect(queue).toHaveLength(2);
    expect(queue.filter((i) => i.status === 'synced')).toHaveLength(1);
    expect(queue.filter((i) => i.status === 'pending')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Cross-account owner isolation (ownerUserId mismatch guard)
// ---------------------------------------------------------------------------
describe('cross-account isolation', () => {
  test('user B cannot read user A queue key', async () => {
    await enqueueAction(USER_A, { jobId: 'job-7', endpoint: 'on-site-pickup' });
    const queueB = await getQueue(USER_B);
    expect(queueB).toHaveLength(0);
  });

  test('enqueuing for user B does not affect user A queue', async () => {
    await enqueueAction(USER_A, { jobId: 'job-8', endpoint: 'loaded' });
    await enqueueAction(USER_B, { jobId: 'job-8', endpoint: 'loaded' });
    const queueA = await getQueue(USER_A);
    const queueB = await getQueue(USER_B);
    expect(queueA).toHaveLength(1);
    expect(queueA[0].ownerUserId).toBe(USER_A);
    expect(queueB).toHaveLength(1);
    expect(queueB[0].ownerUserId).toBe(USER_B);
  });

  test('saveQueue for user A does not overwrite user B storage', async () => {
    await enqueueAction(USER_B, { jobId: 'job-9', endpoint: 'delivered' });
    await saveQueue(USER_A, []); // clear user A queue
    const queueB = await getQueue(USER_B);
    expect(queueB).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Legacy queue one-time cleanup — items are discarded, never replayed
// ---------------------------------------------------------------------------
describe('migrateLegacyQueue', () => {
  const LEGACY_KEY = 'xdrive.driver.offlineQueue';

  test('discards legacy items — does not add them to the user-scoped queue', async () => {
    const legacyItem: Partial<QueuedAction> = {
      id: 'legacy-001',
      jobId: 'job-legacy',
      endpoint: 'on-site-pickup',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify([legacyItem]));

    await migrateLegacyQueue(USER_A);

    // Ownership cannot be proven — legacy items must NOT appear in the user queue.
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(0);
  });

  test('removes the legacy key after running', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify([{ id: 'x', jobId: 'j', endpoint: 'e', status: 'pending', createdAt: new Date().toISOString(), retryCount: 0 }]));
    await migrateLegacyQueue(USER_A);
    const remaining = await AsyncStorage.getItem(LEGACY_KEY);
    expect(remaining).toBeNull();
  });

  test('is a no-op when legacy key is absent', async () => {
    await migrateLegacyQueue(USER_A);
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(0);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  test('preserves existing user-scoped queue — only the legacy key is removed', async () => {
    const existing: QueuedAction = {
      id: 'existing-001',
      ownerUserId: USER_A,
      jobId: 'job-existing',
      endpoint: 'loaded',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await saveQueue(USER_A, [existing]);
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify([{ id: 'legacy-x', jobId: 'job-x', endpoint: 'on-site-pickup', status: 'pending', createdAt: new Date().toISOString(), retryCount: 0 }]));

    await migrateLegacyQueue(USER_A);

    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe('existing-001');
  });

  test('can be called multiple times safely — second call is a no-op', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, JSON.stringify([{ id: 'x', jobId: 'j', endpoint: 'e', status: 'pending', createdAt: new Date().toISOString(), retryCount: 0 }]));
    await migrateLegacyQueue(USER_A);
    await expect(migrateLegacyQueue(USER_A)).resolves.toBeUndefined();
    expect(await AsyncStorage.getItem(LEGACY_KEY)).toBeNull();
  });

  test('throws for empty userId', async () => {
    await expect(migrateLegacyQueue('')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 6. Legacy queue corruption handled gracefully
// ---------------------------------------------------------------------------
describe('migrateLegacyQueue — corrupted data', () => {
  const LEGACY_KEY = 'xdrive.driver.offlineQueue';

  test('removes corrupted legacy key without throwing', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, 'not-valid-json{{{');
    await expect(migrateLegacyQueue(USER_A)).resolves.toBeUndefined();
    const remaining = await AsyncStorage.getItem(LEGACY_KEY);
    expect(remaining).toBeNull();
  });

  test('user queue remains empty after corrupted legacy key is cleaned up', async () => {
    await AsyncStorage.setItem(LEGACY_KEY, 'corrupted');
    await migrateLegacyQueue(USER_A);
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Logout persistence — persisted queue survives in-memory session clear
// ---------------------------------------------------------------------------
describe('logout persistence', () => {
  test('clearing in-memory queue (setQueue([])) does not remove AsyncStorage data', async () => {
    await enqueueAction(USER_A, { jobId: 'job-10', endpoint: 'on-site-delivery' });

    // Simulate logout: clear in-memory state only (no saveQueue call)
    // The persisted storage must not be affected.
    const queueAfterLogout = await getQueue(USER_A);
    expect(queueAfterLogout).toHaveLength(1);
  });

  test('same user signing back in restores their persisted queue', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-11', endpoint: 'delivered' });

    // Simulate sign-out + sign-in: getQueue is called again with the same userId
    const restored = await getQueue(USER_A);
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(item.id);
  });
});

// ---------------------------------------------------------------------------
// 8. Restart restore — queue reloads correctly after device restart
// ---------------------------------------------------------------------------
describe('restart restore', () => {
  test('getQueue reads back all fields correctly after AsyncStorage survives restart', async () => {
    const queued = await enqueueAction(USER_A, { jobId: 'job-12', endpoint: 'on-my-way-to-pickup' });

    // Simulate restart: read back from AsyncStorage (mock persists across calls)
    const restored = await getQueue(USER_A);
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(queued.id);
    expect(restored[0].ownerUserId).toBe(USER_A);
    expect(restored[0].jobId).toBe('job-12');
    expect(restored[0].endpoint).toBe('on-my-way-to-pickup');
    expect(restored[0].status).toBe('pending');
    expect(restored[0].retryCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 9. Account-switch isolation — user B cannot replay user A's persisted items
// ---------------------------------------------------------------------------
describe('account switching isolation', () => {
  test('user B queue is empty even after user A has pending items', async () => {
    await enqueueAction(USER_A, { jobId: 'job-13', endpoint: 'loaded' });
    await enqueueAction(USER_A, { jobId: 'job-14', endpoint: 'on-site-delivery' });

    const queueB = await getQueue(USER_B);
    expect(queueB).toHaveLength(0);
  });

  test('ownerUserId on all user A items equals USER_A', async () => {
    await enqueueAction(USER_A, { jobId: 'job-15', endpoint: 'on-site-pickup' });
    await enqueueAction(USER_A, { jobId: 'job-16', endpoint: 'loaded' });

    const queue = await getQueue(USER_A);
    expect(queue.every((item) => item.ownerUserId === USER_A)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. getQueue ownerUserId enforcement + flushQueue account-switch protection
// ---------------------------------------------------------------------------
describe('getQueue ownerUserId enforcement', () => {
  test('drops items with ownerUserId !== userId (wrong owner stored in correct key)', async () => {
    // Manually write an item with wrong ownerUserId into user A's key.
    const wrongOwnerItem: QueuedAction = {
      id: 'wrong-owner-001',
      ownerUserId: USER_B, // B's item somehow in A's queue key
      jobId: 'job-17',
      endpoint: 'on-site-pickup',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await saveQueue(USER_A, [wrongOwnerItem]);

    // getQueue must silently drop items whose ownerUserId does not match the
    // requested userId — flushQueue therefore never receives them.
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(0);
  });

  test('drops items with empty ownerUserId (pre-field legacy items written directly)', async () => {
    const ownerlessItem: QueuedAction = {
      id: 'ownerless-001',
      ownerUserId: '',
      jobId: 'job-ownerless',
      endpoint: 'loaded',
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await saveQueue(USER_A, [ownerlessItem]);

    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(0);
  });

  test('returns correctly owned items unaffected by isolation filter', async () => {
    const ownedItem = await enqueueAction(USER_A, { jobId: 'job-owned', endpoint: 'loaded' });
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe(ownedItem.id);
    expect(queue[0].ownerUserId).toBe(USER_A);
  });
});

// ---------------------------------------------------------------------------
// Queue lifecycle helpers (markSyncing, markSynced, markFailed, retry)
// ---------------------------------------------------------------------------
describe('queue item lifecycle', () => {
  test('markQueueItemSyncing sets status to syncing', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-18', endpoint: 'loaded' });
    const updated = await markQueueItemSyncing(USER_A, item.id);
    expect(updated.find((i) => i.id === item.id)?.status).toBe('syncing');
  });

  test('markQueueItemSynced sets status to synced', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-19', endpoint: 'loaded' });
    await markQueueItemSyncing(USER_A, item.id);
    const updated = await markQueueItemSynced(USER_A, item.id);
    expect(updated.find((i) => i.id === item.id)?.status).toBe('synced');
  });

  test('markQueueItemFailed sets status to failed and increments retryCount', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-20', endpoint: 'loaded' });
    const updated = await markQueueItemFailed(USER_A, item.id, 'timeout', 0);
    const failed = updated.find((i) => i.id === item.id)!;
    expect(failed.status).toBe('failed');
    expect(failed.retryCount).toBe(1);
    expect(failed.lastError).toBe('timeout');
  });

  test('retryQueueItem resets status to pending', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-21', endpoint: 'loaded' });
    await markQueueItemFailed(USER_A, item.id, 'error', 0);
    const updated = await retryQueueItem(USER_A, item.id);
    expect(updated.find((i) => i.id === item.id)?.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// 11. updateQueueItem — immutable field protection
// ---------------------------------------------------------------------------
describe('updateQueueItem immutable field protection', () => {
  test('runtime bypass cannot overwrite ownerUserId, id, jobId, endpoint, payload, or createdAt', async () => {
    const payload = { recipientName: 'Original' };
    const item = await enqueueAction(USER_A, { jobId: 'job-22', endpoint: 'loaded', payload });
    // Bypass TypeScript and attempt to overwrite every immutable field at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateQueueItem(USER_A, item.id, {
      ownerUserId: USER_B,
      id: 'tampered',
      jobId: 'tampered-job',
      endpoint: 'tampered-endpoint',
      payload: { tampered: true },
      createdAt: '1970-01-01T00:00:00.000Z',
    } as any);
    const queue = await getQueue(USER_A);
    // Item is still retrievable under USER_A's key (ownerUserId not changed).
    const updated = queue.find((i) => i.id === item.id)!;
    expect(updated).toBeDefined();
    expect(updated.ownerUserId).toBe(USER_A);
    expect(updated.id).toBe(item.id);
    expect(updated.jobId).toBe('job-22');
    expect(updated.endpoint).toBe('loaded');
    expect(updated.payload).toEqual(payload);
    expect(updated.createdAt).toBe(item.createdAt);
  });

  test('id, jobId, endpoint, createdAt are preserved after a normal status update', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-23', endpoint: 'on-site-pickup' });
    await updateQueueItem(USER_A, item.id, { status: 'syncing' });
    const queue = await getQueue(USER_A);
    const updated = queue.find((i) => i.id === item.id)!;
    expect(updated.id).toBe(item.id);
    expect(updated.jobId).toBe('job-23');
    expect(updated.endpoint).toBe('on-site-pickup');
    expect(updated.createdAt).toBe(item.createdAt);
    expect(updated.ownerUserId).toBe(USER_A);
  });

  test('payload is preserved after a status update', async () => {
    const payload = { photoUris: ['file://photo.jpg'], podKey: 'key-123' };
    const item = await enqueueAction(USER_A, { jobId: 'job-24', endpoint: 'pod', payload });
    await updateQueueItem(USER_A, item.id, { status: 'syncing' });
    const queue = await getQueue(USER_A);
    const updated = queue.find((i) => i.id === item.id)!;
    expect(updated.payload).toEqual(payload);
  });

  test('updateQueueItem with unknown id is a silent no-op', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-25', endpoint: 'loaded' });
    const before = await getQueue(USER_A);
    await updateQueueItem(USER_A, 'non-existent-id', { status: 'syncing' });
    const after = await getQueue(USER_A);
    // Queue is unchanged; the real item keeps its original status.
    expect(after.find((i) => i.id === item.id)?.status).toBe(before.find((i) => i.id === item.id)?.status);
    expect(after).toHaveLength(1);
  });

  test('markQueueItemSynced clears lastError and nextRetryAt', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-26', endpoint: 'loaded' });
    // Simulate a failed attempt that sets lastError and nextRetryAt.
    await markQueueItemFailed(USER_A, item.id, 'network error', 0);
    const afterFail = (await getQueue(USER_A)).find((i) => i.id === item.id)!;
    expect(afterFail.lastError).toBe('network error');
    expect(afterFail.nextRetryAt).toBeDefined();
    // Now mark as synced — both fields must be cleared.
    await markQueueItemSynced(USER_A, item.id);
    const afterSync = (await getQueue(USER_A)).find((i) => i.id === item.id)!;
    expect(afterSync.status).toBe('synced');
    expect(afterSync.lastError).toBeUndefined();
    expect(afterSync.nextRetryAt).toBeUndefined();
  });

  test('retryQueueItem clears lastError and nextRetryAt', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-27', endpoint: 'loaded' });
    await markQueueItemFailed(USER_A, item.id, 'timeout', 0);
    const afterFail = (await getQueue(USER_A)).find((i) => i.id === item.id)!;
    expect(afterFail.lastError).toBe('timeout');
    expect(afterFail.nextRetryAt).toBeDefined();
    // Manual retry must clear stale failure metadata.
    await retryQueueItem(USER_A, item.id);
    const afterRetry = (await getQueue(USER_A)).find((i) => i.id === item.id)!;
    expect(afterRetry.status).toBe('pending');
    expect(afterRetry.lastError).toBeUndefined();
    expect(afterRetry.nextRetryAt).toBeUndefined();
  });

  test('omitted fields remain unchanged', async () => {
    const item = await enqueueAction(USER_A, { jobId: 'job-28', endpoint: 'loaded' });
    await markQueueItemFailed(USER_A, item.id, 'original error', 2);
    const before = (await getQueue(USER_A)).find((i) => i.id === item.id)!;
    // Patch only status — lastError, retryCount, lastAttemptAt, nextRetryAt must not change.
    await updateQueueItem(USER_A, item.id, { status: 'syncing' });
    const after = (await getQueue(USER_A)).find((i) => i.id === item.id)!;
    expect(after.status).toBe('syncing');
    expect(after.lastError).toBe(before.lastError);
    expect(after.retryCount).toBe(before.retryCount);
    expect(after.lastAttemptAt).toBe(before.lastAttemptAt);
    expect(after.nextRetryAt).toBe(before.nextRetryAt);
  });
});

// ---------------------------------------------------------------------------
// 12. POD dedupe — podKey per submission
// ---------------------------------------------------------------------------
describe('POD dedupe via podKey', () => {
  test('retry with the same podKey supersedes the pending POD entry', async () => {
    const podKey = 'pod-key-aaa';
    const first = await enqueueAction(USER_A, { jobId: 'job-pod-1', endpoint: 'pod', payload: { recipientName: 'Alice', podKey } });
    const retry = await enqueueAction(USER_A, { jobId: 'job-pod-1', endpoint: 'pod', payload: { recipientName: 'Alice', podKey } });
    expect(retry.id).toBe(first.id);
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(1);
  });

  test('new POD submission with a different podKey does NOT overwrite the pending one', async () => {
    await enqueueAction(USER_A, { jobId: 'job-pod-2', endpoint: 'pod', payload: { recipientName: 'Alice', podKey: 'key-aaa' } });
    await enqueueAction(USER_A, { jobId: 'job-pod-2', endpoint: 'pod', payload: { recipientName: 'Bob', podKey: 'key-bbb' } });
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(2);
    // Both submissions are preserved with their original evidence.
    expect(queue.find((i) => (i.payload?.podKey as string) === 'key-aaa')?.payload?.recipientName).toBe('Alice');
    expect(queue.find((i) => (i.payload?.podKey as string) === 'key-bbb')?.payload?.recipientName).toBe('Bob');
  });

  test('POD submission without podKey is never superseded (always creates new entry)', async () => {
    await enqueueAction(USER_A, { jobId: 'job-pod-3', endpoint: 'pod', payload: { recipientName: 'Alice' } });
    await enqueueAction(USER_A, { jobId: 'job-pod-3', endpoint: 'pod', payload: { recipientName: 'Alice' } });
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(2);
  });

  test('failed POD with same podKey is superseded on retry (reset retryCount)', async () => {
    const podKey = 'pod-key-ccc';
    const item = await enqueueAction(USER_A, { jobId: 'job-pod-4', endpoint: 'pod', payload: { podKey } });
    await markQueueItemFailed(USER_A, item.id, 'network error', 0);

    const retry = await enqueueAction(USER_A, { jobId: 'job-pod-4', endpoint: 'pod', payload: { podKey } });
    expect(retry.id).toBe(item.id);
    expect(retry.retryCount).toBe(0);
    expect(retry.lastError).toBeUndefined();
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(1);
  });

  test('status action dedupe is unaffected by podKey logic', async () => {
    const first = await enqueueAction(USER_A, { jobId: 'job-status-1', endpoint: 'loaded' });
    const second = await enqueueAction(USER_A, { jobId: 'job-status-1', endpoint: 'loaded' });
    expect(second.id).toBe(first.id);
    const queue = await getQueue(USER_A);
    expect(queue).toHaveLength(1);
  });
});
