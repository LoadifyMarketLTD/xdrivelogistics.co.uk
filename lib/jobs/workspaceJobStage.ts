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
  vehicle_id?: string | null;
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

/**
 * Canonical status text for workspace presentation.
 *
 * Legacy/test rows can contain a stale raw status such as `posted` even after
 * award/allocation identifiers have been persisted. The classifier already
 * treats those authoritative identifiers as stronger lifecycle facts. This
 * helper keeps UI badges truthful without mutating historical data or
 * inventing a backend lifecycle transition.
 *
 * A complete allocation requires driver + canonical vehicle. When `vehicle_id`
 * is available, a driver-only assignment is therefore presented as carrier
 * awarded, not allocated. When a lightweight dataset does not expose
 * `vehicle_id`, a stale open raw status plus an awarded carrier is also kept at
 * the conservative `awarded` presentation; only a canonical allocated/accepted
 * raw status may claim allocation on that reduced projection.
 *
 * Execution/completion states keep their specific raw status because labels
 * such as `loaded`, `on_site_delivery` and `delivered` remain operationally
 * useful.
 */
export function workspaceJobPresentationStatus(job: WorkspaceStageJob) {
  const raw = normalizedJobStatus(job);
  const stage = classifyWorkspaceJobStage(job);
  const vehicleFactAvailable = Object.prototype.hasOwnProperty.call(job, 'vehicle_id');
  const incompleteKnownAllocation = vehicleFactAvailable
    && Boolean(job.assigned_driver_id)
    && !job.vehicle_id;
  const awardedFact = Boolean(job.awarded_carrier_company_id || job.assigned_company_id);

  if (
    stage === 'allocated'
    && !IN_PROGRESS_JOB_STATUSES.has(raw)
    && !COMPLETED_JOB_STATUSES.has(raw)
  ) {
    if (incompleteKnownAllocation && awardedFact) return 'awarded';
    if (!vehicleFactAvailable && OPEN_JOB_STATUSES.has(raw) && awardedFact) return 'awarded';
    return 'allocated';
  }
  if (stage === 'awarded') return 'awarded';
  return raw || stage;
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
