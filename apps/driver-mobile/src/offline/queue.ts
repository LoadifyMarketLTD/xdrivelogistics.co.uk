import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

import type { QueuedActionStatus } from '../jobs/types';

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

// Queue keys are scoped per authenticated user to prevent cross-account data leakage.
// Each driver's pending actions are stored under their own Supabase user ID.
// NOTE: Items persisted under the legacy global key 'xdrive.driver.offlineQueue' (before
// this change) are not migrated. They will be ignored — replaying another account's actions
// would be more harmful than losing unsynced items that will self-heal on next network sync.

function assertValidUserId(userId: string): void {
  if (!userId || !userId.trim()) {
    throw new Error('Queue operation requires an authenticated user identity.');
  }
}

export function queueKeyForUser(userId: string): string {
  assertValidUserId(userId);
  return `xdrive.driver.offlineQueue:${userId}`;
}

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
  assertValidUserId(userId);
  const raw = await AsyncStorage.getItem(queueKeyForUser(userId));
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Partial<QueuedAction>[]).map(normalizeQueueItem).filter((item) => item.id && item.jobId && item.endpoint);
  } catch {
    return [];
  }
}

export async function saveQueue(userId: string, queue: QueuedAction[]) {
  assertValidUserId(userId);
  await AsyncStorage.setItem(queueKeyForUser(userId), JSON.stringify(queue));
}

export async function enqueueAction(userId: string, action: Omit<QueuedAction, 'id' | 'status' | 'createdAt' | 'retryCount' | 'lastAttemptAt' | 'nextRetryAt' | 'lastError'>) {
  assertValidUserId(userId);
  const queue = await getQueue(userId);
  const queued: QueuedAction = {
    ...action,
    id: `${action.jobId}-${action.endpoint}-${Date.now()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  await saveQueue(userId, [queued, ...queue]);
  return queued;
}

export async function updateQueueItem(userId: string, id: string, patch: Partial<QueuedAction>) {
  assertValidUserId(userId);
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
