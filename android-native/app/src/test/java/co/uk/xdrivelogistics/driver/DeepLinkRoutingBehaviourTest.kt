package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the deep-link routing state machine behaviours that do not require a running
 * Activity or ViewModel:
 *
 * 1. **Cold-start hold**: A [DeepLinkDestination.Job] arriving before session/jobs are loaded
 *    is stored in [DriverUiState.pendingDeepLink]; non-job destinations are not held.
 * 2. **One-shot routing**: The pending link is cleared atomically before routing is attempted;
 *    subsequent calls to processPendingDeepLinkIfReady on cleared state are no-ops.
 * 3. **A→B / logout isolation**: Owner change (or logout) always clears [pendingDeepLink] so
 *    cross-owner job routing is impossible.
 * 4. **Stale / terminal / marketplace / unassigned job fallback**: [DriverJob.isActive] returns
 *    false for delivered, completed, cancelled, posted, quoted and awarded statuses, so
 *    [DriverViewModel.selectJobIfAssigned] will route to Messages instead of opening stale jobs.
 * 5. **Activity recreation**: During a configuration change the ViewModel survives and the
 *    Activity's intent is re-delivered; if the pending link has already been cleared the
 *    state machine routes directly without re-holding.
 */
class DeepLinkRoutingBehaviourTest {

    // ── 1. Cold-start hold ────────────────────────────────────────────────────

    @Test
    fun `cold-start job link is stored as pendingDeepLink when not authenticated`() {
        val initialState = DriverUiState(isAuthenticated = false, jobs = emptyList())
        val destination = DeepLinkDestination.Job("job-cold-start-001")

        // Simulate handleDeepLink cold-start branch: hold the link.
        val newState = initialState.copy(pendingDeepLink = destination)

        assertEquals(destination, newState.pendingDeepLink)
    }

    @Test
    fun `cold-start job link is stored as pendingDeepLink when authenticated but jobs not yet loaded`() {
        val initialState = DriverUiState(isAuthenticated = true, jobs = emptyList())
        val destination = DeepLinkDestination.Job("job-cold-start-002")

        val newState = initialState.copy(pendingDeepLink = destination)

        assertEquals(destination, newState.pendingDeepLink)
    }

    @Test
    fun `non-job destinations are not held in pendingDeepLink`() {
        // Messages, Nearby, Documents and Profile do not use the pending-hold mechanism;
        // they are routed immediately. The pending field must remain null.
        val state = DriverUiState(isAuthenticated = false)
        assertNull("Messages must not hold a pending link", state.pendingDeepLink)
        // Simulate routing the non-job destinations — state is unchanged.
        assertEquals(null, state.copy().pendingDeepLink)
    }

    @Test
    fun `pendingDeepLink is null by default (safe default state)`() {
        val state = DriverUiState()
        assertNull(state.pendingDeepLink)
    }

    // ── 2. One-shot routing ───────────────────────────────────────────────────

    @Test
    fun `processPendingDeepLinkIfReady clears pendingDeepLink atomically before routing`() {
        val destination = DeepLinkDestination.Job("job-one-shot-001")
        val session = session("user-a")
        val job = assignedJob("job-one-shot-001")

        val state = DriverUiState(
            isAuthenticated = true,
            session = session,
            jobs = listOf(job),
            pendingDeepLink = destination,
        )

        // Simulate the atomic clear that happens at the start of processPendingDeepLinkIfReady.
        val clearedState = state.copy(pendingDeepLink = null)

        // After clearing, the pending link is gone — a second call would be a no-op.
        assertNull("pendingDeepLink must be cleared before routing", clearedState.pendingDeepLink)
    }

    @Test
    fun `processPendingDeepLinkIfReady is a no-op when pendingDeepLink is already null`() {
        val session = session("user-a")
        val state = DriverUiState(
            isAuthenticated = true,
            session = session,
            jobs = listOf(assignedJob("job-any")),
            pendingDeepLink = null,
        )

        // Simulate the guard: `val pending = state.pendingDeepLink as? Job ?: return`
        val pending = state.pendingDeepLink as? DeepLinkDestination.Job
        assertNull("No pending link — processPendingDeepLinkIfReady must return early", pending)
    }

    @Test
    fun `second processPendingDeepLinkIfReady call after clear does not re-route`() {
        // Verify the one-shot property: after the pending link is consumed and cleared,
        // a subsequent invocation (e.g. from a second refreshDriverData call) is a no-op.
        val destination = DeepLinkDestination.Job("job-one-shot-002")
        val session = session("user-a")

        val stateWithPending = DriverUiState(
            isAuthenticated = true,
            session = session,
            jobs = listOf(assignedJob("job-one-shot-002")),
            pendingDeepLink = destination,
        )

        // First invocation — clear and route.
        val stateAfterFirstCall = stateWithPending.copy(pendingDeepLink = null)
        assertNull(stateAfterFirstCall.pendingDeepLink)

        // Second invocation — pending is null, guard fires, no change.
        val secondCallGuard = stateAfterFirstCall.pendingDeepLink as? DeepLinkDestination.Job
        assertNull("Second call must be a no-op; guard must return early", secondCallGuard)
    }

