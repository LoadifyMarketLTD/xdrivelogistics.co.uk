type StatusHistoryEntry = {
  status?: unknown;
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
  if (s === 'on_my_way') return 'on_my_way_to_pickup';
  if (s === 'in_transit') return 'on_my_way_to_delivery';
  return s;
}

export function normalizedCurrentOrNull(value: unknown): string | null {
  return normalizeCurrentStatus(value) || null;
}

const normalizeLifecycle = (value: unknown) => String(value ?? '').toLowerCase().trim();

const hasNonEmptyString = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const hasReachedOrPassedStep = (current: string, target: string): boolean => {
  const currentIndex = CURRENT_STATUS_ORDER.indexOf(current as (typeof CURRENT_STATUS_ORDER)[number]);
  const targetIndex = CURRENT_STATUS_ORDER.indexOf(target as (typeof CURRENT_STATUS_ORDER)[number]);
  if (currentIndex < 0 || targetIndex < 0) return false;
  return currentIndex >= targetIndex;
};

const statusHistoryIncludes = (history: unknown, target: string): boolean => {
  if (!Array.isArray(history)) return false;
  return history.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return normalizeCurrentStatus((entry as StatusHistoryEntry).status) === target;
  });
};

export function hasActionAlreadyApplied(
  job: ActionIdempotencyJob,
  config: ActionIdempotencyConfig
): boolean {
  const currentStatus = normalizedCurrentOrNull(job.current_status);
  if (currentStatus === config.currentStatus) return true;
  if (currentStatus && hasReachedOrPassedStep(currentStatus, config.currentStatus)) return true;
  if (config.timestampField && hasNonEmptyString(job[config.timestampField])) return true;
  if (statusHistoryIncludes(job.status_history, config.currentStatus)) return true;
  if (config.currentStatus === 'delivered' && normalizeLifecycle(job.status) === 'delivered') return true;
  return false;
}
