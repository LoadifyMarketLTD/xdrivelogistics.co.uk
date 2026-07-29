package co.uk.xdrivelogistics.driver

import android.net.Uri
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Unit tests for the [XDriveDeepLink] contract and [DeepLinkDestination] model.
 *
 * Uses Robolectric so that [android.net.Uri] parses correctly in unit tests, making it possible
 * to prove the web launcher (which emits `xdrivedriver://`) and the Android parser share one contract.
 *
 * Covers:
 * - Both schemes (canonical `xdrivedriver://` and compat alias `xdrive://`) are parsed correctly.
 * - All five route destinations round-trip through [XDriveDeepLink.build] and [XDriveDeepLink.parse].
 * - Bare, unknown, and malformed URIs produce [DeepLinkDestination.Messages] (the safe default).
 * - HTTPS exact-host allowlist rejects lookalike hosts; does not match on suffix alone.
 * - Job-ID validation is consistent between push-routing and URI parsing.
 * - Notification pending intents are built with the canonical `xdrivedriver://` scheme.
 */
@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [35])
class DeepLinkContractTest {

    // ── Scheme normalisation ──────────────────────────────────────────────────

    @Test
    fun `canonical xdrivedriver scheme is accepted`() {
        val dest = XDriveDeepLink.parse(Uri.parse("xdrivedriver://job/abc-123"))
        assertEquals(DeepLinkDestination.Job("abc-123"), dest)
    }

    @Test
    fun `compat xdrive scheme is accepted as inbound alias`() {
        val dest = XDriveDeepLink.parse(Uri.parse("xdrive://job/abc-123"))
        assertEquals(DeepLinkDestination.Job("abc-123"), dest)
    }

    @Test
    fun `build always emits the canonical xdrivedriver scheme`() {
        val uri = XDriveDeepLink.build(DeepLinkDestination.Job("test-id"))
        assertEquals(XDriveDeepLink.CANONICAL_SCHEME, uri.scheme)
        assertTrue(uri.toString().startsWith("xdrivedriver://"))
    }

    @Test
    fun `push destinations use canonical scheme for all five routes`() {
        listOf(
            DeepLinkDestination.Messages,
            DeepLinkDestination.Job("any-id"),
            DeepLinkDestination.Nearby,
            DeepLinkDestination.Documents,
            DeepLinkDestination.Profile,
        ).forEach { dest ->
            val uri = XDriveDeepLink.build(dest)
            assertEquals(
                "Expected canonical scheme for $dest",
                XDriveDeepLink.CANONICAL_SCHEME,
                uri.scheme,
            )
        }
    }

    // ── All five routes round-trip through build → parse ─────────────────────

    @Test
    fun `Messages round-trips`() {
        val uri = XDriveDeepLink.build(DeepLinkDestination.Messages)
        assertEquals(DeepLinkDestination.Messages, XDriveDeepLink.parse(uri))
    }

    @Test
    fun `Job round-trips with canonical scheme`() {
        val original = DeepLinkDestination.Job("6e5e0122-7b3c-4ec8-9f41-5d8937e541f1")
        val uri = XDriveDeepLink.build(original)
        assertEquals(original, XDriveDeepLink.parse(uri))
    }

    @Test
    fun `Nearby round-trips`() {
        val uri = XDriveDeepLink.build(DeepLinkDestination.Nearby)
        assertEquals(DeepLinkDestination.Nearby, XDriveDeepLink.parse(uri))
    }

    @Test
    fun `Documents round-trips`() {
        val uri = XDriveDeepLink.build(DeepLinkDestination.Documents)
        assertEquals(DeepLinkDestination.Documents, XDriveDeepLink.parse(uri))
    }

    @Test
    fun `Profile round-trips`() {
        val uri = XDriveDeepLink.build(DeepLinkDestination.Profile)
        assertEquals(DeepLinkDestination.Profile, XDriveDeepLink.parse(uri))
    }

    // ── Compat alias also round-trips correctly ───────────────────────────────

    @Test
    fun `xdrive job link parses to Job destination`() {
        assertEquals(
            DeepLinkDestination.Job("abc"),
            XDriveDeepLink.parse(Uri.parse("xdrive://job/abc")),
        )
    }

