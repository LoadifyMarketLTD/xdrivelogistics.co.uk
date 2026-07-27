package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.offline.MobileLifecycleAction
import co.uk.xdrivelogistics.driver.offline.MobileLifecycleCommand
import co.uk.xdrivelogistics.driver.offline.MobileQueueItem
import co.uk.xdrivelogistics.driver.offline.MobileQueueState
import org.junit.Assert.assertEquals
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

    private fun job(id: String): DriverJob = DriverJob(
        id = id,
        status = "allocated",
        currentStatus = "allocated",
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
