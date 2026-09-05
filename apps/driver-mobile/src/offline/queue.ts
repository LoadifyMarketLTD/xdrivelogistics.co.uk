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

export function queueStorageKey(userId: string): string {
  return `xdrive.driver.offlineQueue:${userId}`;
}

const legacyQueueKey = 'xdrive.driver.offlineQueue';
const maxRetryDelayMs = 15 * 60 * 1000;
const initialRetryDelayMs = 15 * 1000;
const retryableHttpStatuses = new Set([408, 425, 429]);
const persistedHttpStatusPattern = /\(HTTP\s+(\d{3})\)\s*$/i;

function stringPayload(payload: Record<string, unknown> | undefined, key: string) {
  const value = payload?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Status/POD/quote actions are one-per-job/per-endpoint while multi-drop stop
 * actions must also include stop identity and requested stop state. This keeps
 * queued retries idempotent without collapsing two different stops together.
 */
export function queueActionIdentity(action: Pick<QueuedAction, 'jobId' | 'endpoint' | 'payload'>) {
  if (action.endpoint === 'stop-status') {
    return [
      action.jobId,
      action.endpoint,
      stringPayload(action.payload, 'stop_id'),
      stringPayload(action.payload, 'status'),
    ].join(':');
  }
  return `${action.jobId}:${action.endpoint}`;
}

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
  const identity = queueActionIdentity(action);
  const existing = queue.find(
    (item) => queueActionIdentity(item) === identity && item.status !== 'synced',
  );
  if (existing) return existing;

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

export function isPersistedQueueFailureRetryable(lastError: string) {
  const match = persistedHttpStatusPattern.exec(lastError.trim());
  if (!match) return true;
  const status = Number(match[1]);
  return !(status >= 400 && status < 500 && !retryableHttpStatuses.has(status));
}

export function isQueueItemReady(item: QueuedAction, now = Date.now()) {
  if (item.status === 'syncing' || item.status === 'synced') return false;
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

export async function clearQueue(userId: string) {
  await AsyncStorage.multiRemove([queueStorageKey(userId), legacyQueueKey]);
  await Promise.all([
    clearPersistedPodEvidenceForUser(userId),
    clearPersistedCollectionEvidenceForUser(userId),
  ]);
}

export async function removeLegacyQueue() {
  await AsyncStorage.removeItem(legacyQueueKey);
}

export function reconcileQueueState(current: QueuedAction[], incoming: QueuedAction): QueuedAction[] {
  const idx = current.findIndex((item) => item.id === incoming.id);
  if (idx === -1) return [...current, incoming];
  const next = [...current];
  next[idx] = incoming;
  return next;
}
