package co.uk.xdrivelogistics.driver

data class PendingLocation(
    val latitude: Double,
    val longitude: Double,
    val capturedAtEpochMs: Long,
) {
    fun isFresh(
        nowEpochMs: Long = System.currentTimeMillis(),
        maxAgeMs: Long = DEFAULT_MAX_AGE_MS,
    ): Boolean = capturedAtEpochMs > 0L && nowEpochMs - capturedAtEpochMs <= maxAgeMs

    companion object {
        const val DEFAULT_MAX_AGE_MS = 10 * 60 * 1000L
    }
}

internal enum class UploadOutcome {
    SUCCESS,
    RETRY,
    AUTH_REQUIRED,
}

internal fun Throwable.isAuthenticationFailure(): Boolean {
    val value = message.orEmpty().lowercase()
    return "401" in value ||
        "jwt" in value ||
        "token" in value ||
        "unauthorized" in value ||
        "session expired" in value
}
