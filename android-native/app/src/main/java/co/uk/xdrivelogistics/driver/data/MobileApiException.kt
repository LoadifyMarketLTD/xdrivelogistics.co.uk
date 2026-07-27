package co.uk.xdrivelogistics.driver.data

import java.io.InterruptedIOException
import java.io.IOException
import java.net.UnknownHostException
import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.max

enum class MobileApiFailureCategory {
    TRANSPORT_DNS,
    TRANSPORT_TIMEOUT,
    TRANSPORT_IO,
    HTTP_UNAUTHORIZED,
    HTTP_FORBIDDEN,
    HTTP_CONFLICT,
    HTTP_TIMEOUT,
    HTTP_TOO_EARLY,
    HTTP_RATE_LIMITED,
    HTTP_SERVER_RETRYABLE,
    HTTP_SERVER_NON_RETRYABLE,
    HTTP_CLIENT,
}

sealed class MobileApiException(
    open val code: String,
    open val safeUserMessage: String,
    open val mutationId: String?,
    open val category: MobileApiFailureCategory,
    open val retryAfterSeconds: Long?,
    open val retryable: Boolean,
    cause: Throwable? = null,
) : IllegalStateException(safeUserMessage, cause)

class MobileApiTransportException(
    override val code: String,
    override val safeUserMessage: String,
    override val mutationId: String?,
    override val category: MobileApiFailureCategory,
    override val retryAfterSeconds: Long?,
    override val retryable: Boolean,
    cause: Throwable,
) : MobileApiException(
    code = code,
    safeUserMessage = safeUserMessage,
    mutationId = mutationId,
    category = category,
    retryAfterSeconds = retryAfterSeconds,
    retryable = retryable,
    cause = cause,
)

class MobileApiHttpException(
    val statusCode: Int,
    override val code: String,
    override val safeUserMessage: String,
    override val mutationId: String?,
    override val category: MobileApiFailureCategory,
    override val retryAfterSeconds: Long?,
    override val retryable: Boolean,
    val serverMessage: String,
) : MobileApiException(
    code = code,
    safeUserMessage = safeUserMessage,
    mutationId = mutationId,
    category = category,
    retryAfterSeconds = retryAfterSeconds,
    retryable = retryable,
)

internal object MobileApiErrorClassifier {
    private val retryableIdempotent5xx = setOf(502, 503, 504)

    fun transportFailure(throwable: Throwable): Throwable {
        if (throwable is MobileApiException) return throwable
        if (throwable !is IOException) return throwable
        val category = when (throwable) {
            is UnknownHostException -> MobileApiFailureCategory.TRANSPORT_DNS
            is InterruptedIOException -> MobileApiFailureCategory.TRANSPORT_TIMEOUT
            else -> MobileApiFailureCategory.TRANSPORT_IO
        }
        return MobileApiTransportException(
            code = when (category) {
                MobileApiFailureCategory.TRANSPORT_DNS -> "transport_dns"
                MobileApiFailureCategory.TRANSPORT_TIMEOUT -> "transport_timeout"
                else -> "transport_io"
            },
            safeUserMessage = "Connection problem. Check internet signal and retry.",
            mutationId = null,
            category = category,
            retryAfterSeconds = null,
            retryable = true,
            cause = throwable,
        )
    }

    fun httpFailure(
        statusCode: Int,
        fallbackMessage: String,
        serverMessage: String,
        errorCode: String?,
        mutationId: String?,
        retryAfterRaw: String?,
    ): MobileApiHttpException {
        val retryAfterSeconds = parseRetryAfterSeconds(retryAfterRaw)
        val retryable = statusCode in setOf(408, 425, 429) || statusCode in retryableIdempotent5xx
        val category = when (statusCode) {
            401 -> MobileApiFailureCategory.HTTP_UNAUTHORIZED
            403 -> MobileApiFailureCategory.HTTP_FORBIDDEN
            408 -> MobileApiFailureCategory.HTTP_TIMEOUT
            409 -> MobileApiFailureCategory.HTTP_CONFLICT
            425 -> MobileApiFailureCategory.HTTP_TOO_EARLY
            429 -> MobileApiFailureCategory.HTTP_RATE_LIMITED
            in retryableIdempotent5xx -> MobileApiFailureCategory.HTTP_SERVER_RETRYABLE
            in 500..599 -> MobileApiFailureCategory.HTTP_SERVER_NON_RETRYABLE
            else -> MobileApiFailureCategory.HTTP_CLIENT
        }
        val safeMessage = when (statusCode) {
            401 -> "Your session expired. Please sign in again."
            403 -> "You do not have permission for this action."
            408 -> "Request timed out. Please retry."
            409 -> "This action conflicts with the latest job state. Refresh and try again."
            425 -> "Action queued safely. Retry will run when ready."
            429 -> {
                if (retryAfterSeconds != null) {
                    "Rate limited. Retry in ${retryAfterSeconds}s."
                } else {
                    "Rate limited. Please retry shortly."
                }
            }
            in retryableIdempotent5xx -> "Temporary server issue. Please retry."
            in 500..599 -> "Server could not process this action. Please contact dispatch if this continues."
            else -> serverMessage.ifBlank { fallbackMessage }
        }
        return MobileApiHttpException(
            statusCode = statusCode,
            code = errorCode?.trim()?.takeIf { it.isNotBlank() } ?: "http_$statusCode",
            safeUserMessage = safeMessage,
            mutationId = mutationId?.trim()?.takeIf { it.isNotBlank() },
            category = category,
            retryAfterSeconds = retryAfterSeconds,
            retryable = retryable,
            serverMessage = serverMessage.ifBlank { fallbackMessage },
        )
    }

    fun parseRetryAfterSeconds(raw: String?): Long? {
        val value = raw?.trim()?.takeIf { it.isNotBlank() } ?: return null
        value.toLongOrNull()?.let { return max(it, 0L) }
        return runCatching {
            val retryInstant = ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()
            max(Instant.now().until(retryInstant, java.time.temporal.ChronoUnit.SECONDS), 0L)
        }.getOrNull()
    }
}
