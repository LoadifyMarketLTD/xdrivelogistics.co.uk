package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.MarketplaceJob
import co.uk.xdrivelogistics.driver.data.MarketplacePublicPrice
import co.uk.xdrivelogistics.driver.offline.MobileLifecycleAction
import co.uk.xdrivelogistics.driver.offline.MobileLifecycleCommand
import co.uk.xdrivelogistics.driver.offline.MobileQueueItem
import co.uk.xdrivelogistics.driver.offline.MobileQueueState
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
