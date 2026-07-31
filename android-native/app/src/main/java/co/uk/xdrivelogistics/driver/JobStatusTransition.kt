package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob

/**
 * Normalises a raw database status string to the canonical driver status key used
 * by [DriverJob.driverStatusKey] and [isValidTransition].
 *
 * **Blank / unknown input deliberately returns `"unknown"` and never maps to `"allocated"`.**
 * A job with a missing or unrecognised status is not treated as an assigned/accepted job,
 * so [isValidTransition] will correctly reject any workflow transition from it.
 */
internal fun normalizeDriverStatus(raw: String): String {
    if (raw.isBlank()) return "unknown"
    return when (raw.lowercase()) {
        "assigned", "accepted" -> "allocated"
        "arrived_pickup" -> "on_site_pickup"
        "collected" -> "loaded"
        "on_route_delivery", "on_my_way_to_delivery" -> "in_transit"
        "arrived_delivery" -> "on_site_delivery"
        else -> raw.lowercase()
    }
}

/**
 * Returns `true` only when the transition from [currentRaw] to [next] is a valid
 * single-step progression in the driver workflow.
 *
 * Blank or unrecognised [currentRaw] values normalise to `"unknown"`, which does not
 * match any transition, so the function returns `false` — preventing an
 * unrecognised-status job from being moved through the workflow.
 */
internal fun isValidTransition(currentRaw: String, next: String): Boolean {
    val current = normalizeDriverStatus(currentRaw)
    return when (next) {
        "on_my_way" -> current in listOf("allocated", "awarded")
        "on_site_pickup" -> current == "on_my_way"
        "loaded" -> current == "on_site_pickup"
        "in_transit" -> current == "loaded"
        "on_site_delivery" -> current == "in_transit"
        "delivered" -> current == "on_site_delivery"
        "completed" -> current == "delivered"
        else -> false
    }
}

/**
 * Resolves the job ID that should remain selected after a data refresh.
 *
 * - If [currentId] is non-null and still present in [jobs], it is preserved so
 *   the driver does not lose context mid-workflow.
 * - If the previously selected job has been removed from the response (cancelled,
 *   reassigned, or completed), the stale ID is dropped and the first job in the
 *   refreshed list is selected instead (`null` when the list is empty).
 *
 * This prevents stale details or actions from a no-longer-visible job being
 * displayed when a different job is later selected.
 */
internal fun resolveSelectedJobId(currentId: String?, jobs: List<DriverJob>): String? {
    return if (currentId != null && jobs.any { it.id == currentId }) {
        currentId
    } else {
        jobs.firstOrNull()?.id
    }
}
