import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
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
    const { data, error } = await supabase.auth.getSession();
    if (!error) {
      const userId = data.session?.user?.id?.trim();
      if (userId) {
        lastAuthenticatedQueueKey = `${queueKeyPrefix}.${userId}`;
        return lastAuthenticatedQueueKey;
      }
      // A successful unauthenticated lookup means the user signed out. Never
      // expose the previous user's queue merely because it remains cached.
      return null;
    }
  } catch {
    // True offline/session lookup failures may still use the last authenticated
    // per-user key for this process so queued actions remain available offline.
  }
  return lastAuthenticatedQueueKey;
}

function cleanUri(uri: string) {
  return uri.split('?', 1)[0] ?? uri;
}

async function persistQueuedFile(uri: string, jobId: string, label: string) {
  const root = FileSystem.documentDirectory;
  if (!root || !uri) return uri;
  if (uri.startsWith(`${root}pod-evidence/`)) return uri;

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('Evidence selected for offline sync is no longer available on this device.');

  const safeJob = jobId.replace(/[^a-z0-9-]/gi, '');
  const folder = `${root}pod-evidence/${safeJob}/offline/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });

  const clean = cleanUri(uri);
  const extensionMatch = clean.match(/\.([A-Za-z0-9]{2,5})$/);
  const extension = extensionMatch?.[1]?.toLowerCase() || 'jpg';
  const safeLabel = label.replace(/[^a-z0-9-]/gi, '-').slice(0, 40) || 'evidence';
  const destination = `${folder}${safeLabel}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}

async function persistQueuedPayload(jobId: string, payload: Record<string, unknown> | undefined) {
  if (!payload) return payload;
  const next: Record<string, unknown> = { ...payload };

  const persistArray = async (key: string) => {
    const values = Array.isArray(payload[key])
      ? (payload[key] as unknown[]).filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
    if (values.length > 0) {
      next[key] = await Promise.all(values.map((uri, index) => persistQueuedFile(uri, jobId, `${key}-${index + 1}`)));
    }
  };

  await persistArray('pickupPhotoUris');
  await persistArray('deliveryPhotoUris');
  await persistArray('damagePhotoUris');
  await persistArray('documentUris');

  if (typeof payload.collectionPhotoUri === 'string' && payload.collectionPhotoUri) {
    next.collectionPhotoUri = await persistQueuedFile(payload.collectionPhotoUri, jobId, 'collection');
  }

  return next;
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
  const payload = await persistQueuedPayload(action.jobId, action.payload);
  const queued: QueuedAction = {
    ...action,
    payload,
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

export function clearQueueSessionCache() {
  lastAuthenticatedQueueKey = null;
}

export async function isOnline() {
  const state = await Network.getNetworkStateAsync();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}
