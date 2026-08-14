export type WorkspaceJobStage =
  | 'open'
  | 'awarded'
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
 * Canonical lifecycle stage. This deliberately does not use workspace queue
 * labels such as `unallocated`: the same awarded job means "allocated to a
 * carrier" for a broker/customer but "won and still unallocated to a driver"
 * for that carrier's Fleet workspace.
 *
 * Workspace pages may map this lifecycle stage into their own queue labels,
 * but must not redefine which raw statuses constitute award, allocation,
 * execution or completion.
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
    return 'awarded';
  }

  if (OPEN_JOB_STATUSES.has(status)) return 'open';
  return 'unknown';
}

export function isExecutionStage(job: WorkspaceStageJob) {
  const stage = classifyWorkspaceJobStage(job);
  return stage === 'allocated' || stage === 'in_progress';
}

export function fleetQueueStage(job: WorkspaceStageJob) {
  const stage = classifyWorkspaceJobStage(job);
  if (stage === 'awarded') return 'unallocated' as const;
  return stage;
}

export function brokerDiaryStage(job: WorkspaceStageJob) {
  const stage = classifyWorkspaceJobStage(job);
  if (stage === 'open') return 'unallocated' as const;
  if (stage === 'awarded') return 'allocated' as const;
  return stage;
}
