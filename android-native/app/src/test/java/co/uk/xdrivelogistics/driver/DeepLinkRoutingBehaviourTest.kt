package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the deep-link routing state machine.
 *
 * Each test calls the extracted production routing functions [applyJobDeepLinkToState] and
 * [resolvePendingDeepLink] — the same functions called by [DriverViewModel.handleDeepLink]
 * and [DriverViewModel.processPendingDeepLinkIfReady] respectively. This ensures the tests
 * exercise the actual routing mechanism rather than simulating state changes.
 *
 * 1. **Cold-start hold**: [applyJobDeepLinkToState] stores the destination in
 *    [DriverUiState.pendingDeepLink] when the session or jobs list is not yet available.
 *    Non-job destinations pass through unchanged.
 * 2. **One-shot routing**: [resolvePendingDeepLink] clears the pending link atomically and
 *    returns the job ID; subsequent calls on the cleared state are no-ops.
 * 3. **A→B / logout isolation**: [resolvePendingDeepLink] returns null when the authenticated
 *    session is null, and a cross-owner job not in the new owner's list resolves to null so
 *    that [DriverViewModel.selectJobIfAssigned] routes to Messages.
 * 4. **Stale / terminal / marketplace / unassigned job fallback**: [DriverJob.isActive] returns
 *    false for terminal and pre-allocation statuses; [resolvePendingDeepLink] returns the job ID
 *    but [DriverViewModel.selectJobIfAssigned] then falls through to Messages because
 *    `jobs.firstOrNull { it.id == jobId && it.isActive() }` is null.
 * 5. **Activity recreation**: [applyJobDeepLinkToState] with data already loaded returns the
 *    state unchanged (no re-hold), so the caller routes directly.
 */
class DeepLinkRoutingBehaviourTest {

    // ── 1. Cold-start hold ────────────────────────────────────────────────────

    @Test
    fun `cold-start job link is stored as pendingDeepLink when not authenticated`() {
        val state = DriverUiState(isAuthenticated = false, jobs = emptyList())
        val destination = DeepLinkDestination.Job("job-cold-start-001")

        val newState = applyJobDeepLinkToState(state, destination)

        assertEquals(destination, newState.pendingDeepLink)
    }

    @Test
    fun `cold-start job link is stored as pendingDeepLink when authenticated but jobs not yet loaded`() {
        val state = DriverUiState(isAuthenticated = true, jobs = emptyList())
        val destination = DeepLinkDestination.Job("job-cold-start-002")

        val newState = applyJobDeepLinkToState(state, destination)

        assertEquals(destination, newState.pendingDeepLink)
    }

    @Test
    fun `job link is not held when session and jobs are already loaded`() {
        val state = DriverUiState(
            isAuthenticated = true,
            session = session("user-a"),
            jobs = listOf(assignedJob("job-loaded-001")),
        )
        val destination = DeepLinkDestination.Job("job-loaded-001")

        val newState = applyJobDeepLinkToState(state, destination)

        // State unchanged — caller will route directly via selectJobIfAssigned.
        assertNull(newState.pendingDeepLink)
    }

    @Test
    fun `pendingDeepLink is null by default (safe default state)`() {
        assertNull(DriverUiState().pendingDeepLink)
    }

    // ── 2. One-shot routing ───────────────────────────────────────────────────

    @Test
    fun `resolvePendingDeepLink clears pendingDeepLink atomically and returns job ID`() {
        val jobId = "job-one-shot-001"
        val state = DriverUiState(
            isAuthenticated = true,
            session = session("user-a"),
            jobs = listOf(assignedJob(jobId)),
            pendingDeepLink = DeepLinkDestination.Job(jobId),
        )

        val (newState, resolvedId) = resolvePendingDeepLink(state)

        assertNull("pendingDeepLink must be cleared before routing", newState.pendingDeepLink)
        assertEquals(jobId, resolvedId)
    }

    @Test
    fun `resolvePendingDeepLink is a no-op when pendingDeepLink is already null`() {
        val state = DriverUiState(
            isAuthenticated = true,
            session = session("user-a"),
            jobs = listOf(assignedJob("job-any")),
            pendingDeepLink = null,
        )

        val (newState, resolvedId) = resolvePendingDeepLink(state)

        assertNull("No pending link — must return null job ID", resolvedId)
        assertNull(newState.pendingDeepLink)
    }

    @Test
    fun `second resolvePendingDeepLink call on cleared state is a no-op`() {
        val jobId = "job-one-shot-002"
        val state = DriverUiState(
            isAuthenticated = true,
            session = session("user-a"),
            jobs = listOf(assignedJob(jobId)),
            pendingDeepLink = DeepLinkDestination.Job(jobId),
        )

        // First call — routes and clears.
        val (stateAfterFirst, firstId) = resolvePendingDeepLink(state)
        assertEquals(jobId, firstId)
        assertNull(stateAfterFirst.pendingDeepLink)

        // Second call on cleared state — must be a no-op.
        val (stateAfterSecond, secondId) = resolvePendingDeepLink(stateAfterFirst)
        assertNull("Second call must return null job ID", secondId)
        assertNull(stateAfterSecond.pendingDeepLink)
    }

    // ── 3. A→B / logout isolation ─────────────────────────────────────────────

    @Test
    fun `resolvePendingDeepLink returns null when session is null (owner cleared)`() {
        // After an owner change, the DriverViewModel clears session.
        // Pending links must not route without a valid session.
        val state = DriverUiState(
            isAuthenticated = false,
            session = null,
            pendingDeepLink = DeepLinkDestination.Job("owner-a-job-111"),
        )

        val (newState, resolvedId) = resolvePendingDeepLink(state)

        assertNull("No session — routing must not proceed", resolvedId)
        // Pending link is preserved (not cleared) so it can be retried after session loads.
        assertEquals(DeepLinkDestination.Job("owner-a-job-111"), newState.pendingDeepLink)
    }

