import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

import type { QueuedActionStatus } from '../jobs/types';
import { clearPersistedPodEvidenceForUser, persistQueuedPodPayload } from './podEvidencePersistence';

export type QueuedAction = {
  id: string;
  jobId: string;
  endpoint: string;
  payload?: Record<string, unknown>;
  status: QueuedActionStatus;
  createdAt: string;
  lastError?: string;
  retryCount: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
};

/**
 * Returns the AsyncStorage key scoped to the authenticated user.
 * Using a per-user key prevents one driver's queued actions from being
 * read, retried or flushed by another driver who signs in on the same device.
 */
export function queueStorageKey(userId: string): string {
  return `xdrive.driver.offlineQueue:${userId}`;
}

/**
 * The legacy (unscoped) key used before account isolation was introduced.
 * Only used during cleanup — never read into a new user's queue.
 */
const legacyQueueKey = 'xdrive.driver.offlineQueue';

const maxRetryDelayMs = 15 * 60 * 1000;
const initialRetryDelayMs = 15 * 1000;

function normalizeQueueItem(item: Partial<QueuedAction>) {
  return {
    id: String(item.id ?? ''),
    jobId: String(item.jobId ?? ''),
    endpoint: String(item.endpoint ?? ''),
    payload: item.payload,
    status: (item.status ?? 'pending') as QueuedActionStatus,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
    lastError: typeof item.lastError === 'string' ? item.lastError : undefined,
    retryCount: Number.isFinite(item.retryCount) ? Number(item.retryCount) : 0,
    lastAttemptAt: typeof item.lastAttemptAt === 'string' ? item.lastAttemptAt : undefined,
    nextRetryAt: typeof item.nextRetryAt === 'string' ? item.nextRetryAt : undefined,
  } satisfies QueuedAction;
}

export async function getQueue(userId: string): Promise<QueuedAction[]> {
  const raw = await AsyncStorage.getItem(queueStorageKey(userId));
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Partial<QueuedAction>[]).map(normalizeQueueItem).filter((item) => item.id && item.jobId && item.endpoint);
  } catch {
    return [];
  }
}

export async function saveQueue(userId: string, queue: QueuedAction[]) {
  await AsyncStorage.setItem(queueStorageKey(userId), JSON.stringify(queue));
}

export async function enqueueAction(userId: string, action: Omit<QueuedAction, 'id' | 'status' | 'createdAt' | 'retryCount' | 'lastAttemptAt' | 'nextRetryAt' | 'lastError'>) {
  const queue = await getQueue(userId);
  // Prevent duplicate: if a pending/syncing/failed item for the same job and
  // endpoint already exists, return the existing item rather than adding another.
  const existing = queue.find(
    (item) =>
      item.jobId === action.jobId &&
      item.endpoint === action.endpoint &&
      item.status !== 'synced',
  );
  if (existing) return existing;

  // POD queue entries must never point only at ImagePicker/DocumentPicker cache.
  // Persist evidence before committing the queue item so replay remains valid
  // after process restart or cache eviction.
  const payload = action.endpoint === 'pod' && action.payload
    ? await persistQueuedPodPayload(userId, action.jobId, action.payload)
    : action.payload;

  const queued: QueuedAction = {
    ...action,
    payload,
    id: `${action.jobId}-${action.endpoint}-${Date.now()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  await saveQueue(userId, [...queue, queued]);
  return queued;
}

export async function updateQueueItem(userId: string, id: string, patch: Partial<QueuedAction>) {
  const queue = await getQueue(userId);
  const next = queue.map((item) => (item.id === id ? { ...item, ...patch } : item));
  await saveQueue(userId, next);
  return next;
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
  return updateQueueItem(userId, id, {
    status: 'syncing',
    lastAttemptAt: new Date().toISOString(),
  });
}

export async function markQueueItemSynced(userId: string, id: string) {
  return updateQueueItem(userId, id, {
    status: 'synced',
    lastError: undefined,
    lastAttemptAt: new Date().toISOString(),
    nextRetryAt: undefined,
  });
}

export async function markQueueItemFailed(userId: string, id: string, lastError: string, previousRetryCount: number) {
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

/**
 * Clear the account-scoped queue for the given user.
 * Also removes the legacy unscoped key and any durable queued POD evidence so
 * sign-out cannot leave another driver's documents on the next local session.
 */
export async function clearQueue(userId: string) {
  await AsyncStorage.multiRemove([queueStorageKey(userId), legacyQueueKey]);
  await clearPersistedPodEvidenceForUser(userId);
}

/**
 * Remove the legacy unscoped queue key without knowing the user.
 * Safe to call at app startup to clean up old data from pre-isolation versions.
 */
export async function removeLegacyQueue() {
  await AsyncStorage.removeItem(legacyQueueKey);
}

/**
 * Immutable upsert of a single queue item into an existing React state array.
 *
 * Rules:
 * - If an item with the same `id` already exists, it is replaced in-place.
 * - If no matching item exists, the new item is appended.
 * - The authoritative ordering returned by `enqueueAction` (newest-last, with
 *   lifecycle dependencies preserved) is maintained.
 *
 * Use this wherever React state must be updated after an `enqueueAction` call
 * to guarantee that double-taps or repeated failure/offline paths never produce
 * duplicate rows in the UI.
 */
export function reconcileQueueState(current: QueuedAction[], incoming: QueuedAction): QueuedAction[] {
  const idx = current.findIndex((item) => item.id === incoming.id);
  if (idx === -1) return [...current, incoming];
  const next = [...current];
  next[idx] = incoming;
  return next;
}
