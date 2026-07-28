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

    // ── job_id validation ────────────────────────────────────────────────────

    @Test
    fun `invalid job_id containing path traversal is rejected to safe destination`() {
        assertEquals(
            "xdrive://notification",
            resolvePushDeepLink(mapOf("job_id" to "../etc/passwd")),
        )
    }

    @Test
    fun `invalid job_id containing spaces is rejected`() {
        assertEquals(
            "xdrive://notification",
            resolvePushDeepLink(mapOf("job_id" to "job id with spaces")),
        )
    }

    @Test
    fun `overlong job_id exceeding 128 chars is rejected`() {
        val longId = "a".repeat(129)
        assertEquals("xdrive://notification", resolvePushDeepLink(mapOf("job_id" to longId)))
    }

    @Test
    fun `job_id exactly 128 chars is accepted`() {
        val validId = "a".repeat(128)
        assertEquals("xdrive://job/$validId", resolvePushDeepLink(mapOf("job_id" to validId)))
    }

    @Test
    fun `job_id containing special characters is rejected`() {
        assertEquals(
            "xdrive://notification",
            resolvePushDeepLink(mapOf("job_id" to "job@bad!chars")),
        )
        assertEquals(
            "xdrive://notification",
            resolvePushDeepLink(mapOf("job_id" to "job/slash")),
        )
        assertEquals(
            "xdrive://notification",
            resolvePushDeepLink(mapOf("job_id" to "job?query=x")),
        )
    }

    @Test
    fun `alphanumeric underscore and hyphen job_ids are accepted`() {
        assertEquals(
            "xdrive://job/JOB_123-abc",
            resolvePushDeepLink(mapOf("job_id" to "JOB_123-abc")),
        )
        assertEquals(
            "xdrive://job/a1b2c3d4",
            resolvePushDeepLink(mapOf("job_id" to "a1b2c3d4")),
        )
    }

    @Test
    fun `blank job_id falls through to route resolution`() {
        assertEquals(
            "xdrive://nearby",
            resolvePushDeepLink(mapOf("job_id" to "  ", "route" to "nearby")),
        )
    }

    @Test
    fun `job_id starting with hyphen is rejected`() {
        assertEquals(
            "xdrive://notification",
            resolvePushDeepLink(mapOf("job_id" to "-invalid-start")),
        )
    }
}
