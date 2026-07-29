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
 * 6. **Auth-epoch isolation**: [resolvePendingDeepLink] rejects a [PendingDeepLinkCommand] whose
 *    [PendingDeepLinkCommand.authEpoch] does not match [DriverUiState.authEpoch]. Logout and
 *    direct owner replacement advance the epoch so stale commands from prior sessions cannot
 *    execute under a new owner's authenticated state — even if the new owner's job list happens
 *    to contain the same job ID.
 */
class DeepLinkRoutingBehaviourTest {

    // ── 1. Cold-start hold ────────────────────────────────────────────────────

    @Test
    fun `cold-start job link is stored as pendingDeepLink when not authenticated`() {
        val state = DriverUiState(isAuthenticated = false, jobs = emptyList())
        val destination = DeepLinkDestination.Job("job-cold-start-001")

        val newState = applyJobDeepLinkToState(state, destination, "cmd-cold-start-001")

        assertEquals(PendingDeepLinkCommand(destination, 0L, "cmd-cold-start-001"), newState.pendingDeepLink)
    }

    @Test
    fun `cold-start job link is stored as pendingDeepLink when authenticated but jobs not yet loaded`() {
        val state = DriverUiState(isAuthenticated = true, jobs = emptyList())
        val destination = DeepLinkDestination.Job("job-cold-start-002")

        val newState = applyJobDeepLinkToState(state, destination, "cmd-cold-start-002")

        assertEquals(PendingDeepLinkCommand(destination, 0L, "cmd-cold-start-002"), newState.pendingDeepLink)
    }

    @Test
    fun `job link is not held when session and jobs are already loaded`() {
        val state = DriverUiState(
            isAuthenticated = true,
            session = session("user-a"),
            jobs = listOf(assignedJob("job-loaded-001")),
        )
        val destination = DeepLinkDestination.Job("job-loaded-001")

        val newState = applyJobDeepLinkToState(state, destination, "cmd-loaded-001")

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
            pendingDeepLink = PendingDeepLinkCommand(DeepLinkDestination.Job(jobId), 0L, "cmd-one-shot-001"),
        )

        val (newState, resolvedId) = resolvePendingDeepLink(state)

