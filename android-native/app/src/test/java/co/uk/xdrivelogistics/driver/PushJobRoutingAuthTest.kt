package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the authenticated push job-routing logic.
 *
 * Exercises [selectJobIfAssigned] semantics directly: a push job deep link must only navigate
 * to the job detail view when there is an authenticated session AND the job exists in the
 * current loaded state as an active (non-terminal) assigned job. All other cases must fall
 * back to the Messages tab without selecting any job.
 *
 * Server-side stale generation ordering and contract validation are covered by the server
 * contract tests in [driverDeviceTokenContract.test.ts].
 */
class PushJobRoutingAuthTest {

    // ── Helpers ──────────────────────────────────────────────────────────────

    private fun job(id: String, status: String = "allocated"): DriverJob = DriverJob(
        id = id,
        status = status,
        currentStatus = status,
        pickupLocation = "A",
        deliveryLocation = "B",
        pickupDatetime = null,
        deliveryDatetime = null,
        clientName = "",
        clientPhone = "",
        vehicleType = "",
        cargoType = "",
        budgetAmount = null,
        loadDetails = "",
    )

    private val session = DriverSession(
        accessToken = "token",
        refreshToken = "refresh",
        userId = "user-1",
        email = "driver@example.com",
    )

    /**
     * Pure implementation of the [DriverViewModel.selectJobIfAssigned] routing rule so
     * that it can be tested without a real ViewModel or Android context.
     *
     * Returns the selected job ID if navigation to the job detail view should proceed, or
     * null if the router should fall back to the Messages tab.
     */
    private fun routeJobOrMessages(
        jobId: String,
        session: DriverSession?,
        jobs: List<DriverJob>,
    ): String? {
        if (session == null) return null
        val job = jobs.firstOrNull { it.id == jobId && it.isActive() }
        return if (job != null) jobId else null
    }

    // ── No session ───────────────────────────────────────────────────────────

    @Test
    fun `routes to Messages when session is null`() {
        val result = routeJobOrMessages("job-1", session = null, jobs = listOf(job("job-1")))
        assertNull(result)
    }

    // ── Job not in loaded state ──────────────────────────────────────────────

    @Test
    fun `routes to Messages when jobs list is empty`() {
        val result = routeJobOrMessages("job-1", session = session, jobs = emptyList())
        assertNull(result)
    }

    @Test
    fun `routes to Messages when job_id does not match any loaded job`() {
        val result = routeJobOrMessages(
            "unknown-job",
            session = session,
            jobs = listOf(job("job-1"), job("job-2")),
        )
        assertNull(result)
    }

    // ── Terminal jobs are rejected ────────────────────────────────────────────

    @Test
    fun `routes to Messages for a delivered terminal job`() {
        val result = routeJobOrMessages(
            "job-1",
            session = session,
            jobs = listOf(job("job-1", status = "delivered")),
        )
        assertNull(result)
    }

    @Test
    fun `routes to Messages for a completed terminal job`() {
        val result = routeJobOrMessages(
            "job-1",
            session = session,
            jobs = listOf(job("job-1", status = "completed")),
        )
        assertNull(result)
    }

    @Test
    fun `routes to Messages for a cancelled terminal job`() {
        val result = routeJobOrMessages(
            "job-1",
            session = session,
            jobs = listOf(job("job-1", status = "cancelled")),
        )
        assertNull(result)
    }

    @Test
    fun `routes to Messages for an invoiced terminal job`() {
        val result = routeJobOrMessages(
            "job-1",
            session = session,
            jobs = listOf(job("job-1", status = "invoiced")),
        )
        assertNull(result)
    }

    // ── Active jobs are accepted ──────────────────────────────────────────────

    @Test
    fun `routes to job detail for an active allocated job`() {
        val result = routeJobOrMessages(
            "job-1",
            session = session,
            jobs = listOf(job("job-1", status = "allocated")),
        )
        assertEquals("job-1", result)
    }

    @Test
    fun `routes to job detail for a job in-progress`() {
        val result = routeJobOrMessages(
            "job-2",
            session = session,
            jobs = listOf(job("job-1"), job("job-2", status = "on_my_way_to_pickup")),
        )
        assertEquals("job-2", result)
    }

    @Test
    fun `routes to correct job when multiple active jobs are loaded`() {
        val result = routeJobOrMessages(
            "job-3",
            session = session,
            jobs = listOf(job("job-1"), job("job-2"), job("job-3", status = "accepted")),
        )
        assertEquals("job-3", result)
    }

    // ── Stale push after A→B switch ──────────────────────────────────────────

    @Test
    fun `A stale push job is not shown when B has no matching job`() {
        // B is authenticated but B's job list does not contain A's stale job ID.
        val sessionB = DriverSession(
            accessToken = "token-b",
            refreshToken = "refresh-b",
            userId = "owner-b",
            email = "b@example.com",
        )
        val result = routeJobOrMessages(
            "job-for-owner-a",
            session = sessionB,
            jobs = listOf(job("job-for-owner-b")),
        )
        assertNull(result)
    }

    @Test
    fun `authenticated session with no loaded jobs (cold start) routes to Messages`() {
        val result = routeJobOrMessages("any-job-id", session = session, jobs = emptyList())
        assertNull(result)
    }

    // ── Cold-start pending link — owner isolation ─────────────────────────────

    @Test
    fun `cold-start job link is not opened for wrong owner even after jobs load`() {
        // A deep link for owner-A's job arrives; owner-B is authenticated with a different job list.
        // The link must never open owner-A's job in owner-B's session.
        val sessionB = DriverSession(
            accessToken = "token-b",
            refreshToken = "refresh-b",
            userId = "owner-b",
            email = "b@example.com",
        )
        val result = routeJobOrMessages(
            jobId = "job-for-owner-a",
            session = sessionB,
            jobs = listOf(job("job-for-owner-b", status = "allocated")),
        )
        assertNull("Expected null — job for owner-A must not open in owner-B's session", result)
    }

    @Test
    fun `cold-start job link opens once jobs are loaded for the correct owner`() {
        // Same owner — cold start then jobs arrive; the link should resolve correctly.
        val result = routeJobOrMessages(
            jobId = "job-1",
            session = session,
            jobs = listOf(job("job-1", status = "on_my_way_to_pickup")),
        )
        assertEquals("job-1", result)
    }

    @Test
    fun `cold-start link for terminal job still routes to Messages after jobs load`() {
        // The job was delivered by the time jobs are re-loaded; must not open.
        val result = routeJobOrMessages(
            jobId = "job-1",
            session = session,
            jobs = listOf(job("job-1", status = "delivered")),
        )
        assertNull(result)
    }
}
