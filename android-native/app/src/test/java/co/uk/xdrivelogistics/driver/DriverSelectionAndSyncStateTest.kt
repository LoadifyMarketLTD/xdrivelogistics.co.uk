package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.offline.MobileLifecycleAction
import co.uk.xdrivelogistics.driver.offline.MobileLifecycleCommand
import co.uk.xdrivelogistics.driver.offline.MobileQueueItem
import co.uk.xdrivelogistics.driver.offline.MobileQueueState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
