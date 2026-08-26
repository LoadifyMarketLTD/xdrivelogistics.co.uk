package co.uk.xdrivelogistics.driver

import java.net.URI

internal object JobDeepLinkParser {
    fun extractJobId(
        jobIdExtra: String?,
        dataUri: String?,
        deepLinkExtra: String?,
    ): String? {
        normalizeJobId(jobIdExtra)?.let { return it }
        parseUri(dataUri)?.let { return it }
        return parseUri(deepLinkExtra)
    }

    private fun parseUri(raw: String?): String? {
        if (raw.isNullOrBlank()) return null
        val uri = runCatching { URI(raw.trim()) }.getOrNull() ?: return null
        val scheme = uri.scheme?.lowercase()
        val host = uri.host?.lowercase()
        val segments = uri.path.orEmpty().split('/').filter { it.isNotBlank() }

        val candidate = when {
            scheme == "xdrive" && host == "job" -> segments.firstOrNull()
            scheme == "https" && host == "www.xdrivelogistics.co.uk" &&
                segments.size >= 3 && segments[0] == "driver" && segments[1] == "jobs" -> segments[2]
            else -> null
        }
        return normalizeJobId(candidate)
    }

    private fun normalizeJobId(raw: String?): String? {
        val value = raw?.trim().orEmpty()
        if (value.isEmpty() || value.length > 128) return null
        if (value.any { it.isWhitespace() || it == '/' || it == '?' || it == '#' }) return null
        return value
    }
}
