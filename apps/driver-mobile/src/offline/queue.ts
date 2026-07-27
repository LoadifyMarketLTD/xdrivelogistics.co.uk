import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

import type { QueuedActionStatus } from '../jobs/types';

export type QueuedAction = {
  id: string;
  /** Immutable identity of the authenticated driver who created this action. */
  ownerUserId: string;
  /** Immutable. Set at enqueue time; never changed by lifecycle helpers. */
  jobId: string;
  /** Immutable. Set at enqueue time; never changed by lifecycle helpers. */
  endpoint: string;
  /** Immutable after enqueue. For POD submissions, must include a stable `podKey`. */
  payload?: Record<string, unknown>;
  status: QueuedActionStatus;
  /** Immutable. Set at enqueue time; never changed by lifecycle helpers. */
  createdAt: string;
  lastError?: string;
  retryCount: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
};

/**
 * Subset of QueuedAction fields that lifecycle helpers are permitted to patch.
 * The immutable fields (id, ownerUserId, jobId, endpoint, payload, createdAt)
 * are excluded to prevent accidental or malicious mutation of ownership or identity.
 */
export type QueuedActionMutablePatch = Partial<Pick<QueuedAction, 'status' | 'retryCount' | 'lastError' | 'lastAttemptAt' | 'nextRetryAt'>>;

// Queue keys are scoped per authenticated user to prevent cross-account data leakage.
// Each driver's pending actions are stored under their own Supabase user ID.
// Items from the pre-isolation legacy global key are handled by migrateLegacyQueue().

/** Key used before per-user isolation was introduced. */
const LEGACY_QUEUE_KEY = 'xdrive.driver.offlineQueue';

export function assertValidUserId(userId: string): void {
  if (!userId || !userId.trim()) {
    throw new Error('Queue operation requires an authenticated user identity.');
  }
}

export function queueKeyForUser(userId: string): string {
  assertValidUserId(userId);
  return `xdrive.driver.offlineQueue:${userId}`;
}

/**
 * Per-user serialization lock.
 * All read-modify-write queue operations are chained through this map so that
 * concurrent callers for the same user never overwrite each other's changes.
 * Separate users use independent chains and do not block each other.
 */
const _queueLocks = new Map<string, Promise<unknown>>();

function withQueueLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = _queueLocks.get(userId) ?? Promise.resolve();
  const current: Promise<T> = prev.then(() => fn(), () => fn());
  _queueLocks.set(userId, current.then(() => {}, () => {}));
  return current;
}

const maxRetryDelayMs = 15 * 60 * 1000;
const initialRetryDelayMs = 15 * 1000;

function normalizeQueueItem(item: Partial<QueuedAction>): QueuedAction {
  return {
    id: String(item.id ?? ''),
    ownerUserId: typeof item.ownerUserId === 'string' ? item.ownerUserId : '',
    jobId: String(item.jobId ?? ''),
    endpoint: String(item.endpoint ?? ''),
    payload: item.payload,
    status: (item.status ?? 'pending') as QueuedActionStatus,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    lastError: typeof item.lastError === 'string' ? item.lastError : undefined,
    retryCount: Number.isFinite(item.retryCount) ? Number(item.retryCount) : 0,
    lastAttemptAt: typeof item.lastAttemptAt === 'string' ? item.lastAttemptAt : undefined,
    nextRetryAt: typeof item.nextRetryAt === 'string' ? item.nextRetryAt : undefined,
  };
}

export async function getQueue(userId: string): Promise<QueuedAction[]> {
  assertValidUserId(userId);
  const raw = await AsyncStorage.getItem(queueKeyForUser(userId));
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Partial<QueuedAction>[])
      .map(normalizeQueueItem)
      .filter((item) => item.id && item.jobId && item.endpoint && item.ownerUserId === userId);
  } catch {
    return [];
  }
}

export async function saveQueue(userId: string, queue: QueuedAction[]) {
  assertValidUserId(userId);
  await AsyncStorage.setItem(queueKeyForUser(userId), JSON.stringify(queue));
}

export function mergeQueuedAction(queue: QueuedAction[], queued: QueuedAction) {
  return [queued, ...queue.filter((item) => item.id !== queued.id)];
}

/**
 * Enqueue a driver action.
 *
 * All enqueue operations are serialized per user via withQueueLock to prevent
 * concurrent read-modify-write races from overwriting each other's changes.
 *
 * For non-POD status actions: if a pending or failed item already exists for the
 * same jobId + endpoint, it is superseded in place (same ID, reset retry count)
 * to prevent repeated taps from flooding the queue.
 *
 * For POD submissions (endpoint === 'pod'): supersede only when the incoming
 * payload carries the same `podKey` as an existing pending/failed item. This
 * allows retries of the same POD form to collapse into one queue entry while
 * preventing a genuinely new POD submission (different form fill, different
 * podKey) from silently overwriting an earlier unsynced submission.
 * POD submissions without a podKey are never superseded.
 *
 * For bid submissions (endpoint === 'bid'): same dedup as status actions —
 * only one pending/failed bid per jobId is kept.
 */