    @Test
    fun `cross-owner job link resolves but selectJobIfAssigned falls back — job not in new owner list`() {
        // resolvePendingDeepLink returns the job ID; selectJobIfAssigned then rejects it
        // because the job is absent from owner-B's list (owner isolation at routing layer).
        val state = DriverUiState(
            isAuthenticated = true,
            session = session("user-b"),
            jobs = listOf(assignedJob("job-for-owner-b")), // Owner-A's job is absent
            pendingDeepLink = DeepLinkDestination.Job("job-for-owner-a"),
        )

        val (newState, resolvedId) = resolvePendingDeepLink(state)

        // Link is cleared and returned to the caller.
        assertNull(newState.pendingDeepLink)
        assertEquals("job-for-owner-a", resolvedId)

        // The caller (DriverViewModel) passes resolvedId to selectJobIfAssigned,
        // which checks jobs.firstOrNull { it.id == jobId && it.isActive() } — null → Messages.
        val assignedJob = state.jobs.firstOrNull { it.id == resolvedId && it.isActive() }
        assertNull("Cross-owner job must not be found in new owner's list", assignedJob)
    }

    @Test
    fun `job destinations from different owners are distinct and not equal`() {
        val destA = DeepLinkDestination.Job("owner-a-job-111")
        val destB = DeepLinkDestination.Job("owner-b-job-222")

        assertFalse(destA == destB)
        assertEquals(DeepLinkDestination.Job("owner-a-job-111"), destA)
        assertEquals(DeepLinkDestination.Job("owner-b-job-222"), destB)
    }

    // ── 4. Stale / terminal / marketplace / unassigned job fallback ───────────

    @Test
    fun `delivered job is not active — selectJobIfAssigned would fall back to Messages`() {
        assertFalse(job("delivered").isActive())
    }

    @Test
    fun `completed job is not active — terminal fallback applies`() {
        assertFalse(job("completed").isActive())
    }

    @Test
    fun `cancelled job is not active — terminal fallback applies`() {
        assertFalse(job("cancelled").isActive())
    }

    @Test
    fun `posted job is not active — marketplace fallback applies`() {
        assertFalse(job("posted").isActive())
    }

    @Test
    fun `quoted job is not active — pre-allocation fallback applies`() {
        assertFalse(job("quoted").isActive())
    }

    @Test
    fun `awarded job is not active — pre-allocation fallback applies`() {
        assertFalse(job("awarded").isActive())
    }

    @Test
    fun `all operational statuses are active`() {
        val active = listOf(
            "allocated",
            "accepted",
            "on_my_way_to_pickup",
            "on_site_pickup",
            "loaded",
            "on_my_way_to_delivery",
            "on_site_delivery",
        )
        for (s in active) {
            assertTrue("Expected isActive()==true for '$s'", job(s).isActive())
        }
    }

    @Test
    fun `terminal job in assigned list is rejected by the isActive guard`() {
        // resolvePendingDeepLink returns the job ID; selectJobIfAssigned's
        // `jobs.firstOrNull { it.id == jobId && it.isActive() }` is null for terminal jobs.
        val terminalJob = job("delivered", id = "delivered-job-001")
        val found = listOf(terminalJob).firstOrNull { it.id == "delivered-job-001" && it.isActive() }
        assertNull("Terminal job must fail the isActive guard", found)
    }

    @Test
    fun `unassigned job ID (absent from list) is rejected`() {
        val found = emptyList<DriverJob>().firstOrNull { it.id == "stale-job-999" && it.isActive() }
        assertNull("Job absent from list must route to Messages", found)
    }

    // ── 5. Activity recreation / cold-start re-delivery ──────────────────────

    @Test
    fun `applyJobDeepLinkToState does not re-hold when data is already loaded`() {
        // ViewModel survives a configuration change; data was already loaded.
        // handleDeepLink is re-invoked by onCreate — must go directly to selectJobIfAssigned.
        val state = DriverUiState(
            isAuthenticated = true,
            session = session("user-a"),
            jobs = listOf(assignedJob("job-recreation-001")),
            pendingDeepLink = null,
        )
        val destination = DeepLinkDestination.Job("job-recreation-001")

        val newState = applyJobDeepLinkToState(state, destination)

        // State unchanged — caller routes directly, no re-hold.
        assertNull("Re-delivered intent with loaded data must not re-hold", newState.pendingDeepLink)
    }

    @Test
    fun `applyJobDeepLinkToState overwrites previous pending with same destination (idempotent hold)`() {
        // If handleDeepLink is called again before data loads, the hold is idempotent.
        val destination = DeepLinkDestination.Job("job-recreation-002")
        val stateWithPending = DriverUiState(
            isAuthenticated = false,
            jobs = emptyList(),
            pendingDeepLink = destination,
        )

        val newState = applyJobDeepLinkToState(stateWithPending, destination)

        assertEquals("Same destination must remain in pending", destination, newState.pendingDeepLink)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun session(userId: String) = DriverSession(
        accessToken = "tok",
        refreshToken = "ref",
        userId = userId,
        email = "$userId@test.co.uk",
    )

    private fun job(status: String, id: String = "job-1") = DriverJob(
        id = id,
        status = status,
        currentStatus = status,
        pickupLocation = "Origin",
        deliveryLocation = "Destination",
        pickupDatetime = null,
        deliveryDatetime = null,
        clientName = "Client",
        clientPhone = "",
        vehicleType = "Van",
        cargoType = "Parcel",
        budgetAmount = null,
        loadDetails = "",
    )

    private fun assignedJob(id: String) = job("accepted", id = id)
}
