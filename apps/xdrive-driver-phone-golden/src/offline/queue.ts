import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

import { supabase } from '../auth/supabase';
import type { QueuedActionStatus } from '../jobs/types';

export type QueuedAction = {
  id: string;
  jobId: string;
  endpoint: string;
  payload?: Record<string, unknown>;
  status: QueuedActionStatus;
  createdAt: string;
  lastError?: string;
};

const queueKeyPrefix = 'xdrive.driver.offlineQueue.v2';
let lastAuthenticatedQueueKey: string | null = null;

async function resolveQueueKey() {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id?.trim();
    if (userId) {
      lastAuthenticatedQueueKey = `${queueKeyPrefix}.${userId}`;
      return lastAuthenticatedQueueKey;
    }
  } catch {
    // Offline access can still use the last queue resolved for this process.
  }
  return lastAuthenticatedQueueKey;
}

export async function getQueue(): Promise<QueuedAction[]> {
  const queueKey = await resolveQueueKey();
  if (!queueKey) return [];

  const raw = await AsyncStorage.getItem(queueKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedAction[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } catch {
    return [];
  }
}

export async function saveQueue(queue: QueuedAction[]) {
  const queueKey = await resolveQueueKey();
  if (!queueKey) return;
  const ordered = [...queue].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  await AsyncStorage.setItem(queueKey, JSON.stringify(ordered));
}

export async function enqueueAction(action: Omit<QueuedAction, 'id' | 'status' | 'createdAt'>) {
  const queueKey = await resolveQueueKey();
  if (!queueKey) throw new Error('Driver session is unavailable for offline sync.');

  const queue = await getQueue();
  const createdAt = new Date().toISOString();
  const queued: QueuedAction = {
    ...action,
    id: `${action.jobId}-${action.endpoint}-${Date.now()}`,
    status: 'pending',
    createdAt,
  };
  await saveQueue([...queue, queued]);
  return queued;
}

export async function updateQueueItem(id: string, patch: Partial<QueuedAction>) {
  const queue = await getQueue();
  const next = queue.map((item) => (item.id === id ? { ...item, ...patch } : item));
  await saveQueue(next);
  return next;
}

export async function isOnline() {
  const state = await Network.getNetworkStateAsync();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}
