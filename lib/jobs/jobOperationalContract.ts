/**
 * jobOperationalContract
 *
 * Canonical domain module for jobs operational business rules.
 * This module owns:
 *   - Shared type interfaces (JobRow, AdminJobFields)
 *   - Typed adapter (jobToRow)
 *   - Status transition guard (ALLOWED_STATUS_TRANSITIONS, allowedStatusTransitions)
 *   - Direct Invite eligibility rule (isDirectInviteEligible)
 *   - Driver filter helper (filterJobsByDriver)
 *   - Status deep-link resolver (JOBS_STATUS_FILTER_VALUES, resolveJobStatusFilter)
 *
 * All status values are sourced from the canonical JOB_STATUS constants in
 * app/config/company.ts — no string literals are duplicated here.
 *
 * Reference: docs/ui/cx/jobs.md
 */

import {
  JOB_STATUS,
  type JobStatus,
} from '../../app/config/company';
import type { LoadDetailItem } from '../loadPostingDetails';

/* ─── Types ─────────────────────────────────────────────────────────────── */

/** Full display + operational data carried by every table row. */
export interface JobRow {
  id: string;
  jobRef: string;
  status: string;
  client: { name: string };
  /** Client contact — restored from pre-refactor presentation */
  clientEmail?: string;
  clientPhone?: string;
  pickup: { location: string; date: string; time: string; postcode?: string };
  delivery: { location: string; date: string; time: string; postcode?: string };
  vehicleType: string;
  /** Pre-formatted distance string, e.g. "42.3 mi", or empty string. */
  distanceMiles: string;
  createdAt: string;
  updatedAt: string;
  /** Authoritative driver assignment UUID (FK to drivers.id). Null = unassigned. */
  assignedDriverId?: string | null;
  exchange_visibility?: string | null;
  awarded_carrier_company_id?: string | null;
  direct_invite_company_id?: string | null;
  paymentTerms?: string;
  cargo?: { type: string; quantity: number; notes: string };
  loadDetailSummary?: LoadDetailItem[];
}

/**
 * Input shape accepted by jobToRow — a superset of JobRow that includes all
 * fields present on the Supabase-mapped admin Job object.
 * Exported so page.tsx can use it as a typed constraint without maintaining a
 * duplicate interface.
 */
export interface AdminJobFields {
  id: string;
  jobRef: string;
  status: string;
  client: { name: string; email: string; phone: string };
  pickup: { location: string; date: string; time: string; postcode?: string };
  delivery: { location: string; date: string; time: string; postcode?: string };
  vehicleType: string;
  distanceMiles: string;
  createdAt: string;
  updatedAt: string;
  /** Authoritative driver assignment UUID (FK to drivers.id). Null = unassigned. */
  assignedDriverId?: string | null;
  exchange_visibility?: string | null;
  awarded_carrier_company_id?: string | null;
  direct_invite_company_id?: string | null;
  paymentTerms?: string;
  cargo?: { type: string; quantity: number; notes: string };
  loadDetailSummary?: LoadDetailItem[];
}

/**
 * Typed adapter — converts an AdminJobFields record to a JobRow without any
 * `as unknown as` coercion.  Every field is mapped explicitly so that contract
 * mismatches surface as compile-time errors rather than silent runtime bugs.
 */
export function jobToRow(job: AdminJobFields): JobRow {
  return {
    id: job.id,
    jobRef: job.jobRef,
    status: job.status,
    client: { name: job.client.name },
    clientEmail: job.client.email || undefined,
    clientPhone: job.client.phone || undefined,
    pickup: {
      location: job.pickup.location,
      date: job.pickup.date,
      time: job.pickup.time,
      postcode: job.pickup.postcode,
    },
    delivery: {
      location: job.delivery.location,
      date: job.delivery.date,
      time: job.delivery.time,
      postcode: job.delivery.postcode,
    },
    vehicleType: job.vehicleType,
    distanceMiles: job.distanceMiles,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    assignedDriverId: job.assignedDriverId,
    exchange_visibility: job.exchange_visibility,
    awarded_carrier_company_id: job.awarded_carrier_company_id,
    direct_invite_company_id: job.direct_invite_company_id,
    paymentTerms: job.paymentTerms,
    cargo: job.cargo,
    loadDetailSummary: job.loadDetailSummary,
  };
}

