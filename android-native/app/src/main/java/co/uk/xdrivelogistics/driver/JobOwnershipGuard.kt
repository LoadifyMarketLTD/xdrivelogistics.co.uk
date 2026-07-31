package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob

/**
 * Client-side pre-flight ownership and eligibility checks for driver job status
 * transitions.
 *
 * These guards run on the Android device before the API is called.  They surface
 * clear rejection messages and avoid unnecessary network round-trips.  They do
 * NOT replace server-side enforcement:
 *
 * - Supabase RLS policy `jobs_select_assigned_driver` (migration 044) ensures
 *   driver A cannot read a non-posted job assigned to driver B.
 * - `driver_update_job_status_atomic` (migration 20260723201400) is a
 *   `SECURITY DEFINER` RPC that independently validates `assigned_driver_id` and
 *   company membership before writing any status change.
 *
 * See [co.uk.xdrivelogistics.driver.JobsOwnershipPolicyAudit] (test sources)
 * for the full static policy audit.
 */

/**
 * Returns a human-readable rejection reason if the authenticated driver must
 * NOT attempt a status transition on [job] to [nextStatus], or `null` when
 * the pre-flight check passes and the API call may proceed.
 *
 * Callers must treat a non-null return as a hard stop — no API call should
 * be made.
 */
internal fun preflightStatusUpdateRejection(job: DriverJob, nextStatus: String): String? {
    if (job.isPosted()) {
        return "Submit a quote and wait for the customer to award the job before starting work."
    }
    val current = job.currentStatus.ifBlank { job.status }
    if (!isValidTransition(current, nextStatus)) {
        return "This job cannot move to $nextStatus from its current status."
    }
    val blockingRequirement = job.blockingRequirementFor(nextStatus)
    if (blockingRequirement != null) return blockingRequirement
    return null
}
