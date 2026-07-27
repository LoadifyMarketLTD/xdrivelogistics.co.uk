package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.offline.MobileMutationEndpoint
import co.uk.xdrivelogistics.driver.offline.MobileOfflineQueue
import co.uk.xdrivelogistics.driver.offline.MobileQueueItem
import co.uk.xdrivelogistics.driver.offline.MobileQueueState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileOfflineQueueTest {
    private fun command(endpoint: MobileMutationEndpoint, targetStatus: String) =
        co.uk.xdrivelogistics.driver.offline.MobileLifecycleCommand.fromEndpointAndStatus(endpoint.path, targetStatus)
            ?: error("invalid test command")

    private fun enqueue(
        queue: MobileOfflineQueue,
        ownerUserId: String,
        driverId: String,
        jobId: String,
        endpoint: MobileMutationEndpoint,
        targetStatus: String,
        mutationKey: String,
    ) = queue.enqueue(
        ownerUserId = ownerUserId,
        driverId = driverId,
        jobId = jobId,
        command = command(endpoint, targetStatus),
        mutationKey = mutationKey,
    )

    @Test
    fun `same job processes in fifo order`() {
        val queue = MobileOfflineQueue { 1_000L }
        enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ACCEPT, "accepted", "k1")
        enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ON_MY_WAY_PICKUP, "on_my_way_to_pickup", "k2")

        val first = queue.nextProcessable("u1", 5_000L)
        queue.markSynced(first!!.id)
        val second = queue.nextProcessable("u1", 5_000L)

        assertEquals(MobileMutationEndpoint.ACCEPT.path, first.endpoint)
        assertEquals(MobileMutationEndpoint.ON_MY_WAY_PICKUP.path, second?.endpoint)
    }

    @Test
    fun `permanent failure blocks later same-job actions while other job continues`() {
        val queue = MobileOfflineQueue { 1_000L }
        val first = enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ACCEPT, "accepted", "k1")
        enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ON_MY_WAY_PICKUP, "on_my_way_to_pickup", "k2")
        enqueue(queue, "u1", "d1", "job-2", MobileMutationEndpoint.ACCEPT, "accepted", "k3")

        queue.nextProcessable("u1", 5_000L)
        queue.markFailure(first.id, retryable = false, message = "409")
        val next = queue.nextProcessable("u1", 5_000L)

        assertEquals("job-2", next?.jobId)
        assertTrue(queue.snapshot().any { it.jobId == "job-1" && it.state == MobileQueueState.BLOCKED })
    }

    @Test
    fun `retryable failure keeps item pending`() {
        val queue = MobileOfflineQueue { 1_000L }
        val item = enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ACCEPT, "accepted", "k1")
        queue.nextProcessable("u1", 5_000L)
        queue.markFailure(item.id, retryable = true, message = "timeout")

        assertEquals(MobileQueueState.PENDING, queue.snapshot().first().state)
    }

    @Test
    fun `lease recovery returns abandoned syncing item to pending`() {
        var now = 1_000L
        val queue = MobileOfflineQueue { now }
        enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ACCEPT, "accepted", "k1")
        val syncing = queue.nextProcessable("u1", leaseDurationMs = 100L)
        assertEquals(MobileQueueState.SYNCING, syncing?.state)
        now = 1_500L
        queue.recoverAbandonedSyncLeases()

        assertEquals(MobileQueueState.PENDING, queue.snapshot().first().state)
    }

    @Test
    fun `account isolation prevents cross-account replay`() {
        val queue = MobileOfflineQueue { 1_000L }
        enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ACCEPT, "accepted", "k1")
        enqueue(queue, "u2", "d2", "job-2", MobileMutationEndpoint.ACCEPT, "accepted", "k2")

        val firstForU2 = queue.nextProcessable("u2", 1_000L)
        assertEquals("u2", firstForU2?.ownerUserId)
        assertEquals("job-2", firstForU2?.jobId)
    }

    @Test
    fun `dedupe collapses repeated taps`() {
        val queue = MobileOfflineQueue { 1_000L }
        val first = enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ACCEPT, "accepted", "same")
        val second = enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ACCEPT, "accepted", "same")

        assertEquals(first.id, second.id)
        assertEquals(1, queue.snapshot().size)
    }

    @Test
    fun `restore drops corrupt unknown endpoint records`() {
        val queue = MobileOfflineQueue { 1_000L }
        val valid = enqueue(queue, "u1", "d1", "job-2", MobileMutationEndpoint.ACCEPT, "accepted", "d2")
        queue.restore(
            listOf(
                MobileQueueItem(
                    id = "1",
                    ownerUserId = "u1",
                    driverId = "d1",
                    jobId = "job-1",
                    command = command(MobileMutationEndpoint.ACCEPT, "accepted"),
                    mutationKey = "",
                    payloadFingerprint = "invalid",
                    sequence = 1L,
                    createdAtEpochMs = 1_000L,
                    updatedAtEpochMs = 1_000L,
                ),
                valid,
            )
        )

        assertEquals(1, queue.snapshot().size)
        assertEquals("job-2", queue.snapshot().first().jobId)
        assertEquals(1, queue.quarantinedSnapshot().size)
        assertNull(queue.nextProcessable("u3", 1_000L))
    }

    @Test
    fun `invalid endpoint status pairing is rejected`() {
        assertNull(
            co.uk.xdrivelogistics.driver.offline.MobileLifecycleCommand.fromEndpointAndStatus(
                MobileMutationEndpoint.ACCEPT.path,
                "loaded",
            )
        )
    }

    @Test
    fun `restore quarantines endpoint payload mismatch`() {
        val queue = MobileOfflineQueue { 1_000L }
        val valid = enqueue(queue, "u1", "d1", "job-2", MobileMutationEndpoint.ACCEPT, "accepted", "d2")
        val tampered = enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ACCEPT, "accepted", "d1").copy(
            command = command(MobileMutationEndpoint.LOADED, "loaded"),
        )
        queue.restore(
            listOf(
                tampered,
                valid,
            )
        )

        assertEquals(1, queue.snapshot().size)
        assertEquals("job-2", queue.snapshot().first().jobId)
        assertEquals("job-1", queue.quarantinedSnapshot().first().jobId)
    }

    @Test
    fun `restore rejects unknown action command`() {
        val queue = MobileOfflineQueue { 1_000L }
        val valid = enqueue(queue, "u1", "d1", "job-2", MobileMutationEndpoint.ACCEPT, "accepted", "d2")
        val unknownAction = valid.copy(
            command = valid.command.copy(targetStatus = "unknown_status"),
            payloadFingerprint = valid.payloadFingerprint,
        )
        queue.restore(listOf(unknownAction, valid))
        assertEquals(1, queue.snapshot().size)
        assertEquals(1, queue.quarantinedSnapshot().size)
    }

    @Test
    fun `repeated restart keeps same pending commands stable`() {
        val queue = MobileOfflineQueue { 1_000L }
        enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ACCEPT, "accepted", "d1")
        enqueue(queue, "u1", "d1", "job-1", MobileMutationEndpoint.ON_MY_WAY_PICKUP, "on_my_way_to_pickup", "d2")
        val snapshot = queue.snapshot()

        queue.restore(snapshot)
        val firstRestart = queue.snapshot()
        queue.restore(firstRestart)
        val secondRestart = queue.snapshot()

        assertEquals(firstRestart, secondRestart)
        assertEquals(2, secondRestart.size)
        assertEquals(MobileMutationEndpoint.ACCEPT.path, secondRestart[0].endpoint)
        assertEquals(MobileMutationEndpoint.ON_MY_WAY_PICKUP.path, secondRestart[1].endpoint)
    }
}