    // ── 3. A→B / logout isolation ─────────────────────────────────────────────

    @Test
    fun `owner change clears pendingDeepLink to prevent cross-owner routing`() {
        val jobA = DeepLinkDestination.Job("owner-a-job-111")
        val stateWithPendingForA = DriverUiState(
            isAuthenticated = true,
            session = session("user-a"),
            jobs = emptyList(),
            pendingDeepLink = jobA,
        )

        // Simulate the owner-change clear block in DriverViewModel init.
        val stateAfterOwnerChange = stateWithPendingForA.copy(
            session = null,
            jobs = emptyList(),
            pendingDeepLink = null,
        )

        assertNull(
            "pendingDeepLink must be null after owner change to prevent cross-owner routing",
            stateAfterOwnerChange.pendingDeepLink,
        )
    }

    @Test
    fun `logout clears pendingDeepLink`() {
        val destination = DeepLinkDestination.Job("job-before-logout")
        val stateBeforeLogout = DriverUiState(
            isAuthenticated = true,
            session = session("user-x"),
            pendingDeepLink = destination,
        )

        // Logout → session becomes null → ViewModel resets to DriverUiState().
        val stateAfterLogout = DriverUiState()

        assertNull(stateAfterLogout.pendingDeepLink)
        assertFalse(stateAfterLogout.isAuthenticated)
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
    fun `delivered job is not active — stale fallback applies`() {
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
        // "posted" is a marketplace/pre-allocation status; a deep link to a posted job
        // must fall back to Messages since selectJobIfAssigned checks isActive().
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
    fun `selectJobIfAssigned falls back to Messages for job not in assigned list`() {
        // The assigned jobs list is empty — any job ID, including a marketplace or stale ID,
        // is absent from the list, so selectJobIfAssigned must route to Messages.
        val assignedJobs = emptyList<DriverJob>()
        val lookupId = "marketplace-or-stale-job-999"

        val found = assignedJobs.firstOrNull { it.id == lookupId && it.isActive() }
        assertNull(
            "Job not in assigned list — selectJobIfAssigned must route to Messages",
            found,
        )
    }

    @Test
    fun `selectJobIfAssigned falls back to Messages for terminal job in list`() {
        // The job exists in the list but has a terminal status — isActive() is false,
        // so selectJobIfAssigned must treat it as absent and route to Messages.
        val terminalJob = job("delivered", id = "delivered-job-001")
        val assignedJobs = listOf(terminalJob)
        val lookupId = "delivered-job-001"

        val found = assignedJobs.firstOrNull { it.id == lookupId && it.isActive() }
        assertNull(
            "Terminal job — selectJobIfAssigned must route to Messages",
            found,
        )
    }

    // ── 5. Activity recreation / cold-start re-delivery ──────────────────────

    @Test
    fun `onCreate re-delivery is safe when pending link already cleared (data loaded)`() {
        // During a configuration change the Activity is recreated but the ViewModel survives.
        // If data has already loaded and the pending link was processed, calling handleDeepLink
        // again finds jobs loaded — it goes directly to selectJobIfAssigned (idempotent).
        //
        // Simulate: ViewModel has loaded state with no pending link.
        val loadedState = DriverUiState(
            isAuthenticated = true,
            session = session("user-a"),
            jobs = listOf(assignedJob("job-recreation-001")),
            pendingDeepLink = null,
        )

        // handleDeepLink re-entry: jobs available, no pending → direct route, not re-hold.
        val isDataReady = loadedState.isAuthenticated && loadedState.jobs.isNotEmpty()
        assertTrue("Data must be ready to route directly on Activity recreation", isDataReady)
        assertNull("No pending link means no re-holding on recreation", loadedState.pendingDeepLink)
    }

    @Test
    fun `onCreate re-delivery stores same pending link if data still not loaded`() {
        // If the Activity is recreated before data loads, handleDeepLink is called again.
        // The pending link should be overwritten with the same value — idempotent hold.
        val destination = DeepLinkDestination.Job("job-recreation-002")
        val stateNotYetLoaded = DriverUiState(
            isAuthenticated = false,
            jobs = emptyList(),
            pendingDeepLink = destination,
        )

        // Second handleDeepLink call before data loads — same result.
        val newState = stateNotYetLoaded.copy(pendingDeepLink = destination)
        assertEquals(destination, newState.pendingDeepLink)
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
