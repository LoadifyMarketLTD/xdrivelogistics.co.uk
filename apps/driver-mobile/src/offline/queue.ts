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
};

const queueKey = 'xdrive.driver.offlineQueue';

export async function getQueue(): Promise<QueuedAction[]> {
  const raw = await AsyncStorage.getItem(queueKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedAction[];
  } catch {
    return [];
  }
}

export async function saveQueue(queue: QueuedAction[]) {
  await AsyncStorage.setItem(queueKey, JSON.stringify(queue));
}

export async function enqueueAction(action: Omit<QueuedAction, 'id' | 'status' | 'createdAt'>) {
  const queue = await getQueue();
  const queued: QueuedAction = {
    ...action,
    id: `${action.jobId}-${action.endpoint}-${Date.now()}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await saveQueue([queued, ...queue]);
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
