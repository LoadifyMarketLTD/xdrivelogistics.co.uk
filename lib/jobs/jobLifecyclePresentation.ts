// Shared presentation classifier for the canonical XDrive driver execution lifecycle.
// This module does NOT define or mutate the database state machine. The authoritative
// transition contract remains `driver_update_job_status_atomic`.

const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase();

export type JobLifecyclePresentationGroup = 'upcoming' | 'active' | 'completed' | 'cancelled' | 'other';

// Canonical aliases already accepted by the driver lifecycle RPC / historical data.
export function canonicalExecutionStatus(value: unknown): string {
  const status = normalise(value);
  switch (status) {
    case 'assigned':
    case 'accepted':
      return 'allocated';
    case 'arrived_pickup':
      return 'on_site_pickup';
    case 'collected':
      return 'loaded';
    case 'on_route_delivery':
      return 'in_transit';
    case 'arrived_delivery':
      return 'on_site_delivery';
    default:
      return status;
  }
}

export function jobLifecyclePresentationGroup(value: unknown): JobLifecyclePresentationGroup {
  const status = canonicalExecutionStatus(value);

  if (['awarded', 'allocated'].includes(status)) return 'upcoming';
  if (['on_my_way', 'on_site_pickup', 'loaded', 'in_transit', 'on_site_delivery'].includes(status)) return 'active';
  if (['delivered', 'completed', 'invoiced', 'paid'].includes(status)) return 'completed';
  if (['cancelled', 'expired'].includes(status)) return 'cancelled';
  return 'other';
}

export const DRIVER_JOB_SCOPE_STATUSES = {
  upcoming: ['awarded', 'allocated', 'assigned', 'accepted'],
  active: [
    'awarded',
    'allocated',
    'assigned',
    'accepted',
    'on_my_way',
    'on_site_pickup',
    'arrived_pickup',
    'loaded',
    'collected',
    'in_transit',
    'on_route_delivery',
    'on_site_delivery',
    'arrived_delivery',
  ],
  completed: ['delivered', 'completed', 'invoiced', 'paid'],
} as const;

export function driverJobStatusesForScope(scope: string | null | undefined): readonly string[] | null {
  const normalised = normalise(scope) || 'active';
  if (normalised === 'all') return null;
  if (normalised === 'upcoming') return DRIVER_JOB_SCOPE_STATUSES.upcoming;
  if (normalised === 'completed') return DRIVER_JOB_SCOPE_STATUSES.completed;
  return DRIVER_JOB_SCOPE_STATUSES.active;
}