    @Test
    fun `xdrive notification parses to Messages`() {
        assertEquals(DeepLinkDestination.Messages, XDriveDeepLink.parse(Uri.parse("xdrive://notification")))
    }

    @Test
    fun `xdrive documents parses to Documents`() {
        assertEquals(DeepLinkDestination.Documents, XDriveDeepLink.parse(Uri.parse("xdrive://documents")))
    }

    @Test
    fun `xdrive nearby parses to Nearby`() {
        assertEquals(DeepLinkDestination.Nearby, XDriveDeepLink.parse(Uri.parse("xdrive://nearby")))
    }

    @Test
    fun `xdrive profile parses to Profile`() {
        assertEquals(DeepLinkDestination.Profile, XDriveDeepLink.parse(Uri.parse("xdrive://profile")))
    }

    // ── Route alias handling ──────────────────────────────────────────────────

    @Test
    fun `messages host is an alias for Messages`() {
        assertEquals(DeepLinkDestination.Messages, XDriveDeepLink.parse(Uri.parse("xdrivedriver://messages")))
    }

    @Test
    fun `loads host is an alias for Nearby`() {
        assertEquals(DeepLinkDestination.Nearby, XDriveDeepLink.parse(Uri.parse("xdrivedriver://loads")))
    }

    // ── Safe defaults for bare and unknown URIs ──────────────────────────────

    @Test
    fun `bare scheme with no host returns Messages`() {
        assertEquals(DeepLinkDestination.Messages, XDriveDeepLink.parse(Uri.parse("xdrivedriver://")))
    }

    @Test
    fun `unknown host returns Messages`() {
        assertEquals(DeepLinkDestination.Messages, XDriveDeepLink.parse(Uri.parse("xdrivedriver://unknown-route")))
    }

    @Test
    fun `null URI string returns Messages`() {
        assertEquals(DeepLinkDestination.Messages, XDriveDeepLink.parse(null as String?))
    }

    @Test
    fun `blank URI string returns Messages`() {
        assertEquals(DeepLinkDestination.Messages, XDriveDeepLink.parse(""))
    }

    @Test
    fun `unknown scheme returns Messages`() {
        assertEquals(DeepLinkDestination.Messages, XDriveDeepLink.parse(Uri.parse("otherscheme://job/abc")))
    }

