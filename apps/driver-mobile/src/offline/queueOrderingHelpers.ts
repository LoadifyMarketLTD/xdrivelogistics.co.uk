/**
 * Helpers for offline queue ordering and per-job dependency decisions.
 *
 * Rules:
 * - Actions for a given job must be processed in canonical lifecycle order.
 * - Repeated actions at the same lifecycle position use createdAt/insertion order.
 * - Every queued multi-drop stop update must sync before POD/final Delivered.
 * - The `pod` endpoint must successfully sync before `delivered` for the same job.
 * - If any action for a job fails or is still pending/syncing, all later actions
 *   for that same job are blocked in the current flush pass.
 * - Actions for different jobs are independent and never block each other.
 */

import type { QueuedAction } from './queue';

/**
 * Canonical endpoint processing order for a single job.
 *
 * `stop-status` is intentionally immediately before POD. Multi-drop stop
 * Arrived/Completed events keep their own creation order because they share the
 * same endpoint ordinal. This guarantees that no offline POD or final Delivered
 * action can overtake an unsynced stop update.
 */
const ENDPOINT_LIFECYCLE_ORDER: readonly string[] = [
  'on-my-way-pickup',
  'arrived-pickup',
  'loaded',
  'on-my-way-delivery',
  'arrived-delivery',
  'stop-status',
  'pod',
  'delivered',
];

/**
 * Returns the lifecycle position of an endpoint. Unknown endpoints receive a
 * high ordinal so they sort after all known steps.
 */
export function endpointOrder(endpoint: string): number {
  const idx = ENDPOINT_LIFECYCLE_ORDER.indexOf(endpoint);
  return idx >= 0 ? idx : ENDPOINT_LIFECYCLE_ORDER.length;
}

/**
 * Sorts queue items for a single job into the correct processing order:
 * 1. By lifecycle endpoint order (all stop-status before pod before delivered).
 * 2. By `createdAt` ascending as a tiebreaker (oldest first).
 */
export function sortJobActions(actions: QueuedAction[]): QueuedAction[] {
  return [...actions].sort((a, b) => {
    const orderDiff = endpointOrder(a.endpoint) - endpointOrder(b.endpoint);
    if (orderDiff !== 0) return orderDiff;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

/**
 * Given the full queue, returns only the items that are ready to be processed
 * in this flush pass, respecting per-job ordering and dependency rules.
 *
 * For each job:
 *   - Actions are sorted by lifecycle order (oldest-first tiebreaker).
 *   - The first non-synced action is eligible if `isReady(item)` returns true.
 *   - If the first non-synced action is NOT ready (pending retry back-off,
 *     currently syncing, or failed), all subsequent actions for that job are
 *     blocked.
 *
 * Actions for different jobs never block each other.
 *
 * @param queue   Full queue (all statuses).
 * @param isReady Predicate that returns true when an item may be attempted now.
 */
export function getReadyActionsInOrder(
  queue: QueuedAction[],
  isReady: (item: QueuedAction) => boolean,
): QueuedAction[] {
  const byJob = new Map<string, QueuedAction[]>();
  for (const item of queue) {
    if (!byJob.has(item.jobId)) byJob.set(item.jobId, []);
    byJob.get(item.jobId)!.push(item);
  }

  const result: QueuedAction[] = [];

  for (const [, actions] of byJob) {
    const sorted = sortJobActions(actions);
    for (const action of sorted) {
      if (action.status === 'synced') continue;
      if (isReady(action)) result.push(action);
      break;
    }
  }

  return result;
}

/**
 * Returns true if processing `item` should be blocked because an earlier action
 * for the same job has not yet successfully synced.
 */
export function isJobActionBlocked(queue: QueuedAction[], item: QueuedAction): boolean {
  const sorted = sortJobActions(queue.filter((q) => q.jobId === item.jobId));
  const itemIndex = sorted.findIndex((candidate) => candidate.id === item.id);
  if (itemIndex <= 0) return false;
  return sorted.slice(0, itemIndex).some((candidate) => candidate.status !== 'synced');
}
