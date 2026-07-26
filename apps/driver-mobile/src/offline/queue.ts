import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

import type { QueuedActionStatus } from '../jobs/types';

export type QueuedAction = {
  id: string;
  /** Immutable identity of the authenticated driver who created this action. */
  ownerUserId: string;
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

/**
 * Enqueue a driver action. If a pending or failed item already exists for the
 * same jobId + endpoint, it is superseded in place (same ID, reset retry count)
 * rather than creating a duplicate. This prevents repeated taps from flooding
 * the queue with identical work items.
 */
export async function enqueueAction(userId: string, action: Omit<QueuedAction, 'id' | 'ownerUserId' | 'status' | 'createdAt' | 'retryCount' | 'lastAttemptAt' | 'nextRetryAt' | 'lastError'>) {
  assertValidUserId(userId);
  const queue = await getQueue(userId);

  // Find an existing pending/failed item for the same logical action to supersede.
  const existingIndex = queue.findIndex(
    (item) => item.jobId === action.jobId && item.endpoint === action.endpoint
      && (item.status === 'pending' || item.status === 'failed'),
  );

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
