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
        val queue = MobileOfflineQueue { 1_000L }
        val first = queue.enqueue(
            ownerUserId = "u1",
            driverId = "d1",
            jobId = "job-1",
            command = MobileLifecycleCommand.fromEndpointAndStatus(MobileMutationEndpoint.ACCEPT.path, "accepted")
                ?: error("invalid test command"),
            mutationKey = "k1",
        )
        val json = codec.toJson(listOf(first))

        val restored = codec.parseItems(json)
        assertNotNull(restored)
        assertEquals(1, restored!!.size)
        assertEquals("job-1", restored.first().jobId)
    }

    @Test
    fun `parseItems retains queue snapshot across repeated restart serialization`() {
        val queue = MobileOfflineQueue { 1_000L }
        queue.enqueue(
            ownerUserId = "u1",
            driverId = "d1",
            jobId = "job-1",
            command = MobileLifecycleCommand.fromEndpointAndStatus(MobileMutationEndpoint.ACCEPT.path, "accepted")
                ?: error("invalid test command"),
            mutationKey = "k1",
        )
        val firstJson = codec.toJson(queue.snapshot())
        val firstParse = codec.parseItems(firstJson)
        val secondJson = codec.toJson(firstParse.orEmpty())
        val secondParse = codec.parseItems(secondJson)

        assertNotNull(firstParse)
        assertNotNull(secondParse)
        assertEquals(firstParse, secondParse)
    }

    @Test
    fun `restore quarantines malformed legacy record without crashing`() {
        val malformedLegacyJson = """
            [
              {
                "id":"u1-1",
                "ownerUserId":"u1",
                "driverId":"d1",
                "jobId":"job-1",
                "endpoint":"accept",
                "payloadJson":"accepted",
                "mutationKey":"k1",
                "payloadFingerprint":"bad",
                "sequence":1,
                "createdAtEpochMs":1000,
                "updatedAtEpochMs":1000
              }
            ]
        """.trimIndent()
        val parsed = codec.parseItems(malformedLegacyJson)
        assertNotNull(parsed)

        val queue = MobileOfflineQueue { 1_000L }
        queue.restore(parsed!!)

        assertEquals(0, queue.snapshot().size)
        assertEquals(1, queue.quarantinedSnapshot().size)
    }
}
