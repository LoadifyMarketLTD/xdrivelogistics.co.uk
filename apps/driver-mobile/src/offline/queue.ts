import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflineQueueItem } from '../types';

const QUEUE_KEY = 'xdrive_offline_queue';

async function readQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineQueueItem[];
  } catch {
    return [];
  }
}

async function writeQueue(items: OfflineQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function uuid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Enqueue an action to be executed when connectivity is restored.
 */
export async function enqueue(
  endpoint: string,
  method: OfflineQueueItem['method'],
  body: Record<string, unknown>
): Promise<string> {
  const items = await readQueue();
  const item: OfflineQueueItem = {
    id: uuid(),
    created_at: new Date().toISOString(),
    endpoint,
    method,
    body,
    status: 'pending',
    retry_count: 0,
    last_error: null,
  };
  items.push(item);
  await writeQueue(items);
  return item.id;
}

/**
 * Get all pending items (for display in the UI: "Pending sync" indicator).
 */
export async function getPendingItems(): Promise<OfflineQueueItem[]> {
  const items = await readQueue();
  return items.filter((i) => i.status === 'pending' || i.status === 'failed');
}

/**
 * Get count of pending items.
 */
export async function getPendingCount(): Promise<number> {
  const pending = await getPendingItems();
  return pending.length;
}

/**
 * Flush the queue — attempt to send all pending items.
 * Returns number of successfully flushed items.
 */
export async function flushQueue(
  getAuthToken: () => Promise<string | null>
): Promise<{ synced: number; failed: number }> {
  const items = await readQueue();
  const pending = items.filter((i) => i.status === 'pending' || i.status === 'failed');

  const token = await getAuthToken();
  if (!token) return { synced: 0, failed: pending.length };

  let synced = 0;
  let failed = 0;

  const updatedItems = [...items];

  for (const item of pending) {
    const idx = updatedItems.findIndex((i) => i.id === item.id);
    if (idx === -1) continue;

    updatedItems[idx] = { ...item, status: 'syncing' };
    await writeQueue(updatedItems);

    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
      const res = await fetch(`${baseUrl}${item.endpoint}`, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(item.body),
      });

      if (res.ok) {
        updatedItems[idx] = { ...updatedItems[idx], status: 'synced' };
        synced++;
      } else {
        const errBody = await res.text();
        updatedItems[idx] = {
          ...updatedItems[idx],
          status: 'failed',
          retry_count: item.retry_count + 1,
          last_error: `HTTP ${res.status}: ${errBody}`,
        };
        failed++;
      }
    } catch (err) {
      updatedItems[idx] = {
        ...updatedItems[idx],
        status: 'failed',
        retry_count: item.retry_count + 1,
        last_error: err instanceof Error ? err.message : 'Network error',
      };
      failed++;
    }

    await writeQueue(updatedItems);
  }

  // Remove items that have been synced and are older than 24 hours
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const pruned = updatedItems.filter(
    (i) => !(i.status === 'synced' && new Date(i.created_at).getTime() < cutoff)
  );
  await writeQueue(pruned);

  return { synced, failed };
}
