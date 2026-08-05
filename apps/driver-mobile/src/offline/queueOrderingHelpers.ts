/**
 * Helpers for offline queue ordering and per-job dependency decisions.
 *
 * Rules:
 * - Actions for a given job must be processed in the order they were enqueued
 *   (ascending createdAt / insertion order = oldest first).
 * - The `pod` endpoint must successfully sync before `delivered` for the same job.
 * - If any action for a job fails or is still pending/syncing, all later actions
 *   for that same job are blocked in the current flush pass.
 * - Actions for different jobs are independent and never block each other.
 */

import type { QueuedAction } from './queue';

/**
 * Canonical endpoint processing order for a single job.
 * Endpoints that appear earlier in this list must be processed first.
 * `pod` intentionally precedes `delivered` to enforce POD-before-delivery ordering.
 */
const ENDPOINT_LIFECYCLE_ORDER: readonly string[] = [
  'on-my-way-pickup',
  'arrived-pickup',
  'loaded',
  'on-my-way-delivery',
  'arrived-delivery',
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
 * 1. By lifecycle endpoint order (pod before delivered, etc.).
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
  // Group by jobId
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
      // First non-synced item gates all following items for this job.
      if (isReady(action)) {
        result.push(action);
      }
      // Whether ready or not, this item gates all later actions for this job.
      break;
    }
  }

  return result;
}

/**
 * Returns true if processing `item` should be blocked because an earlier action
 * for the same job has not yet successfully synced.
 *
 * Use this inside `flushQueue` after a per-item failure to decide whether to
 * skip the remaining actions for the same job.
 *
 * @param queue  The full current queue (reflects latest statuses after patches).
 * @param item   The item that just failed (or whose predecessor failed).
 */
export function isJobActionBlocked(queue: QueuedAction[], item: QueuedAction): boolean {
  const sorted = sortJobActions(queue.filter((q) => q.jobId === item.jobId));
  const itemOrder = endpointOrder(item.endpoint);
  return sorted.some(
    (q) => endpointOrder(q.endpoint) < itemOrder && q.status !== 'synced',
  );
}
