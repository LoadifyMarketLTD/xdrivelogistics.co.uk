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
 * - `/driver/jobs/{uuid}` — exact assigned operational job (UUID-v4 only)
 * - All other HTTPS paths produce [DeepLinkDestination.Messages] (fail closed)
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
     * Used for push-notification payload validation only — push payloads come from
     * a server-controlled field and may use opaque alphanumeric formats.
     */
    private val VALID_JOB_ID_PATTERN = Regex("^[A-Za-z0-9][A-Za-z0-9_\\-]*\$")

    /**
     * Strict UUID-v4 pattern for job IDs accepted from URI paths and query parameters.
     *
     * Inbound deep links may be crafted by an attacker, so only well-formed server-issued
     * UUID-v4 values are accepted from the URI. The push-notification `job_id` field
     * uses the broader [VALID_JOB_ID_PATTERN] because it comes from a server-controlled
     * payload rather than a raw URI.
     *
     * Format: 8-4-4-4-12 hex digits, version nibble = 4, variant nibble ∈ {8,9,a,b}.
     */
    private val UUID_V4_PATTERN: Regex = Regex(
        """^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"""
    )

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
     *
     * For [DeepLinkDestination.Job]: validates the job ID with [isValidUriJobId] (UUID-v4 only)
     * before inserting it into the URI path. An ID that fails UUID-v4 validation produces a
     * Messages URI (safe fallback) rather than emitting a path that would silently parse back
     * to Messages on inbound. This ensures every Job URI emitted by [build] round-trips through
     * [parse] with no path-traversal or injection risk.
     */
    fun build(destination: DeepLinkDestination): Uri = when (destination) {
        DeepLinkDestination.Messages -> Uri.parse("$CANONICAL_SCHEME://notification")
        is DeepLinkDestination.Job -> {
            if (isValidUriJobId(destination.jobId)) {
                Uri.parse("$CANONICAL_SCHEME://job/${destination.jobId}")
            } else {
                Uri.parse("$CANONICAL_SCHEME://notification")
            }
        }
        DeepLinkDestination.Nearby -> Uri.parse("$CANONICAL_SCHEME://nearby")
        DeepLinkDestination.Documents -> Uri.parse("$CANONICAL_SCHEME://documents")
        DeepLinkDestination.Profile -> Uri.parse("$CANONICAL_SCHEME://profile")
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private fun parseCustomScheme(uri: Uri): DeepLinkDestination {
        val host = uri.host ?: return DeepLinkDestination.Messages
        return when (host) {
            "job" -> {
                val segs = uri.pathSegments
                val queryNames = uri.queryParameterNames
                // Strict: permit exactly two representations, no others.
                // Form A — one path segment, NO query or fragment:
                //   xdrivedriver://job/{uuid}
                // Form B — no path segments, EXACTLY the ?id= query, no fragment:
                //   xdrivedriver://job?id={uuid}
                // Any other combination (extra path, extra query, fragment) is rejected.
                val jobId: String = when {
                    segs.size == 1 && queryNames.isEmpty() && uri.fragment == null -> segs[0]
                    segs.isEmpty() && queryNames == setOf("id") && uri.fragment == null ->
                        uri.getQueryParameter("id") ?: return DeepLinkDestination.Messages
                    else -> return DeepLinkDestination.Messages
                }
                if (isValidUriJobId(jobId)) DeepLinkDestination.Job(jobId) else DeepLinkDestination.Messages
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
        // Reject any query string, fragment, or trailing slash.
        // Trailing slash is rejected explicitly because Android's pathSegments strips trailing
        // empty segments (StringTokenizer skips empty tokens), so /driver/jobs/{uuid}/ would
        // otherwise produce the same 3-segment list as the canonical form.
        if (uri.query != null || uri.fragment != null) return DeepLinkDestination.Messages
        if (path.endsWith("/")) return DeepLinkDestination.Messages
        val segs = uri.pathSegments
        // Exactly three segments: driver / jobs / {uuid} — no trailing slash, no extras.
        // All other HTTPS paths produce Messages (fail closed).
        if (segs.size == 3 && segs[0] == "driver" && segs[1] == "jobs") {
            val jobId = segs[2]
            return if (isValidUriJobId(jobId)) DeepLinkDestination.Job(jobId)
            else DeepLinkDestination.Messages
        }
        return DeepLinkDestination.Messages
    }

    internal fun isValidJobId(id: String): Boolean =
        id.length <= 128 && VALID_JOB_ID_PATTERN.matches(id)

    /**
     * Strict UUID-v4 validator used for job IDs extracted from inbound URI paths and
     * query parameters. Only server-issued UUID-v4 values pass this check, preventing
     * arbitrary string injection from crafted deep links from reaching the routing layer.
     *
     * Push-notification payloads use the broader [isValidJobId] instead, since they come
     * from a server-controlled payload field rather than a raw URI.
     */
    internal fun isValidUriJobId(id: String): Boolean = UUID_V4_PATTERN.matches(id)
}
