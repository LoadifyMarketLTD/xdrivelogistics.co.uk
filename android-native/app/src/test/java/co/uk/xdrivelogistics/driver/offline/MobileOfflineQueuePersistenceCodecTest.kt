package co.uk.xdrivelogistics.driver.offline

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class MobileOfflineQueuePersistenceCodecTest {
    private val codec = MobileOfflineQueuePersistenceCodec()

    @Test
    fun `parseItems returns null for malformed aggregate json`() {
        assertNull(codec.parseItems("{ malformed"))
    }

    @Test
    fun `parseItems restores persisted queued item snapshot`() {
        val json = codec.toJson(
            listOf(
                MobileQueueItem(
                    id = "u1-1",
                    ownerUserId = "u1",
                    jobId = "job-1",
                    endpoint = MobileMutationEndpoint.ACCEPT.path,
                    payloadJson = MobileLifecycleCommand.encode(MobileMutationEndpoint.ACCEPT.path, "accepted"),
                    dedupeKey = "k1",
                    sequence = 1L,
                    updatedAtEpochMs = 1_000L,
                )
            )
        )

        val restored = codec.parseItems(json)
        assertNotNull(restored)
        assertEquals(1, restored!!.size)
        assertEquals("job-1", restored.first().jobId)
    }
}