    @Test
    fun `http (not https) returns Messages`() {
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("http://www.xdrivelogistics.co.uk/driver/jobs/abc")),
        )
    }

    // ── HTTPS exact-host allowlist ────────────────────────────────────────────

    @Test
    fun `https www subdomain routes job link correctly`() {
        assertEquals(
            DeepLinkDestination.Job("job-123"),
            XDriveDeepLink.parse(Uri.parse("https://www.xdrivelogistics.co.uk/driver/jobs/job-123")),
        )
    }

    @Test
    fun `https apex host routes job link correctly`() {
        assertEquals(
            DeepLinkDestination.Job("job-456"),
            XDriveDeepLink.parse(Uri.parse("https://xdrivelogistics.co.uk/driver/jobs/job-456")),
        )
    }

    @Test
    fun `https m prefix routes to Nearby`() {
        assertEquals(
            DeepLinkDestination.Nearby,
            XDriveDeepLink.parse(Uri.parse("https://www.xdrivelogistics.co.uk/m/get-app")),
        )
    }

    @Test
    fun `https driver prefix routes to Nearby`() {
        assertEquals(
            DeepLinkDestination.Nearby,
            XDriveDeepLink.parse(Uri.parse("https://www.xdrivelogistics.co.uk/driver/dashboard")),
        )
    }

    @Test
    fun `lookalike host with correct suffix is rejected`() {
        // Suffix-matching would accept this; exact-allowlist must not.
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("https://evil.xdrivelogistics.co.uk/driver/jobs/abc")),
        )
    }

    @Test
    fun `lookalike host prepending legitimate name is rejected`() {
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("https://xdrivelogistics.co.uk.attacker.com/driver/jobs/abc")),
        )
    }

    @Test
    fun `different legitimate host is rejected`() {
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("https://api.xdrivelogistics.co.uk/driver/jobs/abc")),
        )
    }

    @Test
    fun `unrelated https host is rejected`() {
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("https://example.com/driver/jobs/abc")),
        )
    }

    // ── Job-ID validation ─────────────────────────────────────────────────────

    @Test
    fun `UUID job ID is valid`() {
        assertEquals(
            DeepLinkDestination.Job("6e5e0122-7b3c-4ec8-9f41-5d8937e541f1"),
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://job/6e5e0122-7b3c-4ec8-9f41-5d8937e541f1")),
        )
    }

    @Test
    fun `job ID with path traversal is rejected to Messages`() {
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://job/%2F..%2Fetc%2Fpasswd")),
        )
    }

    @Test
    fun `overlong job ID (129 chars) is rejected`() {
        val longId = "a".repeat(129)
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://job/$longId")),
        )
    }

    @Test
    fun `job ID exactly 128 chars is accepted`() {
        val validId = "a".repeat(128)
        assertEquals(
            DeepLinkDestination.Job(validId),
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://job/$validId")),
        )
    }

    @Test
    fun `job ID starting with hyphen is rejected`() {
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://job/-bad-start")),
        )
    }

    @Test
    fun `job with no ID segment returns Messages`() {
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://job")),
        )
    }

    @Test
    fun `job query-param id is accepted`() {
        assertEquals(
            DeepLinkDestination.Job("abc-123"),
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://job?id=abc-123")),
        )
    }

    @Test
    fun `job link with one extra path segment is rejected`() {
        // xdrivedriver://job/abc/extra has two path segments — must fall back to Messages.
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://job/abc-123/extra")),
        )
    }

    @Test
    fun `job link with multiple extra path segments is rejected`() {
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://job/abc/x/y/z")),
        )
    }

    // ── Notification pending intents use canonical scheme ─────────────────────

    @Test
    fun `push notification job payload uses canonical xdrivedriver scheme`() {
        val link = resolvePushDeepLink(mapOf("job_id" to "6e5e0122-7b3c-4ec8-9f41-5d8937e541f1"))
        assertTrue("Expected xdrivedriver:// prefix, got: $link", link.startsWith("xdrivedriver://"))
    }

    @Test
    fun `push notification messages route uses canonical scheme`() {
        val link = resolvePushDeepLink(mapOf("route" to "messages"))
        assertTrue("Expected xdrivedriver:// prefix, got: $link", link.startsWith("xdrivedriver://"))
    }

    @Test
    fun `push notification documents route uses canonical scheme`() {
        val link = resolvePushDeepLink(mapOf("route" to "documents"))
        assertTrue("Expected xdrivedriver:// prefix, got: $link", link.startsWith("xdrivedriver://"))
    }

    @Test
    fun `push notification nearby route uses canonical scheme`() {
        val link = resolvePushDeepLink(mapOf("route" to "nearby"))
        assertTrue("Expected xdrivedriver:// prefix, got: $link", link.startsWith("xdrivedriver://"))
    }

    @Test
    fun `push notification unknown payload defaults to messages with canonical scheme`() {
        val link = resolvePushDeepLink(emptyMap())
        assertTrue("Expected xdrivedriver:// prefix, got: $link", link.startsWith("xdrivedriver://"))
    }

    // ── Web launcher and Android parser share one contract ───────────────────

    @Test
    fun `web-emitted xdrivedriver notification URI parses to Messages on Android`() {
        // The web launcher at app/m/page.tsx emits xdrivedriver:// — verify Android parser agrees.
        assertEquals(
            DeepLinkDestination.Messages,
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://notification")),
        )
    }

    @Test
    fun `web-emitted xdrivedriver job URI parses to correct Job on Android`() {
        val jobId = "6e5e0122-7b3c-4ec8-9f41-5d8937e541f1"
        assertEquals(
            DeepLinkDestination.Job(jobId),
            XDriveDeepLink.parse(Uri.parse("xdrivedriver://job/$jobId")),
        )
    }
}
