package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertEquals
import org.junit.Test

class DriverPushRoutingTest {
    @Test
    fun `job payload routes to exact job deep link`() {
        val link = resolvePushDeepLink(
            mapOf(
                "job_id" to "6e5e0122-7b3c-4ec8-9f41-5d8937e541f1",
                "route" to "messages",
            ),
        )
        assertEquals("xdrive://job/6e5e0122-7b3c-4ec8-9f41-5d8937e541f1", link)
    }

    @Test
    fun `route payload falls back to known tab deep links`() {
        assertEquals("xdrive://notification", resolvePushDeepLink(mapOf("route" to "messages")))
        assertEquals("xdrive://documents", resolvePushDeepLink(mapOf("route" to "documents")))
        assertEquals("xdrive://nearby", resolvePushDeepLink(mapOf("route" to "nearby")))
    }

    @Test
    fun `unknown payload defaults to notification inbox`() {
        assertEquals("xdrive://notification", resolvePushDeepLink(emptyMap()))
        assertEquals("xdrive://notification", resolvePushDeepLink(mapOf("route" to "unknown")))
    }
}