export function enqueueAction(userId: string, action: Omit<QueuedAction, 'id' | 'ownerUserId' | 'status' | 'createdAt' | 'retryCount' | 'lastAttemptAt' | 'nextRetryAt' | 'lastError'>): Promise<QueuedAction> {
  try {
    assertValidUserId(userId);
  } catch (error) {
    return Promise.reject(error);
  }
  return withQueueLock(userId, async () => {
    const queue = await getQueue(userId);

    const isPod = action.endpoint === 'pod';
    const incomingPodKey = isPod ? (action.payload?.podKey as string | undefined) : undefined;

    // Find an existing pending/failed item to supersede.
    // POD: match by jobId + endpoint + podKey (only when podKey is present and matches).
    // Status/bid actions: match by jobId + endpoint.
    const existingIndex = queue.findIndex((item) => {
      if (item.jobId !== action.jobId || item.endpoint !== action.endpoint) return false;
      if (item.status !== 'pending' && item.status !== 'failed') return false;
      if (isPod) {
        const existingPodKey = item.payload?.podKey as string | undefined;
        return Boolean(incomingPodKey) && incomingPodKey === existingPodKey;
      }
      return true;
    });

    const queued: QueuedAction = {
      ...action,
      id: existingIndex >= 0 ? queue[existingIndex].id : `${action.jobId}-${action.endpoint}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ownerUserId: userId,
      status: 'pending',
      createdAt: existingIndex >= 0 ? queue[existingIndex].createdAt : new Date().toISOString(),
      retryCount: 0,
      lastError: undefined,
      lastAttemptAt: undefined,
      nextRetryAt: undefined,
    };

    let nextQueue: QueuedAction[];
    if (existingIndex >= 0) {
      nextQueue = [...queue];
      nextQueue[existingIndex] = queued;
    } else {
      nextQueue = [queued, ...queue];
    }
    await saveQueue(userId, nextQueue);
    return queued;
  });
}

/**
 * One-time cleanup of the pre-isolation global queue key.
 * Legacy items cannot be attributed to any account — they are discarded,
 * never replayed under the current user. The key is removed so this runs
 * exactly once per device. Safe to call on every sign-in: no-op when absent.
 */
export async function migrateLegacyQueue(userId: string): Promise<void> {
  assertValidUserId(userId);
  const raw = await AsyncStorage.getItem(LEGACY_QUEUE_KEY);
  if (!raw) return;
  // Ownership of legacy items cannot be proven — discard without replay.
  await AsyncStorage.removeItem(LEGACY_QUEUE_KEY);
}

/**
 * Applies a mutable patch to the queue item identified by `id`.
 * All updateQueueItem calls are serialized per user via withQueueLock to prevent
 * concurrent read-modify-write races.
 * Immutable fields (id, ownerUserId, jobId, endpoint, payload, createdAt) are
 * stripped from the patch at runtime so they can never be overwritten, even if
 * a caller constructs the patch object in JavaScript without TypeScript checks.
 * Returns the queue unchanged when no item with `id` is found (silent no-op).
 */
export function updateQueueItem(userId: string, id: string, patch: QueuedActionMutablePatch): Promise<QueuedAction[]> {
  try {
    assertValidUserId(userId);
  } catch (error) {
    return Promise.reject(error);
  }
  return withQueueLock(userId, async () => {
    const queue = await getQueue(userId);
    // Copy only the explicitly permitted mutable keys from the patch.
    // Use hasOwnProperty to preserve the semantic difference between:
    //   - key absent (do not change the field), and
    //   - key present with undefined value (clear the field).
    // Immutable fields (ownerUserId, id, jobId, endpoint, payload, createdAt) are
    // never copied, even if a caller passes them via a JS runtime bypass.
    const ALLOWED_KEYS = ['status', 'retryCount', 'lastError', 'lastAttemptAt', 'nextRetryAt'] as const;
    const safePatch: Record<string, unknown> = {};
    for (const key of ALLOWED_KEYS) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        safePatch[key] = (patch as Record<string, unknown>)[key];
      }
    }
    const next = queue.map((item) => (item.id === id ? { ...item, ...safePatch } : item));
    await saveQueue(userId, next);
    return next;
  });
}

export function calculateRetryDelayMs(retryCount: number) {
  return Math.min(initialRetryDelayMs * Math.max(1, 2 ** Math.max(0, retryCount)), maxRetryDelayMs);
}

export function isQueueItemReady(item: QueuedAction, now = Date.now()) {
  if (item.status === 'syncing' || item.status === 'synced') return false;
  if (!item.nextRetryAt) return true;
  const retryAt = new Date(item.nextRetryAt).getTime();
  return Number.isNaN(retryAt) || retryAt <= now;
}

export async function markQueueItemSyncing(userId: string, id: string) {
  assertValidUserId(userId);
  return updateQueueItem(userId, id, {
    status: 'syncing',
    lastAttemptAt: new Date().toISOString(),
  });
}

export async function markQueueItemSynced(userId: string, id: string) {
  assertValidUserId(userId);
  return updateQueueItem(userId, id, {
    status: 'synced',
    lastError: undefined,
    lastAttemptAt: new Date().toISOString(),
    nextRetryAt: undefined,
  });
}

export async function markQueueItemFailed(userId: string, id: string, lastError: string, previousRetryCount: number) {
  assertValidUserId(userId);
  const now = new Date();
  const retryCount = previousRetryCount + 1;
  return updateQueueItem(userId, id, {
    status: 'failed',
    retryCount,
    lastError,
    lastAttemptAt: now.toISOString(),
    nextRetryAt: new Date(now.getTime() + calculateRetryDelayMs(previousRetryCount)).toISOString(),
  });
}

export async function retryQueueItem(userId: string, id: string) {
  assertValidUserId(userId);
  return updateQueueItem(userId, id, {
    status: 'pending',
    nextRetryAt: undefined,
    lastError: undefined,
  });
}

export async function isOnline() {
  const state = await Network.getNetworkStateAsync();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}
