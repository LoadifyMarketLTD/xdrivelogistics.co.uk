type StatusHistoryEntry = {
  status?: unknown;
  lifecycle_status?: unknown;
};

export type ActionIdempotencyConfig = {
  currentStatus: string;
  timestampField?: 'on_my_way_at' | 'on_site_pickup_at' | 'loaded_at' | 'on_site_delivery_at' | 'delivered_at';
};

export type ActionIdempotencyJob = {
  current_status?: unknown;
  status?: unknown;
  status_history?: unknown;
  on_my_way_at?: unknown;
  on_site_pickup_at?: unknown;
  loaded_at?: unknown;
  on_site_delivery_at?: unknown;
  delivered_at?: unknown;
};

const CURRENT_STATUS_ORDER = [
  'posted',
  'quoted',
  'awarded',
  'allocated',
  'accepted',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'on_my_way_to_delivery',
  'on_site_delivery',
  'delivered',
] as const;

export function normalizeCurrentStatus(value: unknown): string {
  const s = String(value ?? '').toLowerCase().trim();
  if (s === 'assigned') return 'allocated';
  if (s === 'on_my_way') return 'on_my_way_to_pickup';
  if (s === 'arrived_pickup') return 'on_site_pickup';
  if (s === 'collected') return 'loaded';
  if (s === 'in_transit') return 'on_my_way_to_delivery';
  if (s === 'on_route_delivery') return 'on_my_way_to_delivery';
  if (s === 'arrived_delivery') return 'on_site_delivery';
  return s;
}

export function normalizedCurrentOrNull(value: unknown): string | null {
  return normalizeCurrentStatus(value) || null;
}

const hasNonEmptyString = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const hasReachedOrPassedStep = (current: string, target: string): boolean => {
  const currentIndex = CURRENT_STATUS_ORDER.indexOf(current as (typeof CURRENT_STATUS_ORDER)[number]);
  const targetIndex = CURRENT_STATUS_ORDER.indexOf(target as (typeof CURRENT_STATUS_ORDER)[number]);
  if (currentIndex < 0 || targetIndex < 0) return false;
  return currentIndex >= targetIndex;
};

const TIMESTAMP_FIELDS_BY_STATUS: Partial<Record<(typeof CURRENT_STATUS_ORDER)[number], ActionIdempotencyConfig['timestampField']>> = {
  on_my_way_to_pickup: 'on_my_way_at',
  on_site_pickup: 'on_site_pickup_at',
  loaded: 'loaded_at',
  on_site_delivery: 'on_site_delivery_at',
  delivered: 'delivered_at',
};

const statusHistoryIncludes = (history: unknown, target: string): boolean => {
  if (!Array.isArray(history)) return false;
  return history.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const e = entry as StatusHistoryEntry;
    return (
      normalizeCurrentStatus(e.lifecycle_status) === target ||
      normalizeCurrentStatus(e.status) === target
    );
  });
};

const hasTimestampEvidenceFromTargetOrLater = (job: ActionIdempotencyJob, target: string): boolean => {
  const targetIndex = CURRENT_STATUS_ORDER.indexOf(target as (typeof CURRENT_STATUS_ORDER)[number]);
  if (targetIndex < 0) return false;

  for (let i = targetIndex; i < CURRENT_STATUS_ORDER.length; i += 1) {
    const status = CURRENT_STATUS_ORDER[i];
    const field = TIMESTAMP_FIELDS_BY_STATUS[status];
    if (field && hasNonEmptyString(job[field])) return true;
  }
  return false;
};

export function hasActionAlreadyApplied(
  job: ActionIdempotencyJob,
  config: ActionIdempotencyConfig
): boolean {
  const currentStatus = normalizedCurrentOrNull(job.current_status);
  if (currentStatus === config.currentStatus) return true;
  if (config.timestampField && hasNonEmptyString(job[config.timestampField])) return true;
  if (statusHistoryIncludes(job.status_history, config.currentStatus)) return true;
  if (currentStatus && hasReachedOrPassedStep(currentStatus, config.currentStatus)) {
    // Corrupted/stale current_status alone is insufficient. Require additional
    // server-side evidence that this target action really occurred.
    return hasTimestampEvidenceFromTargetOrLater(job, config.currentStatus)
      || statusHistoryIncludes(job.status_history, config.currentStatus);
  }
  return false;
}
