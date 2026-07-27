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
    @Test
    fun `same job processes in fifo order`() {
        val queue = MobileOfflineQueue { 1_000L }
        queue.enqueue("u1", "job-1", MobileMutationEndpoint.ACCEPT.path, "{}", "k1")
        queue.enqueue("u1", "job-1", MobileMutationEndpoint.ON_MY_WAY_PICKUP.path, "{}", "k2")

        val first = queue.nextProcessable("u1", 5_000L)
        queue.markSynced(first!!.id)
        val second = queue.nextProcessable("u1", 5_000L)

        assertEquals(MobileMutationEndpoint.ACCEPT.path, first.endpoint)
        assertEquals(MobileMutationEndpoint.ON_MY_WAY_PICKUP.path, second?.endpoint)
    }

    @Test
    fun `permanent failure blocks later same-job actions while other job continues`() {
        val queue = MobileOfflineQueue { 1_000L }
        val first = queue.enqueue("u1", "job-1", MobileMutationEndpoint.ACCEPT.path, "{}", "k1")
        queue.enqueue("u1", "job-1", MobileMutationEndpoint.ON_MY_WAY_PICKUP.path, "{}", "k2")
        queue.enqueue("u1", "job-2", MobileMutationEndpoint.ACCEPT.path, "{}", "k3")

        queue.nextProcessable("u1", 5_000L)
        queue.markFailure(first.id, retryable = false, message = "409")
        val next = queue.nextProcessable("u1", 5_000L)

        assertEquals("job-2", next?.jobId)
        assertTrue(queue.snapshot().any { it.jobId == "job-1" && it.state == MobileQueueState.BLOCKED })
    }

    @Test
    fun `retryable failure keeps item pending`() {
        val queue = MobileOfflineQueue { 1_000L }
        val item = queue.enqueue("u1", "job-1", MobileMutationEndpoint.ACCEPT.path, "{}", "k1")
        queue.nextProcessable("u1", 5_000L)
        queue.markFailure(item.id, retryable = true, message = "timeout")

        assertEquals(MobileQueueState.PENDING, queue.snapshot().first().state)
    }

    @Test
    fun `lease recovery returns abandoned syncing item to pending`() {
        var now = 1_000L
        val queue = MobileOfflineQueue { now }
        queue.enqueue("u1", "job-1", MobileMutationEndpoint.ACCEPT.path, "{}", "k1")
        val syncing = queue.nextProcessable("u1", leaseDurationMs = 100L)
        assertEquals(MobileQueueState.SYNCING, syncing?.state)
        now = 1_500L
        queue.recoverAbandonedSyncLeases()

        assertEquals(MobileQueueState.PENDING, queue.snapshot().first().state)
    }

    @Test
    fun `account isolation prevents cross-account replay`() {
        val queue = MobileOfflineQueue { 1_000L }
        queue.enqueue("u1", "job-1", MobileMutationEndpoint.ACCEPT.path, "{}", "k1")
        queue.enqueue("u2", "job-2", MobileMutationEndpoint.ACCEPT.path, "{}", "k2")

        val firstForU2 = queue.nextProcessable("u2", 1_000L)
        assertEquals("u2", firstForU2?.ownerUserId)
        assertEquals("job-2", firstForU2?.jobId)
    }

    @Test
    fun `dedupe collapses repeated taps`() {
        val queue = MobileOfflineQueue { 1_000L }
        val first = queue.enqueue("u1", "job-1", MobileMutationEndpoint.ACCEPT.path, "{}", "same")
        val second = queue.enqueue("u1", "job-1", MobileMutationEndpoint.ACCEPT.path, "{}", "same")

        assertEquals(first.id, second.id)
        assertEquals(1, queue.snapshot().size)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `unknown endpoint is rejected`() {
        val queue = MobileOfflineQueue { 1_000L }
        queue.enqueue("u1", "job-1", "unknown-endpoint", "{}", "x")
    }

    @Test
    fun `restore drops corrupt unknown endpoint records`() {
        val queue = MobileOfflineQueue { 1_000L }
        queue.restore(
            listOf(
                MobileQueueItem(
                    id = "1",
                    ownerUserId = "u1",
                    jobId = "job-1",
                    endpoint = "unknown-endpoint",
                    payloadJson = "{}",
                    dedupeKey = "d1",
                    sequence = 1L,
                    updatedAtEpochMs = 1_000L,
                ),
                MobileQueueItem(
                    id = "2",
                    ownerUserId = "u1",
                    jobId = "job-2",
                    endpoint = MobileMutationEndpoint.ACCEPT.path,
                    payloadJson = "{}",
                    dedupeKey = "d2",
                    sequence = 2L,
                    updatedAtEpochMs = 1_000L,
                ),
            )
        )

        assertEquals(1, queue.snapshot().size)
        assertEquals("job-2", queue.snapshot().first().jobId)
        assertNull(queue.nextProcessable("u3", 1_000L))
    }
}
