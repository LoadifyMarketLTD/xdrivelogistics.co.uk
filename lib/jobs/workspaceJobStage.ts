export type WorkspaceJobStage =
  | 'open'
  | 'unallocated'
  | 'allocated'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'disputed'
  | 'unknown';

export type WorkspaceStageJob = {
  status?: string | null;
  current_status?: string | null;
  awarded_carrier_company_id?: string | null;
  assigned_company_id?: string | null;
  assigned_driver_id?: string | null;
};

export const IN_PROGRESS_JOB_STATUSES = new Set([
  'on_my_way',
  'on_my_way_to_pickup',
  'on_site_pickup',
  'loaded',
  'collected',
  'in_transit',
  'on_my_way_to_delivery',
  'on_site_delivery',
]);

export const COMPLETED_JOB_STATUSES = new Set(['delivered', 'completed', 'invoiced', 'paid']);
export const CANCELLED_JOB_STATUSES = new Set(['cancelled', 'driver_declined']);
export const ALLOCATED_JOB_STATUSES = new Set(['allocated', 'accepted']);
export const OPEN_JOB_STATUSES = new Set(['draft', 'received', 'posted', 'quoted']);

export function normalizedJobStatus(job: WorkspaceStageJob) {
  return String(job.current_status ?? job.status ?? '').trim().toLowerCase();
}

/**
 * One canonical operational stage classifier for workspace views.
 *
 * Award and allocation are intentionally different:
 * - awarded carrier + no driver => unallocated company work;
 * - assigned driver / allocated / accepted => allocated, not in progress;
 * - execution starts only when the driver moves toward pickup or later.
 *
 * A page may still apply a role/company scope before calling this classifier,
 * but it must not redefine the lifecycle buckets locally.
 */
export function classifyWorkspaceJobStage(job: WorkspaceStageJob): WorkspaceJobStage {
  const status = normalizedJobStatus(job);

  if (CANCELLED_JOB_STATUSES.has(status)) return 'cancelled';
  if (status === 'expired') return 'expired';
  if (status === 'disputed') return 'disputed';
  if (COMPLETED_JOB_STATUSES.has(status)) return 'completed';
  if (IN_PROGRESS_JOB_STATUSES.has(status)) return 'in_progress';

  if (ALLOCATED_JOB_STATUSES.has(status) || Boolean(job.assigned_driver_id)) return 'allocated';

  if (
    status === 'awarded'
    || Boolean(job.awarded_carrier_company_id)
    || Boolean(job.assigned_company_id)
  ) {
    return 'unallocated';
  }

  if (OPEN_JOB_STATUSES.has(status)) return 'open';
  return 'unknown';
}

export function isExecutionStage(job: WorkspaceStageJob) {
  const stage = classifyWorkspaceJobStage(job);
  return stage === 'allocated' || stage === 'in_progress';
}
