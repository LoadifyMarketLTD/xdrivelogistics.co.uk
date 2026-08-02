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
