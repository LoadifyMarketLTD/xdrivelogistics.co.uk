package co.uk.xdrivelogistics.driver

import android.net.Uri

/**
 * Typed deep-link destination for the XDrive Driver app.
 *
 * All inbound links — custom scheme or HTTPS — must resolve to one of these five destinations.
 * [Messages] is the safe default for bare, unknown, or malformed URIs.
 */
sealed class DeepLinkDestination {
    /** Messages / notification inbox — also the safe default for unrecognised links. */
    object Messages : DeepLinkDestination()

    /** Exact assigned operational job identified by its server-issued ID. */
    data class Job(val jobId: String) : DeepLinkDestination()

    /** Nearby / Live Loads marketplace. */
    object Nearby : DeepLinkDestination()

    /** Driver document wallet. */
    object Documents : DeepLinkDestination()

    /** Driver profile and settings. */
    object Profile : DeepLinkDestination()
}

/**
 * Single production deep-link parser/builder contract shared by [MainActivity] intent handling,
 * [DriverPushNotifications] pending intents, and all in-app routing decisions.
 *
 * **Canonical outbound scheme:** `xdrivedriver://`
 * **Inbound compatibility alias:** `xdrive://` — accepted for already-issued links only.
 * New links must never be emitted with the `xdrive://` scheme.
 *
 * Supported custom-scheme hosts (both schemes):
 * - `job/<id>` — exact assigned operational job
 * - `notification` / `messages` — messages inbox (safe default)
 * - `nearby` / `loads` — Live Loads marketplace
 * - `documents` — driver document wallet
 * - `profile` — driver profile
 *
 * Supported HTTPS paths (exact-allowlist hosts only):
 * - `/driver/jobs/{id}` — exact assigned operational job
 * - `/m/...` or `/driver/...` — Nearby tab
 */
object XDriveDeepLink {
    /** Canonical scheme used for all newly emitted links. */
    const val CANONICAL_SCHEME = "xdrivedriver"

    /**
     * Inbound compatibility alias for links that were already issued using the old scheme.
     * Never emit new links with this scheme.
     */
    const val COMPAT_SCHEME = "xdrive"

    /**
     * Exact allowlist of HTTPS hosts that may carry driver deep links.
     * Suffix-matching is intentionally not used to prevent lookalike-host attacks.
     */
    private val HTTPS_HOST_ALLOWLIST: Set<String> = setOf(
        "www.xdrivelogistics.co.uk",
        "xdrivelogistics.co.uk",
    )

    /**
     * Valid job-ID characters: letters, digits, hyphens, underscores.
     * Must start with a letter or digit; max length enforced separately (≤ 128 chars).
     * Covers UUID (8-4-4-4-12 hex) and common opaque alphanumeric job-ID formats.
     */
    private val VALID_JOB_ID_PATTERN = Regex("^[A-Za-z0-9][A-Za-z0-9_\\-]*\$")

    /**
     * Parse [uri] to a [DeepLinkDestination].
     *
     * Returns [DeepLinkDestination.Messages] (the safe default) for any unrecognised,
     * bare, or malformed URI, and for HTTPS URIs whose host is not in [HTTPS_HOST_ALLOWLIST].
     */
    fun parse(uri: Uri): DeepLinkDestination {
        val scheme = uri.scheme ?: return DeepLinkDestination.Messages
        return when {
            scheme == CANONICAL_SCHEME || scheme == COMPAT_SCHEME -> parseCustomScheme(uri)
            scheme == "https" -> parseHttps(uri)
            else -> DeepLinkDestination.Messages
        }
    }

    /**
     * Convenience overload that parses a URI string.
     * Returns [DeepLinkDestination.Messages] for null or unparseable strings.
     */
    fun parse(uriString: String?): DeepLinkDestination {
        if (uriString.isNullOrBlank()) return DeepLinkDestination.Messages
        return runCatching { parse(Uri.parse(uriString)) }.getOrDefault(DeepLinkDestination.Messages)
    }

    /**
     * Build a canonical [Uri] for [destination] using [CANONICAL_SCHEME] (`xdrivedriver://`).
     * Always returns a valid, non-null URI.
     */
    fun build(destination: DeepLinkDestination): Uri = when (destination) {
        DeepLinkDestination.Messages -> Uri.parse("$CANONICAL_SCHEME://notification")
        is DeepLinkDestination.Job -> Uri.parse("$CANONICAL_SCHEME://job/${destination.jobId}")
        DeepLinkDestination.Nearby -> Uri.parse("$CANONICAL_SCHEME://nearby")
        DeepLinkDestination.Documents -> Uri.parse("$CANONICAL_SCHEME://documents")
        DeepLinkDestination.Profile -> Uri.parse("$CANONICAL_SCHEME://profile")
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private fun parseCustomScheme(uri: Uri): DeepLinkDestination {
        val host = uri.host ?: return DeepLinkDestination.Messages
        return when (host) {
            "job" -> {
                val jobId = uri.pathSegments.firstOrNull()
                    ?: uri.getQueryParameter("id")
                    ?: return DeepLinkDestination.Messages
                if (isValidJobId(jobId)) DeepLinkDestination.Job(jobId) else DeepLinkDestination.Messages
            }
            "notification", "messages" -> DeepLinkDestination.Messages
            "nearby", "loads" -> DeepLinkDestination.Nearby
            "documents" -> DeepLinkDestination.Documents
            "profile" -> DeepLinkDestination.Profile
            else -> DeepLinkDestination.Messages
        }
    }

    private fun parseHttps(uri: Uri): DeepLinkDestination {
        val host = uri.host ?: return DeepLinkDestination.Messages
        // Exact allowlist — never match by suffix to prevent lookalike-host attacks.
        if (host !in HTTPS_HOST_ALLOWLIST) return DeepLinkDestination.Messages
        val path = uri.path ?: return DeepLinkDestination.Messages
        return when {
            path.startsWith("/driver/jobs/") -> {
                val jobId = path.removePrefix("/driver/jobs/").trimEnd('/')
                if (jobId.isNotBlank() && isValidJobId(jobId)) DeepLinkDestination.Job(jobId)
                else DeepLinkDestination.Messages
            }
            path.startsWith("/m/") || path.startsWith("/driver/") -> DeepLinkDestination.Nearby
            else -> DeepLinkDestination.Messages
        }
    }

    internal fun isValidJobId(id: String): Boolean =
        id.length <= 128 && VALID_JOB_ID_PATTERN.matches(id)
}
