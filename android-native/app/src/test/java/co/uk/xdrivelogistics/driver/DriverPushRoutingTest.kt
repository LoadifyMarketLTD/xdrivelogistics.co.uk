package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [35])
class DriverPushRoutingTest {
    @Test
    fun `job payload routes to exact job deep link`() {
        val link = resolvePushDeepLink(
            mapOf(
                "job_id" to "6e5e0122-7b3c-4ec8-9f41-5d8937e541f1",
                "route" to "messages",
            ),
        )
        assertEquals("xdrivedriver://job/6e5e0122-7b3c-4ec8-9f41-5d8937e541f1", link)
    }

    @Test
    fun `route payload falls back to known tab deep links`() {
        assertEquals("xdrivedriver://notification", resolvePushDeepLink(mapOf("route" to "messages")))
        assertEquals("xdrivedriver://documents", resolvePushDeepLink(mapOf("route" to "documents")))
        assertEquals("xdrivedriver://nearby", resolvePushDeepLink(mapOf("route" to "nearby")))
    }

    @Test
    fun `unknown payload defaults to notification inbox`() {
        assertEquals("xdrivedriver://notification", resolvePushDeepLink(emptyMap()))
        assertEquals("xdrivedriver://notification", resolvePushDeepLink(mapOf("route" to "unknown")))
    }

    // ── job_id validation ────────────────────────────────────────────────────

    @Test
    fun `invalid job_id containing path traversal is rejected to safe destination`() {
        assertEquals(
            "xdrivedriver://notification",
            resolvePushDeepLink(mapOf("job_id" to "../etc/passwd")),
        )
    }

    @Test
    fun `invalid job_id containing spaces is rejected`() {
        assertEquals(
            "xdrivedriver://notification",
            resolvePushDeepLink(mapOf("job_id" to "job id with spaces")),
        )
    }

    @Test
    fun `overlong job_id exceeding 128 chars is rejected`() {
        val longId = "a".repeat(129)
        assertEquals("xdrivedriver://notification", resolvePushDeepLink(mapOf("job_id" to longId)))
    }

    @Test
    fun `job_id exactly 128 chars is not UUID-v4 — build emits notification fallback`() {
        // A 128-char alphanumeric string passes the broad push payload validator (isValidJobId)
        // but is not UUID-v4, so build() fails closed to the notification URI. This prevents
        // emitting xdrivedriver://job/<opaque> which would parse back to Messages silently.
        val nonUuidId = "a".repeat(128)
        assertEquals("xdrivedriver://notification", resolvePushDeepLink(mapOf("job_id" to nonUuidId)))
    }

    @Test
    fun `job_id containing special characters is rejected`() {
        assertEquals(
            "xdrivedriver://notification",
            resolvePushDeepLink(mapOf("job_id" to "job@bad!chars")),
        )
        assertEquals(
            "xdrivedriver://notification",
            resolvePushDeepLink(mapOf("job_id" to "job/slash")),
        )
        assertEquals(
            "xdrivedriver://notification",
            resolvePushDeepLink(mapOf("job_id" to "job?query=x")),
        )
    }

    @Test
    fun `non-UUID alphanumeric job_ids fail closed — build emits notification fallback`() {
        // "JOB_123-abc" and "a1b2c3d4" pass the broad push payload validator but are not UUID-v4.
        // build() must not emit xdrivedriver://job/<opaque> because parse() would return Messages
        // for any non-UUID path, creating a silent broken round-trip.
        assertEquals(
            "xdrivedriver://notification",
            resolvePushDeepLink(mapOf("job_id" to "JOB_123-abc")),
        )
        assertEquals(
            "xdrivedriver://notification",
            resolvePushDeepLink(mapOf("job_id" to "a1b2c3d4")),
        )
    }

    @Test
    fun `blank job_id falls through to route resolution`() {
        assertEquals(
            "xdrivedriver://nearby",
            resolvePushDeepLink(mapOf("job_id" to "  ", "route" to "nearby")),
        )
    }

    @Test
    fun `job_id starting with hyphen is rejected`() {
        assertEquals(
            "xdrivedriver://notification",
            resolvePushDeepLink(mapOf("job_id" to "-invalid-start")),
        )
    }

    // ── Profile route ────────────────────────────────────────────────────────

    @Test
    fun `profile route emits canonical profile destination`() {
        assertEquals("xdrivedriver://profile", resolvePushDeepLink(mapOf("route" to "profile")))
    }
}