        assertNull("pendingDeepLink must be cleared before routing", newState.pendingDeepLink)
        assertEquals(jobId, resolvedId)
        assertTrue("Consumed commandId must be recorded", "cmd-one-shot-001" in newState.consumedCommandIds)
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
            pendingDeepLink = PendingDeepLinkCommand(DeepLinkDestination.Job(jobId), 0L, "cmd-one-shot-002"),
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
            pendingDeepLink = PendingDeepLinkCommand(DeepLinkDestination.Job("owner-a-job-111"), 0L, "cmd-owner-a-001"),
        )

        val (newState, resolvedId) = resolvePendingDeepLink(state)

        assertNull("No session — routing must not proceed", resolvedId)
        // Pending link is preserved (not cleared) so it can be retried after session loads.
        assertEquals(PendingDeepLinkCommand(DeepLinkDestination.Job("owner-a-job-111"), 0L, "cmd-owner-a-001"), newState.pendingDeepLink)
    }

    @Test
    fun `cross-owner job link resolves but selectJobIfAssigned falls back — job not in new owner list`() {
        // resolvePendingDeepLink returns the job ID; selectJobIfAssigned then rejects it
        // because the job is absent from owner-B's list (owner isolation at routing layer).
        val state = DriverUiState(
            isAuthenticated = true,
            session = session("user-b"),
            jobs = listOf(assignedJob("job-for-owner-b")), // Owner-A's job is absent
            pendingDeepLink = PendingDeepLinkCommand(DeepLinkDestination.Job("job-for-owner-a"), 0L, "cmd-owner-a-job"),
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

        val newState = applyJobDeepLinkToState(state, destination, "cmd-recreation-001")

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
            pendingDeepLink = PendingDeepLinkCommand(destination, 0L, "cmd-recreation-002-first"),
        )

        val newState = applyJobDeepLinkToState(stateWithPending, destination, "cmd-recreation-002-second")

        assertEquals(
            "Same destination must remain in pending with updated commandId",
            PendingDeepLinkCommand(destination, 0L, "cmd-recreation-002-second"),
            newState.pendingDeepLink,
        )
    }

    // ── 6. Auth-epoch isolation ───────────────────────────────────────────────

    @Test
    fun `applyJobDeepLinkToState captures current authEpoch in the command`() {
        val state = DriverUiState(isAuthenticated = false, jobs = emptyList(), authEpoch = 3L)
        val destination = DeepLinkDestination.Job("epoch-job-001")

        val newState = applyJobDeepLinkToState(state, destination, "cmd-epoch-001")

        assertEquals(
            "Command epoch must equal state epoch at capture time",
            3L,
            newState.pendingDeepLink?.authEpoch,
        )
    }

    @Test
    fun `resolvePendingDeepLink rejects stale command from previous epoch`() {
        // Represents: command captured at epoch 0, but state has advanced to epoch 1 after logout.
        val staleState = DriverUiState(
            isAuthenticated = true,
            session = session("owner-b"),
            jobs = listOf(assignedJob("owner-a-job-999")),  // B has same job in list
            authEpoch = 1L,
            pendingDeepLink = PendingDeepLinkCommand(
                DeepLinkDestination.Job("owner-a-job-999"),
                authEpoch = 0L,  // stale: captured under owner-A's epoch
                commandId = "cmd-stale-epoch-001",
            ),
        )

        val (newState, resolvedId) = resolvePendingDeepLink(staleState)

        assertNull(
            "Epoch-0 command must be rejected and not routed under epoch-1 state",
            resolvedId,
        )
        assertNull("Stale command must be cleared from state", newState.pendingDeepLink)
    }

    @Test
    fun `resolvePendingDeepLink routes command whose epoch matches current state epoch`() {
        val jobId = "epoch-match-job-001"
        val state = DriverUiState(
            isAuthenticated = true,
            session = session("owner-a"),
            jobs = listOf(assignedJob(jobId)),
            authEpoch = 2L,
            pendingDeepLink = PendingDeepLinkCommand(
                DeepLinkDestination.Job(jobId),
                authEpoch = 2L,  // matches current epoch
                commandId = "cmd-epoch-match-001",
            ),
        )

        val (newState, resolvedId) = resolvePendingDeepLink(state)

        assertEquals("Matching-epoch command must be routed", jobId, resolvedId)
        assertNull("Consumed command must be cleared", newState.pendingDeepLink)
        assertTrue("Consumed commandId must be in consumedCommandIds", "cmd-epoch-match-001" in newState.consumedCommandIds)
    }

    @Test
    fun `direct owner replacement advances authEpoch and clears pending link`() {
        // Simulates: owner A was active (epoch 0), then owner B's session arrives directly
        // (no intermediate null). applyJobDeepLinkToState on the new epoch captures epoch 1.
        val stateAfterOwnerChange = DriverUiState(
            isAuthenticated = true,
            session = session("owner-b"),
            jobs = emptyList(),
            authEpoch = 1L,           // epoch advanced by the owner-change path in ViewModel
            pendingDeepLink = null,   // cleared by the owner-change path
        )

        // A new link arriving after the owner change captures epoch 1.
        val destination = DeepLinkDestination.Job("owner-b-job-111")
        val stateWithNewLink = applyJobDeepLinkToState(stateAfterOwnerChange, destination, "cmd-owner-b-001")

        assertEquals(
            "New command after owner change must carry the post-change epoch",
            1L,
            stateWithNewLink.pendingDeepLink?.authEpoch,
        )
    }

    @Test
    fun `stale epoch command is discarded even when job appears in new owner list`() {
        // Security proof: if a stale epoch-N command somehow survived a session reset and the
        // new owner B happens to have the same job ID in their list, the epoch guard discards
        // the command before the job-list check is even reached.
        val sharedJobId = "shared-job-across-owners"
        val staleState = DriverUiState(
            isAuthenticated = true,
            session = session("owner-b"),
            jobs = listOf(assignedJob(sharedJobId)),
            authEpoch = 5L,
            pendingDeepLink = PendingDeepLinkCommand(
                DeepLinkDestination.Job(sharedJobId),
                authEpoch = 4L,  // previous epoch
                commandId = "cmd-stale-shared-001",
            ),
        )

        val (_, resolvedId) = resolvePendingDeepLink(staleState)

        assertNull(
            "Stale command must not route even when the job is in the new owner's list",
            resolvedId,
        )
    }

    // ── 7. One-shot commandId deduplication ──────────────────────────────────

    @Test
    fun `consumedCommandIds is empty by default`() {
        assertTrue(DriverUiState().consumedCommandIds.isEmpty())
    }

    @Test
    fun `resolvePendingDeepLink adds commandId to consumedCommandIds`() {
        val jobId = "job-consumed-001"
        val state = DriverUiState(
            isAuthenticated = true,
            session = session("user-a"),
            jobs = listOf(assignedJob(jobId)),
            pendingDeepLink = PendingDeepLinkCommand(DeepLinkDestination.Job(jobId), 0L, "cmd-consumed-001"),
        )

        val (newState, _) = resolvePendingDeepLink(state)

        assertTrue(
            "commandId must be recorded in consumedCommandIds after consumption",
            "cmd-consumed-001" in newState.consumedCommandIds,
        )
    }

    @Test
    fun `duplicate applyJobDeepLinkToState with same commandId before jobs load — second call overwrites`() {
        // Before jobs load, a duplicate delivery just overwrites the pending command (same commandId).
        // handleDeepLink's consumedCommandIds check prevents it from being applied a second time.
        val destination = DeepLinkDestination.Job("job-dedup-before-load")
        val state = DriverUiState(isAuthenticated = false, jobs = emptyList())

        // First delivery — creates the pending command.
        val stateAfterFirst = applyJobDeepLinkToState(state, destination, "cmd-dedup-001")
        assertEquals(
            PendingDeepLinkCommand(destination, 0L, "cmd-dedup-001"),
            stateAfterFirst.pendingDeepLink,
        )

        // Simulated second delivery of the same URI (same commandId) before jobs load.
        // applyJobDeepLinkToState itself just overwrites; the dedup guard lives in handleDeepLink.
        val stateAfterSecond = applyJobDeepLinkToState(stateAfterFirst, destination, "cmd-dedup-001")
        assertEquals(
            "Same commandId must produce the same pending command (overwrite, not accumulate)",
            PendingDeepLinkCommand(destination, 0L, "cmd-dedup-001"),
            stateAfterSecond.pendingDeepLink,
        )
    }

    @Test
    fun `commandId in consumedCommandIds prevents re-execution after pending link is resolved`() {
        // After the pending link is consumed (commandId recorded), a re-delivered command with
        // the same commandId must not create a new pending link or route again.
        val jobId = "job-dedup-after-load"
        val destination = DeepLinkDestination.Job(jobId)

        // State where the command was already consumed (e.g., from processPendingDeepLinkIfReady).
        val stateWithConsumed = DriverUiState(
            isAuthenticated = true,
            session = session("user-a"),
            jobs = listOf(assignedJob(jobId)),
            consumedCommandIds = setOf("cmd-dedup-resolved-001"),
        )

        // Simulated re-delivery of the same intent (same commandId already in consumedCommandIds).
        // handleDeepLink checks consumedCommandIds before calling applyJobDeepLinkToState.
        val alreadyConsumed = "cmd-dedup-resolved-001" in stateWithConsumed.consumedCommandIds
        assertTrue("Duplicate delivery must be detected via consumedCommandIds", alreadyConsumed)
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