/* ─── Status transition contract ────────────────────────────────────────── */

/**
 * Admin-permitted status transitions for the operational Jobs surface.
 *
 * Only forward/terminal transitions that do not require driver or carrier
 * interaction are included.  Values use the canonical JOB_STATUS constants —
 * string literals are not duplicated here.
 *
 * Classification: XDRIVE_TARGET (business decision for admin surface scope)
 *
 * Write-permission scope: the admin jobs page operates on jobs owned by
 * `company_id`.  Jobs visible through `assigned_company_id` or
 * `awarded_carrier_company_id` are intentionally read-only on this surface;
 * mutations must be scoped to `company_id` before this map is applied.
 */
export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  [JOB_STATUS.RECEIVED]:   [JOB_STATUS.POSTED,     JOB_STATUS.CANCELLED],
  [JOB_STATUS.POSTED]:     [JOB_STATUS.CANCELLED],
  [JOB_STATUS.ALLOCATED]:  [JOB_STATUS.CANCELLED],
  // Terminal or driver-managed statuses — no admin transitions permitted
  [JOB_STATUS.QUOTED]:     [],
  [JOB_STATUS.AWARDED]:    [],
  [JOB_STATUS.COLLECTED]:  [],
  [JOB_STATUS.IN_TRANSIT]: [],
  [JOB_STATUS.DELIVERED]:  [],
  [JOB_STATUS.INVOICED]:   [],
  [JOB_STATUS.PAID]:       [],
  [JOB_STATUS.CANCELLED]:  [],
  [JOB_STATUS.DISPUTED]:   [],
} as const;

/**
 * Returns the set of status values this job's current status may transition to
 * within the admin operations surface.  Returns an empty array for unknown or
 * terminal statuses.
 */
export function allowedStatusTransitions(status: string): readonly string[] {
  return ALLOWED_STATUS_TRANSITIONS[status.toLowerCase() as JobStatus] ?? [];
}

/* ─── Runtime transition enforcement ───────────────────────────────────── */

/**
 * Slim job record required by validateJobTransition.  Using a narrow type keeps
 * the function independent of the full Job/JobRow shapes used by the UI.
 */
export interface JobTransitionRecord {
  id: string;
  status: string;
  /** company_id that owns this job (FK from the jobs table). */
  companyId: string;
}

/** Discriminated union returned by validateJobTransition. */
export type TransitionValidationResult =
  | { ok: true }
  | { ok: false; error: 'missing-job' | 'foreign-job' | 'invalid-transition'; message: string };

/**
 * Pure transition guard — validates that a status mutation is permitted
 * before any Supabase call is made.  Fails closed on every error category.
 *
 * Checks (in order):
 *  1. Job with `id` must exist in `jobs`.
 *  2. The job's `companyId` must equal `activeCompanyId`
 *     (foreign/assigned/awarded jobs are visible but not mutable here).
 *  3. `newStatus` must be in `allowedStatusTransitions(currentStatus)`.
 *
 * Classification: XDRIVE_TARGET — domain enforcement rule for the admin
 * operations surface.
 */
export function validateJobTransition(params: {
  jobs: ReadonlyArray<JobTransitionRecord>;
  id: string;
  newStatus: string;
  activeCompanyId: string;
}): TransitionValidationResult {
  const { jobs, id, newStatus, activeCompanyId } = params;

  const job = jobs.find((j) => j.id === id);
  if (!job) {
    return { ok: false, error: 'missing-job', message: `Job ${id.slice(0, 8)} not found.` };
  }

  if (job.companyId !== activeCompanyId) {
    return {
      ok: false,
      error: 'foreign-job',
      message: `Job ${id.slice(0, 8)} is not owned by the active company and cannot be updated here.`,
    };
  }

  const allowed = allowedStatusTransitions(job.status);
  if (!allowed.includes(newStatus)) {
    const current = job.status;
    const allAllowed = allowed.length > 0 ? allowed.join(', ') : 'none';
    return {
      ok: false,
      error: 'invalid-transition',
      message: `Cannot transition job ${id.slice(0, 8)} from '${current}' to '${newStatus}'. Allowed: ${allAllowed}.`,
    };
  }

  return { ok: true };
}

/* ─── Direct Invite eligibility ─────────────────────────────────────────── */

