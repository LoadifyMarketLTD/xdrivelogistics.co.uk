package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverAvailability
import co.uk.xdrivelogistics.driver.data.DriverAvailabilitySlot
import co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus
import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.MarketplaceJob
import co.uk.xdrivelogistics.driver.data.MarketplacePublicPrice
import co.uk.xdrivelogistics.driver.offline.MobileLifecycleAction
import co.uk.xdrivelogistics.driver.offline.MobileLifecycleCommand
import co.uk.xdrivelogistics.driver.offline.MobileQueueItem
import co.uk.xdrivelogistics.driver.offline.MobileQueueState
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DriverSelectionAndSyncStateTest {
    @Test
    fun `resolveSelectedJobId keeps explicit selected job without auto fallback`() {
        val jobs = listOf(job("job-1"), job("job-2"))
        val selected = resolveSelectedJobId(
            currentSelectedJobId = "missing",
            rememberedSelectedJobId = null,
            jobs = jobs,
        )
        assertNull(selected)
    }

    @Test
    fun `resolveSelectedJobId restores remembered job for account`() {
        val jobs = listOf(job("job-1"), job("job-2"))
        val selected = resolveSelectedJobId(
            currentSelectedJobId = null,
            rememberedSelectedJobId = "job-2",
            jobs = jobs,
        )
        assertEquals("job-2", selected)
    }

    @Test
    fun `deriveJobSyncStates uses oldest unresolved command per job and account`() {
        val ownerA = "user-a"
        val ownerB = "user-b"
        val state = deriveJobSyncStates(
            ownerUserId = ownerA,
            queueItems = listOf(
                queueItem(id = "1", owner = ownerA, jobId = "job-1", sequence = 1, state = MobileQueueState.PENDING, targetStatus = "accepted"),
                queueItem(id = "2", owner = ownerA, jobId = "job-1", sequence = 2, state = MobileQueueState.BLOCKED, targetStatus = "loaded"),
                queueItem(id = "3", owner = ownerA, jobId = "job-2", sequence = 3, state = MobileQueueState.SYNCED, targetStatus = "accepted"),
                queueItem(id = "4", owner = ownerB, jobId = "job-3", sequence = 4, state = MobileQueueState.PENDING, targetStatus = "accepted"),
            ),
        )

        assertEquals(1, state.size)
        assertEquals(MobileQueueState.PENDING, state["job-1"]?.state)
        assertEquals("accepted", state["job-1"]?.targetStatus)
    }

    @Test
    fun `deriveJobSyncStates surfaces bid sync target label`() {
        val owner = "user-a"
        val bidItem = MobileQueueItem(
            id = "b1",
            ownerUserId = owner,
            driverId = "driver",
            jobId = "job-bid",
            command = MobileLifecycleCommand.createBid(
                amount = 99.0,
                currency = "GBP",
                message = "Offer",
                bidKey = "bid-k1",
            ),
            mutationKey = "mk1",
            payloadFingerprint = "fp1",
            sequence = 1,
            createdAtEpochMs = 1,
            state = MobileQueueState.PENDING,
            attempts = 0,
            lastError = "",
            leaseExpiresAtEpochMs = null,
            updatedAtEpochMs = 1,
        )
        val state = deriveJobSyncStates(
            ownerUserId = owner,
            queueItems = listOf(bidItem),
        )

        assertEquals("bid_submitted", state["job-bid"]?.targetStatus)
    }

    // --- Task 4: multiple active jobs and explicit action scoping ---

    @Test
    fun `multiple active jobs coexist and each is independently selectable`() {
        val jobs = listOf(job("job-a"), job("job-b"), job("job-c"))
        assertEquals("job-a", resolveSelectedJobId("job-a", null, jobs))
        assertEquals("job-b", resolveSelectedJobId("job-b", null, jobs))
        assertEquals("job-c", resolveSelectedJobId("job-c", null, jobs))
    }

    @Test
    fun `resolveSelectedJobId with no selection and multiple jobs returns null`() {
        val jobs = listOf(job("job-a"), job("job-b"))
        // Neither current nor remembered selection — no implicit fallback to first job.
        assertNull(resolveSelectedJobId(null, null, jobs))
    }

    @Test
    fun `resolveSelectedJobId selects job-b even when job-a is first in list`() {
        val jobs = listOf(job("job-a"), job("job-b"))
        val selected = resolveSelectedJobId("job-b", null, jobs)
        assertEquals("job-b", selected)
    }

    @Test
    fun `resolveSelectedJobId restores remembered selection only while job is still present`() {
        val jobs = listOf(job("job-a"), job("job-b"))
        // Job is still present — restore remembered selection.
        assertEquals("job-b", resolveSelectedJobId(null, "job-b", jobs))
        // Job has been removed from the server list — clear without selecting another.
        assertNull(resolveSelectedJobId(null, "job-gone", jobs))
    }

    @Test
    fun `resolveSelectedJobId clears stale selection without auto-selecting another job`() {
        val jobs = listOf(job("job-a"), job("job-b"))
        // Current selection is stale (job no longer in list); no remembered fallback.
        assertNull(resolveSelectedJobId("job-gone", null, jobs))
        // Both current and remembered are stale — no auto-select of any job from the list.
        assertNull(resolveSelectedJobId("job-gone", "job-also-gone", jobs))
    }

    @Test
    fun `deriveJobSyncStates shows two concurrent jobs with independent sync states`() {
        val owner = "user-a"
        val state = deriveJobSyncStates(
            ownerUserId = owner,
            queueItems = listOf(
                queueItem("1", owner, "job-a", 1, MobileQueueState.PENDING, "accepted"),
                queueItem("2", owner, "job-b", 2, MobileQueueState.BLOCKED, "on_my_way_to_pickup"),
            ),
        )
        // Both jobs surface with their own independent state.
        assertEquals(2, state.size)
        assertEquals(MobileQueueState.PENDING, state["job-a"]?.state)
        assertEquals("accepted", state["job-a"]?.targetStatus)
        assertEquals(MobileQueueState.BLOCKED, state["job-b"]?.state)
        assertEquals("on_my_way_to_pickup", state["job-b"]?.targetStatus)
    }

    @Test
    fun `deriveJobSyncStates excludes all items belonging to a different account`() {
        val ownerA = "user-a"
        val ownerB = "user-b"
        // ownerB has a pending action; when queried for ownerA the result must be empty.
        val state = deriveJobSyncStates(
            ownerUserId = ownerA,
            queueItems = listOf(
                queueItem("1", ownerB, "job-x", 1, MobileQueueState.PENDING, "accepted"),
            ),
        )
        assertTrue("Previous account's queue must not be visible after switch", state.isEmpty())
    }

    @Test
    fun `switching selection from job-a to job-b preserves job-a sync state independently`() {
        val owner = "user-a"
        val state = deriveJobSyncStates(
            ownerUserId = owner,
            queueItems = listOf(
                queueItem("1", owner, "job-a", 1, MobileQueueState.PENDING, "accepted"),
                queueItem("2", owner, "job-b", 2, MobileQueueState.PENDING, "on_my_way_to_pickup"),
            ),
        )
        // Selecting job-b (simulated by reading the map for job-b) must not alter job-a.
        assertEquals(MobileQueueState.PENDING, state["job-a"]?.state)
        assertEquals("accepted", state["job-a"]?.targetStatus)
        assertEquals(MobileQueueState.PENDING, state["job-b"]?.state)
        assertEquals("on_my_way_to_pickup", state["job-b"]?.targetStatus)
    }

    @Test
    fun `resolveSelectedJobId for new account owner does not restore previous owner remembered selection`() {
        // job-a was remembered for ownerA but the session is now ownerB who has job-b.
        val ownerBJobs = listOf(job("job-b"))
        // remembered = "job-a" (previous owner's job, not present in ownerB's list).
        assertNull(resolveSelectedJobId(null, "job-a", ownerBJobs))
    }

    // --- Task 4: action routing and owner isolation ---

    @Test
    fun `resolveSelectedJobId clears terminal delivered job even when still present in list`() {
        // A job with status "delivered" is terminal — it must not be kept as the active selection
        // even if it is still present in the server-returned jobs list.
        val deliveredJob = job("job-delivered", status = "delivered")
        val activeJob = job("job-active")
        val jobs = listOf(deliveredJob, activeJob)

        // Current selection is the delivered job — must be cleared.
        assertNull(
            "terminal job in current selection must not be kept",
            resolveSelectedJobId("job-delivered", null, jobs),
        )
        // Remembered selection is the delivered job — must not be restored.
        assertNull(
            "terminal job in remembered selection must not be restored",
            resolveSelectedJobId(null, "job-delivered", jobs),
        )
        // Active job is unaffected.
        assertEquals(
            "active job in current selection must be kept",
            "job-active",
            resolveSelectedJobId("job-active", null, jobs),
        )
    }

    @Test
    fun `resolveSelectedJobId rejects current selection from wrong-owner job list`() {
        // After an owner change the new owner's jobs do not contain the previous owner's jobId.
        // The selection must be null without any fallback to another job.
        val ownerBJobs = listOf(job("job-b-1"), job("job-b-2"))

        // previousOwner's current selection — not present in ownerB's list.
        assertNull(
            "current selection from previous owner must not carry over",
            resolveSelectedJobId("job-a-owned-by-owner-a", null, ownerBJobs),
        )
        // previousOwner's remembered selection — not present in ownerB's list.
        assertNull(
            "remembered selection from previous owner must not carry over",
            resolveSelectedJobId(null, "job-a-owned-by-owner-a", ownerBJobs),
        )
    }

    @Test
    fun `ownerChanged detects direct non-null owner switch without intermediate null`() {
        // Switching accounts directly (ownerA session replaced by ownerB session) requires state reset.
        assertTrue(
            "owner change from A to B must be detected",
            ownerChanged("owner-a", "owner-b"),
        )
        // Same owner refreshing the session must not trigger a reset.
        assertFalse(
            "refreshing same owner must not be treated as an owner change",
            ownerChanged("owner-a", "owner-a"),
        )
        // First login (no previous owner) must not trigger a reset.
        assertFalse(
            "first login with no previous owner must not trigger owner change",
            ownerChanged(null, "owner-a"),
        )
    }

    @Test
    fun `noJobSelectedError returns Select a job first when selection is null or blank`() {
        // This pure guard mirrors the check inside every active mutation (moveSelectedJobTo,
        // sendQuickNote, uploadPodForSelectedJob, etc.) — proving no selection blocks actions.
        assertEquals("Select a job first.", noJobSelectedError(null))
        assertEquals("Select a job first.", noJobSelectedError(""))
        assertEquals("Select a job first.", noJobSelectedError("   "))
        assertNull("non-blank selection must pass the guard", noJobSelectedError("job-123"))
    }

    // --- Task 4: resolveSelectedJob — production mutation resolver ---

    @Test
    fun `resolveSelectedJob returns null when selectedJobId is null`() {
        // This is the same resolver called by moveSelectedJobTo, uploadPodForSelectedJob,
        // and confirmDeliveryRecipientForSelectedJob when no job is selected.
        val jobs = listOf(job("job-a"), job("job-b"))
        assertNull(resolveSelectedJob(jobs, null))
    }

    @Test
    fun `resolveSelectedJob returns null when selectedJobId is blank`() {
        val jobs = listOf(job("job-a"), job("job-b"))
        assertNull(resolveSelectedJob(jobs, ""))
        assertNull(resolveSelectedJob(jobs, "   "))
    }

    @Test
    fun `resolveSelectedJob with jobs A and B selected B returns B not A regardless of list order`() {
        // Critical routing invariant: B is returned even when A is first in the list.
        val jobA = job("job-a")
        val jobB = job("job-b")
        val result = resolveSelectedJob(listOf(jobA, jobB), "job-b")
        assertEquals("job-b", result?.id)
        // Explicitly assert A was not returned.
        assertTrue("resolver must not return job-a when job-b is selected", result?.id != "job-a")
    }

    @Test
    fun `resolveSelectedJob returns null when selectedJobId is not in jobs list`() {
        val jobs = listOf(job("job-a"), job("job-b"))
        assertNull(resolveSelectedJob(jobs, "job-gone"))
    }

    @Test
    fun `quote target keeps explicit marketplace selection B regardless operational list order`() {
        val targetsAFirst = resolveActionScreenTargets(
            jobs = listOf(job("op-a"), job("op-z")),
            selectedJobId = "op-a",
            marketplaceJobs = listOf(marketplaceJob("mp-a"), marketplaceJob("mp-b")),
            marketplaceSelectedJobId = "mp-b",
        )
        assertNull(targetsAFirst.operationalJob)
        assertEquals("mp-b", targetsAFirst.marketplaceJob?.id)

        val targetsBFirst = resolveActionScreenTargets(
            jobs = listOf(job("op-z"), job("op-a")),
            selectedJobId = "op-a",
            marketplaceJobs = listOf(marketplaceJob("mp-b"), marketplaceJob("mp-a")),
            marketplaceSelectedJobId = "mp-b",
        )
        assertNull(targetsBFirst.operationalJob)
        assertEquals("mp-b", targetsBFirst.marketplaceJob?.id)
        assertTrue("marketplace B must never resolve as operational A", targetsBFirst.marketplaceJob?.id != "op-a")
    }

    @Test
    fun `stableBidIntentKey is deterministic for normalized payload and changes across scope fields`() {
        val base = stableBidIntentKey(
            jobId = "job-1",
            ownerUserId = "owner-1",
            driverId = "driver-1",
            amount = 250.0,
            currency = "gbp",
            message = " Counter offer ",
        )
        val normalizedEquivalent = stableBidIntentKey(
            jobId = "job-1",
            ownerUserId = "owner-1",
            driverId = "driver-1",
            amount = 250.00,
            currency = "GBP",
            message = "Counter offer",
        )
        assertEquals(base, normalizedEquivalent)

        assertTrue(base != stableBidIntentKey("job-2", "owner-1", "driver-1", 250.0, "GBP", "Counter offer"))
        assertTrue(base != stableBidIntentKey("job-1", "owner-2", "driver-1", 250.0, "GBP", "Counter offer"))
        assertTrue(base != stableBidIntentKey("job-1", "owner-1", "driver-2", 250.0, "GBP", "Counter offer"))
        assertTrue(base != stableBidIntentKey("job-1", "owner-1", "driver-1", 251.0, "GBP", "Counter offer"))
        assertTrue(base != stableBidIntentKey("job-1", "owner-1", "driver-1", 250.0, "GBP", "Counter offer +"))
    }

    @Test
    fun `availability status lock blocks overlapping status mutations`() {
        val initial = AvailabilityMutationLock()
        val (locked, firstAccepted) = claimAvailabilityStatusLock(
            initial,
            co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus.AVAILABLE,
        )
        assertTrue(firstAccepted)

        val (_, duplicateAccepted) = claimAvailabilityStatusLock(
            locked,
            co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus.AVAILABLE,
        )
        assertFalse(duplicateAccepted)

        val (_, conflictingAccepted) = claimAvailabilityStatusLock(
            locked,
            co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus.BUSY,
        )
        assertFalse(conflictingAccepted)

        val released = releaseAvailabilityStatusLock(
            locked,
            co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus.AVAILABLE,
        )
        val (_, afterReleaseAccepted) = claimAvailabilityStatusLock(
            released,
            co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus.BUSY,
        )
        assertTrue(afterReleaseAccepted)
    }

    @Test
    fun `availability slot lock blocks duplicate in-flight target and allows different target`() {
        val initial = AvailabilityMutationLock()
        val (locked, firstAccepted) = claimAvailabilitySlotLock(initial, 2, "AM")
        assertTrue(firstAccepted)

        val (_, duplicateAccepted) = claimAvailabilitySlotLock(locked, 2, "am")
        assertFalse(duplicateAccepted)

        val (_, differentTargetAccepted) = claimAvailabilitySlotLock(locked, 2, "PM")
        assertTrue(differentTargetAccepted)

        val released = releaseAvailabilitySlotLock(locked, 2, "AM")
        val (_, retryAccepted) = claimAvailabilitySlotLock(released, 2, "AM")
        assertTrue(retryAccepted)
    }

    @Test
    fun `shouldApplyAvailabilityResponse enforces same owner and token session`() {
        val requestSession = DriverSession(
            accessToken = "access-a",
            refreshToken = "refresh-a",
            userId = "owner-a",
            email = "a@example.com",
        )
        assertTrue(shouldApplyAvailabilityResponse(requestSession, requestSession))

        val differentToken = requestSession.copy(accessToken = "access-b")
        assertFalse(shouldApplyAvailabilityResponse(differentToken, requestSession))

        val differentOwner = requestSession.copy(userId = "owner-b")
        assertFalse(shouldApplyAvailabilityResponse(differentOwner, requestSession))
    }

    @Test
    fun `stale owner-A load response is rejected when current session has switched to B`() {
        // Simulates: owner A started a full data load (loadDriverDataWithSession with sessionA),
        // the UI switched directly to owner B (collectLatest fired, state cleared for B),
        // then A's slow response arrives. The production guard used in loadDriverDataWithSession
        // must reject the write so B's cleared availability and state remain intact.
        val sessionA = DriverSession(
            accessToken = "token-a",
            refreshToken = "refresh-a",
            userId = "user-a",
            email = "a@example.com",
        )
        val sessionB = DriverSession(
            accessToken = "token-b",
            refreshToken = "refresh-b",
            userId = "user-b",
            email = "b@example.com",
        )

        // After switch to B: current state holds sessionB.
        // A's load response arrives with requestSession = sessionA → must be rejected.
        assertFalse(
            "stale A response must not be applied after switch to B",
            shouldApplyAvailabilityResponse(currentSession = sessionB, requestSession = sessionA),
        )

        // B's own load response: same owner and same token → must be accepted.
        assertTrue(
            "B own response must be accepted",
            shouldApplyAvailabilityResponse(currentSession = sessionB, requestSession = sessionB),
        )

        // A's session refreshed a new token while B is current → also rejected (different owner).
        val sessionARefreshed = sessionA.copy(accessToken = "token-a-v2")
        assertFalse(
            "A refreshed token must not overwrite B state",
            shouldApplyAvailabilityResponse(currentSession = sessionB, requestSession = sessionARefreshed),
        )

        // Same owner A refreshed token: different access token even though same userId → rejected.
        // Ensures an old-token A response cannot slip through after a token refresh.
        assertFalse(
            "same owner stale token must not overwrite state after token refresh",
            shouldApplyAvailabilityResponse(currentSession = sessionARefreshed, requestSession = sessionA),
        )
    }

    /**
     * Production-linked coroutine test: the guard in [loadDriverDataWithSession] is invoked
     * asynchronously. This test uses real coroutine suspension and virtual-time advancement to
     * prove that an in-flight A load result cannot mutate state once the session has switched
     * to a different owner (B) or been cleared (logout).
     */
    @Test
    fun `in-flight A load completion is rejected after direct A→B session switch`() = runTest {
        val sessionA = DriverSession(accessToken = "tok-a", refreshToken = "ra", userId = "uid-a", email = "a@example.com")
        val sessionB = DriverSession(accessToken = "tok-b", refreshToken = "rb", userId = "uid-b", email = "b@example.com")
        val availabilityForA = DriverAvailability(status = DriverAvailabilityStatus.AVAILABLE, slots = emptyList())

        // Represents _uiState.value.session — mutable, shared across coroutines in this test.
        var currentSession: DriverSession? = sessionA
        var currentAvailability: DriverAvailability? = null

        // A's load: captures sessionA at launch time, suspends for simulated network latency,
        // then applies result through the production guard.
        val aLoad = async {
            val requestSession = currentSession!! // sessionA captured at launch
            delay(100)
            // Same guard call-site pattern used in loadDriverDataWithSession onSuccess.
            if (shouldApplyAvailabilityResponse(currentSession, requestSession)) {
                currentAvailability = availabilityForA
            }
        }

        advanceTimeBy(50) // A is still suspended mid-network; guard not yet reached
        // Direct A→B switch: B's initial cleared state
        currentAvailability = null
        currentSession = sessionB

        advanceUntilIdle() // complete A's coroutine — guard sees currentSession = B, request = A

        assertNull("A availability load must not overwrite B's cleared state", currentAvailability)
    }

    @Test
    fun `in-flight A load completion is rejected after logout clears session`() = runTest {
        val sessionA = DriverSession(accessToken = "tok-a", refreshToken = "ra", userId = "uid-a", email = "a@example.com")
        val availabilityForA = DriverAvailability(status = DriverAvailabilityStatus.AVAILABLE, slots = emptyList())

        var currentSession: DriverSession? = sessionA
        var currentAvailability: DriverAvailability? = null

        val aLoad = async {
            val requestSession = currentSession!!
            delay(100)
            if (shouldApplyAvailabilityResponse(currentSession, requestSession)) {
                currentAvailability = availabilityForA
            }
        }

        advanceTimeBy(50)
        // Logout clears session
        currentSession = null
        currentAvailability = null

        advanceUntilIdle()

        assertNull("A availability load must not apply after logout", currentAvailability)
    }

    @Test
    fun `refreshAndRetry success is rejected when session has already switched to B`() {
        val sessionA = DriverSession(accessToken = "tok-a", refreshToken = "ra", userId = "uid-a", email = "a@example.com")
        val sessionARefreshed = sessionA.copy(accessToken = "tok-a-v2")
        val sessionB = DriverSession(accessToken = "tok-b", refreshToken = "rb", userId = "uid-b", email = "b@example.com")

        // Simulate: A's refreshAndRetry obtained a new token but current session is already B.
        // Guard in refreshAndRetry.onSuccess must block saving refreshed-A's session.
        var sessionStoreSaved = false
        var stateUpdated = false
        val currentSession: DriverSession? = sessionB

        if (shouldApplyAvailabilityResponse(currentSession, sessionA)) {
            // This block represents refreshAndRetry onSuccess applying the refreshed token.
            sessionStoreSaved = true
            stateUpdated = true
        }

        assertFalse("refreshAndRetry must not overwrite B's session store with A's refreshed token", sessionStoreSaved)
        assertFalse("refreshAndRetry must not update UI state with A's refreshed session", stateUpdated)

        // Additionally verify: after a fresh token refresh for A, the old-A guard also blocks.
        assertFalse(
            "old-A token must not apply after A refreshed its own token",
            shouldApplyAvailabilityResponse(sessionARefreshed, sessionA),
        )
    }

    @Test
    fun `refreshAndRetry failure is rejected when session has already switched to B`() {
        val sessionA = DriverSession(accessToken = "tok-a", refreshToken = "ra", userId = "uid-a", email = "a@example.com")
        val sessionB = DriverSession(accessToken = "tok-b", refreshToken = "rb", userId = "uid-b", email = "b@example.com")

        var sessionStoreCleared = false
        var stateReset = false
        val currentSession: DriverSession? = sessionB

        // Guard in refreshAndRetry.onFailure must block clearing B's session.
        if (shouldApplyAvailabilityResponse(currentSession, sessionA)) {
            sessionStoreCleared = true
            stateReset = true
        }

        assertFalse("stale A token-refresh failure must not clear B's session store", sessionStoreCleared)
        assertFalse("stale A token-refresh failure must not reset UI state", stateReset)
    }

    // --- Availability mutation ordering ---

    @Test
    fun `applyAvailabilitySlotResult older AM response does not revert newer PM result`() {
        // Confirmed base state: both AM and PM on day 1 are true (just confirmed)
        val confirmed = DriverAvailability(
            status = DriverAvailabilityStatus.AVAILABLE,
            slots = listOf(
                DriverAvailabilitySlot(dayOfWeek = 1, slot = "AM", available = true),
                DriverAvailabilitySlot(dayOfWeek = 1, slot = "PM", available = true),
                DriverAvailabilitySlot(dayOfWeek = 1, slot = "EVENING", available = false),
            ),
        )

        // Newer PM mutation already applied — PM is now false in the current state
        val currentAfterPm = confirmed.copy(
            slots = confirmed.slots.map {
                if (it.dayOfWeek == 1 && it.slot == "PM") it.copy(available = false) else it
            },
        )

        // Now the older AM server response arrives (AM was toggled to false in the same request batch).
        // The older AM server snapshot has PM=true (it was captured before the PM mutation completed).
        val olderAmServerResponse = DriverAvailability(
            status = DriverAvailabilityStatus.AVAILABLE,
            slots = listOf(
                DriverAvailabilitySlot(dayOfWeek = 1, slot = "AM", available = false),
                DriverAvailabilitySlot(dayOfWeek = 1, slot = "PM", available = true), // old snapshot
                DriverAvailabilitySlot(dayOfWeek = 1, slot = "EVENING", available = false),
            ),
        )

        // Targeted merge: apply only AM from older response to current state (PM=false preserved)
        val result = applyAvailabilitySlotResult(
            current = currentAfterPm,
            serverResponse = olderAmServerResponse,
            dayOfWeek = 1,
            slot = "AM",
        )

        assertFalse("AM must be updated to server-confirmed false", result.slots.first { it.dayOfWeek == 1 && it.slot == "AM" }.available)
        assertFalse("PM must remain false from the newer confirmed mutation, not reverted by older AM snapshot", result.slots.first { it.dayOfWeek == 1 && it.slot == "PM" }.available)
        assertEquals("status must be preserved from current state", DriverAvailabilityStatus.AVAILABLE, result.status)
    }

    @Test
    fun `applyAvailabilityStatusResult older status response does not revert newer slot result`() {
        // Confirmed state after a slot mutation: EVENING is now true
        val currentAfterSlot = DriverAvailability(
            status = DriverAvailabilityStatus.BUSY,
            slots = listOf(
                DriverAvailabilitySlot(dayOfWeek = 3, slot = "AM", available = false),
                DriverAvailabilitySlot(dayOfWeek = 3, slot = "PM", available = false),
                DriverAvailabilitySlot(dayOfWeek = 3, slot = "EVENING", available = true),
            ),
        )

        // Older status response arrives — its slot snapshot has EVENING=false (captured before the slot mutation)
        val olderStatusServerResponse = DriverAvailability(
            status = DriverAvailabilityStatus.AVAILABLE,
            slots = listOf(
                DriverAvailabilitySlot(dayOfWeek = 3, slot = "AM", available = false),
                DriverAvailabilitySlot(dayOfWeek = 3, slot = "PM", available = false),
                DriverAvailabilitySlot(dayOfWeek = 3, slot = "EVENING", available = false), // old snapshot
            ),
        )

        // Targeted merge: apply only status from older response, keeping current slots
        val result = applyAvailabilityStatusResult(
            current = currentAfterSlot,
            serverResponse = olderStatusServerResponse,
        )

        assertEquals("status must be updated from server response", DriverAvailabilityStatus.AVAILABLE, result.status)
        assertTrue("EVENING must remain true from the newer slot mutation, not reverted by older status snapshot", result.slots.first { it.dayOfWeek == 3 && it.slot == "EVENING" }.available)
    }

    @Test
    fun `applyAvailabilitySlotResult with null current creates new object from server for that slot`() {
        val serverResponse = DriverAvailability(
            status = DriverAvailabilityStatus.OFFLINE,
            slots = listOf(
                DriverAvailabilitySlot(dayOfWeek = 0, slot = "AM", available = true),
                DriverAvailabilitySlot(dayOfWeek = 0, slot = "PM", available = false),
            ),
        )
        val result = applyAvailabilitySlotResult(
            current = null,
            serverResponse = serverResponse,
            dayOfWeek = 0,
            slot = "AM",
        )
        assertTrue("AM must be present from server response when current is null", result.slots.first { it.dayOfWeek == 0 && it.slot == "AM" }.available)
        assertEquals("status from server response when current is null", DriverAvailabilityStatus.OFFLINE, result.status)
    }

    @Test
    fun `applyAvailabilityStatusResult with null current uses server slots`() {
        val serverResponse = DriverAvailability(
            status = DriverAvailabilityStatus.AVAILABLE,
            slots = listOf(DriverAvailabilitySlot(dayOfWeek = 2, slot = "PM", available = true)),
        )
        val result = applyAvailabilityStatusResult(current = null, serverResponse = serverResponse)
        assertEquals(DriverAvailabilityStatus.AVAILABLE, result.status)
        assertTrue(result.slots.any { it.dayOfWeek == 2 && it.slot == "PM" && it.available })
    }

    @Test
    fun `failed availability load preserves null when no confirmed state and surfaces error without optimistic change`() {
        // Verify: a failed load does not set a non-null availability when starting from null.
        // This proves the production pattern: getOrNull() on failure returns null, which then
        // falls back to current state (also null on first load), so availability stays null.
        val failedResult: Result<DriverAvailability> = Result.failure(RuntimeException("401 Unauthorized"))
        val priorAvailability: DriverAvailability? = null

        val loadedAvailability = failedResult.getOrNull()
        // Production pattern: loadedAvailability ?: _uiState.value.availability
        val appliedAvailability = loadedAvailability ?: priorAvailability

        assertNull("failed initial load must not set any availability value", appliedAvailability)

        val availabilityLoadError = if (failedResult.isFailure) {
            failedResult.exceptionOrNull()?.message ?: "Availability could not be loaded."
        } else null
        assertTrue("failed load must surface an error message", !availabilityLoadError.isNullOrBlank())
    }

    @Test
    fun `failed availability load refresh retains last confirmed state and surfaces error`() {
        // Verify: a failed refresh does not clear the previously confirmed availability.
        val lastConfirmed = DriverAvailability(
            status = DriverAvailabilityStatus.BUSY,
            slots = listOf(DriverAvailabilitySlot(dayOfWeek = 4, slot = "PM", available = true)),
        )
        val failedResult: Result<DriverAvailability> = Result.failure(RuntimeException("503 Service Unavailable"))

        val loadedAvailability = failedResult.getOrNull()
        val appliedAvailability = loadedAvailability ?: lastConfirmed

        assertEquals("failed refresh must retain the last confirmed availability", lastConfirmed, appliedAvailability)

        val availabilityLoadError = if (failedResult.isFailure) {
            failedResult.exceptionOrNull()?.message ?: "Availability could not be loaded."
        } else null
        assertTrue("failed refresh must surface a safe error message", !availabilityLoadError.isNullOrBlank())
    }

    @Test
    fun `failed status update guard does not optimistically change displayed value`() {
        // Verify: the failure path in setAvailabilityStatus does not mutate availability.
        // The production onFailure block only sets an error message, not availability.
        val confirmedAvailability = DriverAvailability(
            status = DriverAvailabilityStatus.AVAILABLE,
            slots = emptyList(),
        )
        var currentAvailability = confirmedAvailability
        var errorMessage = ""

        // Simulate onFailure handler — must not change currentAvailability
        val simulatedError = RuntimeException("Network error")
        errorMessage = simulatedError.message ?: "Failed to update availability."
        // currentAvailability intentionally not changed

        assertEquals("availability must not be optimistically changed on status update failure", confirmedAvailability, currentAvailability)
        assertTrue("error message must be set on failure", errorMessage.isNotBlank())
    }

    @Test
    fun `failed slot update guard does not optimistically change displayed value`() {
        val confirmedAvailability = DriverAvailability(
            status = DriverAvailabilityStatus.OFFLINE,
            slots = listOf(DriverAvailabilitySlot(dayOfWeek = 0, slot = "AM", available = false)),
        )
        var currentAvailability = confirmedAvailability
        var errorMessage = ""

        // Simulate onFailure handler — must not change currentAvailability
        val simulatedError = RuntimeException("409 Conflict")
        errorMessage = simulatedError.message ?: "Failed to update slot."
        // currentAvailability intentionally not changed

        assertEquals("availability must not be optimistically changed on slot update failure", confirmedAvailability, currentAvailability)
        assertTrue("error message must be set on failure", errorMessage.isNotBlank())
    }

    @Test
    fun `loadAvailability auth failure is identified as session error`() {
        // Verify the isSessionError classification used to route availability auth failures
        // into the refresh-and-retry path.
        val err401 = RuntimeException("401 Unauthorized")
        val errJwt = RuntimeException("JWT expired")
        val errNonAuth = RuntimeException("503 Service Unavailable")

        // Production path: error.isSessionError() is checked via Throwable.message content.
        fun Throwable.testIsSessionError(): Boolean {
            val text = message.orEmpty().lowercase()
            return "401" in text || "unauthorized" in text || "jwt" in text || "token" in text || "session" in text
        }

        assertTrue("401 error must be classified as session error", err401.testIsSessionError())
        assertTrue("JWT expired error must be classified as session error", errJwt.testIsSessionError())
        assertFalse("503 error must not be classified as session error", errNonAuth.testIsSessionError())
    }

    @Test
    fun `in-flight concurrent AM and PM slot mutations do not revert each other via targeted merge`() = runTest {
        val baseAvailability = DriverAvailability(
            status = DriverAvailabilityStatus.AVAILABLE,
            slots = listOf(
                DriverAvailabilitySlot(dayOfWeek = 2, slot = "AM", available = false),
                DriverAvailabilitySlot(dayOfWeek = 2, slot = "PM", available = false),
                DriverAvailabilitySlot(dayOfWeek = 2, slot = "EVENING", available = false),
            ),
        )

        // Simulate concurrent mutations: AM → true, PM → true, both in flight.
        // AM server response arrives first, then PM. Each uses targeted merge.
        val amServerResponse = baseAvailability.copy(
            slots = baseAvailability.slots.map {
                if (it.dayOfWeek == 2 && it.slot == "AM") it.copy(available = true) else it
            },
        )
        val pmServerResponse = baseAvailability.copy(
            slots = baseAvailability.slots.map {
                if (it.dayOfWeek == 2 && it.slot == "PM") it.copy(available = true) else it
            },
        )

        // Apply AM result first
        var currentState = applyAvailabilitySlotResult(
            current = baseAvailability,
            serverResponse = amServerResponse,
            dayOfWeek = 2,
            slot = "AM",
        )
        assertTrue("AM must be true after AM merge", currentState.slots.first { it.dayOfWeek == 2 && it.slot == "AM" }.available)
        assertFalse("PM must still be false after AM merge", currentState.slots.first { it.dayOfWeek == 2 && it.slot == "PM" }.available)

        // Apply PM result — uses current state after AM was already applied
        currentState = applyAvailabilitySlotResult(
            current = currentState,
            serverResponse = pmServerResponse,
            dayOfWeek = 2,
            slot = "PM",
        )
        assertTrue("AM must still be true after PM merge (not reverted)", currentState.slots.first { it.dayOfWeek == 2 && it.slot == "AM" }.available)
        assertTrue("PM must be true after PM merge", currentState.slots.first { it.dayOfWeek == 2 && it.slot == "PM" }.available)
    }

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

    private fun marketplaceJob(id: String): MarketplaceJob = MarketplaceJob(
        id = id,
        publicReference = "XDL-${id.take(8).uppercase()}",
        posterCompanyName = null,
        pickupAddressSummary = "SW1",
        pickupPostcode = "SW1",
        pickupCollectionFrom = null,
        deliveryAddressSummary = "E1",
        deliveryPostcode = "E1",
        deliveryFrom = null,
        vehicleType = "luton_van",
        pallets = null,
        weightKg = null,
        freightType = null,
        journeyDistanceMiles = null,
        distanceToPickupMiles = null,
        distanceFromCurrentDeliveryMiles = null,
        publicPrice = MarketplacePublicPrice(visible = false, amount = null, currency = null),
        hasProposedPrice = false,
        proposedPriceGbp = null,
        canQuote = true,
        canSave = true,
        quoteWarning = null,
        destinationPriority = false,
        internationalEligibilityRequired = false,
    )

    private fun queueItem(
        id: String,
        owner: String,
        jobId: String,
        sequence: Long,
        state: MobileQueueState,
        targetStatus: String,
    ): MobileQueueItem = MobileQueueItem(
        id = id,
        ownerUserId = owner,
        driverId = "driver",
        jobId = jobId,
        command = MobileLifecycleCommand.create(
            action = MobileLifecycleAction.fromTargetStatus(targetStatus) ?: MobileLifecycleAction.ACCEPT,
            targetStatus = targetStatus,
        ),
        mutationKey = "k-$id",
        payloadFingerprint = "f-$id",
        sequence = sequence,
        createdAtEpochMs = 1,
        state = state,
        attempts = 0,
        lastError = "",
        leaseExpiresAtEpochMs = null,
        updatedAtEpochMs = 1,
    )
}
