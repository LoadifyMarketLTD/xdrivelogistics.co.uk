// Shared presentation classifier for the canonical XDrive driver execution lifecycle.
// This module does NOT define or mutate the database state machine. The authoritative
// transition contract remains `driver_update_job_status_atomic`.

import {
  ALLOCATED_JOB_STATUSES,
  canonicalWorkspaceJobStatus,
  COMPLETED_JOB_STATUSES,
  IN_PROGRESS_JOB_STATUSES,
} from './workspaceJobStage';

const normalise = (value: unknown) => String(value ?? '').trim().toLowerCase();

export type JobLifecyclePresentationGroup = 'upcoming' | 'active' | 'completed' | 'cancelled' | 'other';
export type DriverJobView = 'all' | 'active' | 'allocated' | 'loaded' | 'in_transit' | 'completed';

export const canonicalExecutionStatus = canonicalWorkspaceJobStatus;

export function jobLifecyclePresentationGroup(value: unknown): JobLifecyclePresentationGroup {
  const status = canonicalExecutionStatus(value);

  if (status === 'awarded' || ALLOCATED_JOB_STATUSES.has(status)) return 'upcoming';
  if (IN_PROGRESS_JOB_STATUSES.has(status)) return 'active';
  if (COMPLETED_JOB_STATUSES.has(status)) return 'completed';
  if (status === 'cancelled' || status === 'expired') return 'cancelled';
  return 'other';
}

export function matchesDriverJobView(value: unknown, view: DriverJobView): boolean {
  if (view === 'all') return true;
  const status = canonicalExecutionStatus(value);
  const group = jobLifecyclePresentationGroup(status);

  if (view === 'active') return group === 'active';
  if (view === 'allocated') return group === 'upcoming';
  if (view === 'loaded') return status === 'loaded';
  if (view === 'in_transit') return status === 'in_transit' || status === 'on_site_delivery';
  return group === 'completed';
}

const legacyExecutionAliases = ['arrived_pickup', 'collected', 'on_route_delivery', 'arrived_delivery'] as const;

export const DRIVER_JOB_SCOPE_STATUSES = {
  upcoming: ['awarded', ...ALLOCATED_JOB_STATUSES, 'assigned'],
  active: [...IN_PROGRESS_JOB_STATUSES, ...legacyExecutionAliases],
  completed: [...COMPLETED_JOB_STATUSES],
} as const;

export function driverJobStatusesForScope(scope: string | null | undefined): readonly string[] | null {
  const normalised = normalise(scope) || 'active';
  if (normalised === 'all') return null;
  if (normalised === 'upcoming') return DRIVER_JOB_SCOPE_STATUSES.upcoming;
  if (normalised === 'completed') return DRIVER_JOB_SCOPE_STATUSES.completed;
  return DRIVER_JOB_SCOPE_STATUSES.active;
}