/**
 * Direct Invite is only available when the job has not yet been awarded to a
 * carrier AND the exchange visibility is absent (null/undefined) or 'private'.
 * Public/exchange records must not be offered for direct invitation unless the
 * business rule explicitly changes.
 *
 * Canonical eligibility rule — do not weaken without a documented business
 * decision.
 */
export function isDirectInviteEligible(
  job: Pick<JobRow, 'exchange_visibility' | 'awarded_carrier_company_id'>,
): boolean {
  return (
    !job.awarded_carrier_company_id &&
    (!job.exchange_visibility || job.exchange_visibility === 'private')
  );
}

/* ─── Driver filter helper ───────────────────────────────────────────────── */

/**
 * Pure driver filter helper.  Returns only jobs whose assignedDriverId matches
 * driverFilter, or all jobs when driverFilter is empty.
 *
 * Driver identity is resolved exclusively from `job.assignedDriverId`
 * (FK → `public.drivers(id)`, canonical source confirmed in migration 069).
 * Driver names are NOT inferred from cargo notes or any non-canonical field.
 */
export function filterJobsByDriver(jobs: JobRow[], driverFilter: string): JobRow[] {
  if (!driverFilter) return jobs;
  return jobs.filter((j) => j.assignedDriverId === driverFilter);
}

/* ─── Status deep-link resolver ─────────────────────────────────────────── */

/**
 * Canonical set of status filter values accepted by the Admin Jobs page/table.
 * Includes the special 'All' sentinel plus every DB status value exposed as a
 * filter tab.  Shared between the URL resolver and the visible tabs so the two
 * surfaces cannot drift apart.
 */
export const JOBS_STATUS_FILTER_VALUES = [
  'All',
  JOB_STATUS.RECEIVED,   // 'draft'
  JOB_STATUS.POSTED,     // 'posted'
  JOB_STATUS.ALLOCATED,  // 'allocated'
  JOB_STATUS.IN_TRANSIT, // 'in_transit'
  JOB_STATUS.DELIVERED,  // 'delivered'
  'completed',           // post-delivery operational state (migration 20260720234500_canonical_driver_job_lifecycle.sql)
  JOB_STATUS.CANCELLED,  // 'cancelled'
] as const;

/**
 * Shared label+value option definitions for status filter tabs and selects.
 * Consumed by JobsOperationalTable to keep visible tabs and URL resolver in sync.
 */
export const JOBS_STATUS_FILTER_OPTIONS: ReadonlyArray<{ label: string; value: JobStatusFilterValue }> = [
  { label: 'All',        value: 'All'        },
  { label: 'Received',   value: JOB_STATUS.RECEIVED   },
  { label: 'Posted',     value: JOB_STATUS.POSTED     },
  { label: 'Allocated',  value: JOB_STATUS.ALLOCATED  },
  { label: 'In Transit', value: JOB_STATUS.IN_TRANSIT },
  { label: 'Delivered',  value: JOB_STATUS.DELIVERED  },
  { label: 'Completed',  value: 'completed'           },
  { label: 'Cancelled',  value: JOB_STATUS.CANCELLED  },
] as const;

export type JobStatusFilterValue = (typeof JOBS_STATUS_FILTER_VALUES)[number];

/**
 * Pure status-filter resolver for URL `?status=` query parameters.
 *
 * Resolution rules (in priority order):
 *  1. null, empty string, 'All', or 'all' (case-insensitive) → 'All'
 *  2. 'received' alias (human-readable label) → canonical DB value 'draft'
 *  3. Trim whitespace and normalise to lower-case before matching
 *  4. Any value present in JOBS_STATUS_FILTER_VALUES → returned as-is
 *  5. Unknown values → 'All' (fail-safe)
 */
export function resolveJobStatusFilter(raw: string | null | undefined): JobStatusFilterValue {
  if (!raw) return 'All';

  const normalised = raw.trim().toLowerCase();

  if (!normalised || normalised === 'all') return 'All';

  // Human-readable alias used in URLs (label → DB value)
  if (normalised === 'received') return JOB_STATUS.RECEIVED;

  // Find the matching canonical filter value (case-insensitive compare)
  const match = JOBS_STATUS_FILTER_VALUES.find(
    (v) => v.toLowerCase() === normalised,
  );

  return match ?? 'All';
}
