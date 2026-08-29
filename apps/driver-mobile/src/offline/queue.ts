import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

import type { QueuedActionStatus } from '../jobs/types';
import {
  clearPersistedCollectionEvidenceForUser,
  persistQueuedCollectionPayload,
} from './collectionEvidencePersistence';
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
  retryMode?: 'automatic' | 'manual';
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
const retryableHttpStatuses = new Set([408, 425, 429]);
const persistedHttpStatusPattern = /\(HTTP\s+(\d{3})\)\s*$/i;

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
    retryMode: item.retryMode === 'manual' ? 'manual' : item.retryMode === 'automatic' ? 'automatic' : undefined,
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

export async function enqueueAction(userId: string, action: Omit<QueuedAction, 'id' | 'status' | 'createdAt' | 'retryCount' | 'lastAttemptAt' | 'nextRetryAt' | 'lastError' | 'retryMode'>) {
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

  // Evidence-bearing queue entries must never point only at ImagePicker or
  // DocumentPicker cache. Persist them before committing the AsyncStorage item so
  // replay remains valid after process restart or cache eviction.
  let payload = action.payload;
  if (action.endpoint === 'pod' && action.payload) {
    payload = await persistQueuedPodPayload(userId, action.jobId, action.payload);
  } else if (action.endpoint === 'loaded') {
    if (!action.payload) throw new Error('A collection photo is required before Loaded can be queued.');
    payload = await persistQueuedCollectionPayload(userId, action.jobId, action.payload);
  }

  const queued: QueuedAction = {
    ...action,
    payload,
    id: `${action.jobId}-${action.endpoint}-${Date.now()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
    retryMode: 'automatic',
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

/**
 * Queue replay persists only an error string, not the ApiRequestError instance.
 * ApiRequestError therefore appends `(HTTP NNN)` to its message. Reconstruct the
 * retry classification here so a permanent 4xx stays terminal even after an app
 * restart. Unknown/network/5xx errors remain automatically retryable.
 */
export function isPersistedQueueFailureRetryable(lastError: string) {
  const match = persistedHttpStatusPattern.exec(lastError.trim());
  if (!match) return true;
  const status = Number(match[1]);
  return !(status >= 400 && status < 500 && !retryableHttpStatuses.has(status));
}

export function isQueueItemReady(item: QueuedAction, now = Date.now()) {
  if (item.status === 'syncing' || item.status === 'synced') return false;
  // A permanent client-side/API contract failure must remain visible but must
  // never be replayed automatically. The driver can explicitly choose Retry
  // after the underlying assignment/POD/validation issue has been corrected.
  if (item.retryMode === 'manual') return false;
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
    retryMode: undefined,
  });
}

export async function markQueueItemFailed(
  userId: string,
  id: string,
  lastError: string,
  previousRetryCount: number,
  options: { retryable?: boolean } = {},
) {
  const now = new Date();
  const retryCount = previousRetryCount + 1;
  const retryable = options.retryable ?? isPersistedQueueFailureRetryable(lastError);
  return updateQueueItem(userId, id, {
    status: 'failed',
    retryCount,
    lastError,
    lastAttemptAt: now.toISOString(),
    nextRetryAt: retryable
      ? new Date(now.getTime() + calculateRetryDelayMs(previousRetryCount)).toISOString()
      : undefined,
    retryMode: retryable ? 'automatic' : 'manual',
  });
}

export async function retryQueueItem(userId: string, id: string) {
  return updateQueueItem(userId, id, {
    status: 'pending',
    nextRetryAt: undefined,
    lastError: undefined,
    retryMode: 'automatic',
  });
}

export async function isOnline() {
  const state = await Network.getNetworkStateAsync();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

/**
 * Clear the account-scoped queue for the given user.
 * Also removes the legacy unscoped key and all durable queued evidence so
 * sign-out cannot leave another driver's POD or collection photos behind.
 */
export async function clearQueue(userId: string) {
  await AsyncStorage.multiRemove([queueStorageKey(userId), legacyQueueKey]);
  await Promise.all([
    clearPersistedPodEvidenceForUser(userId),
    clearPersistedCollectionEvidenceForUser(userId),
  ]);
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
