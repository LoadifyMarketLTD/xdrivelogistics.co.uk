package co.uk.xdrivelogistics.driver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.DeviceInstallationIdentity
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.SecureDriverCommercialApi
import co.uk.xdrivelogistics.driver.data.SessionStore
import co.uk.xdrivelogistics.driver.data.isDeviceSessionRevoked
import java.io.IOException
import java.util.concurrent.TimeUnit

class QuoteSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    private val pendingStore = PendingQuoteStore(appContext)
    private val sessionStore = SessionStore(appContext)
    private val api = ApiClient(BuildConfig.XDRIVE_BASE_URL, BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY)
    private val commercialApi = SecureDriverCommercialApi(BuildConfig.XDRIVE_BASE_URL, DeviceInstallationIdentity(appContext).installationId)

    override suspend fun doWork(): Result {
        var session = sessionStore.readSession() ?: return Result.success()
        val actions = pendingStore.pendingForUser(session.userId)
        if (actions.isEmpty()) return Result.success()

        when (val validated = validateOrRefresh(session)) {
            is ValidationOutcome.Valid -> session = validated.session
            ValidationOutcome.Revoked, ValidationOutcome.AuthUnavailable -> return Result.success()
            ValidationOutcome.Retry -> return Result.retry()
        }

        var profileResult = api.resolveDriverProfile(session)
        if (profileResult.isFailure && profileResult.exceptionOrNull().isQuoteSessionFailure()) {
            val refreshed = api.refreshSession(session)
            if (refreshed.isSuccess) {
                session = refreshed.getOrThrow()
                val saved = runCatching { sessionStore.saveSession(session) }
                if (saved.isFailure) {
                    if (saved.exceptionOrNull().isDeviceSessionRevoked()) return Result.success()
                    return if (saved.exceptionOrNull().isRetryableQuoteFailure()) Result.retry() else Result.success()
                }
                profileResult = api.resolveDriverProfile(session)
            } else return if (refreshed.exceptionOrNull().isRetryableQuoteFailure()) Result.retry() else Result.success()
        }
        if (profileResult.isFailure) return if (profileResult.exceptionOrNull().isRetryableQuoteFailure()) Result.retry() else Result.success()
        val profile = profileResult.getOrThrow()

        for (action in actions) {
            if (action.driverId != profile.driverId) {
                val message = "Saved quote belongs to a different driver profile."
                pendingStore.fail(action, message); notifyFailure(action.jobId, message); continue
            }

            var result = commercialApi.submitJobQuote(
                session = session,
                jobId = action.jobId,
                amount = action.amount,
                message = action.note,
                collectWithinMinutes = action.collectWithinMinutes,
                additionalExtrasGbp = action.additionalExtrasGbp,
                vehicleId = action.vehicleId,
            )
            if (result.isFailure && result.exceptionOrNull().isDeviceSessionRevoked()) {
                sessionStore.clear(redirectToLogin = false); return Result.success()
            }
            if (result.isFailure && result.exceptionOrNull().isQuoteSessionFailure()) {
                val refreshed = api.refreshSession(session)
                if (refreshed.isSuccess) {
                    session = refreshed.getOrThrow()
                    val saved = runCatching { sessionStore.saveSession(session) }
                    if (saved.isFailure) {
                        if (saved.exceptionOrNull().isDeviceSessionRevoked()) return Result.success()
                        return if (saved.exceptionOrNull().isRetryableQuoteFailure()) Result.retry() else Result.success()
                    }
                    result = commercialApi.submitJobQuote(
                        session = session,
                        jobId = action.jobId,
                        amount = action.amount,
                        message = action.note,
                        collectWithinMinutes = action.collectWithinMinutes,
                        additionalExtrasGbp = action.additionalExtrasGbp,
                        vehicleId = action.vehicleId,
                    )
                    if (result.isFailure && result.exceptionOrNull().isDeviceSessionRevoked()) {
                        sessionStore.clear(redirectToLogin = false); return Result.success()
                    }
                } else return if (refreshed.exceptionOrNull().isRetryableQuoteFailure()) Result.retry() else Result.success()
            }

            if (result.isSuccess) { pendingStore.remove(action.id); continue }
            val error = result.exceptionOrNull()
            if (error.isRetryableQuoteFailure()) return Result.retry()
            if (error.isQuoteSessionFailure()) return Result.success()
            val message = error?.message ?: "Saved quote was rejected by the server."
            pendingStore.fail(action, message); notifyFailure(action.jobId, message)
        }
        return Result.success()
    }

    private suspend fun validateOrRefresh(initial: DriverSession): ValidationOutcome {
        val first = sessionStore.validateDeviceBinding(initial)
        if (first.isSuccess) return ValidationOutcome.Valid(initial)
        val error = first.exceptionOrNull()
        if (error.isDeviceSessionRevoked()) {
            sessionStore.clear(redirectToLogin = false); return ValidationOutcome.Revoked
        }
        if (!error.isQuoteSessionFailure()) return if (error.isRetryableQuoteFailure()) ValidationOutcome.Retry else ValidationOutcome.AuthUnavailable

        val refreshed = api.refreshSession(initial)
        if (refreshed.isFailure) return if (refreshed.exceptionOrNull().isRetryableQuoteFailure()) ValidationOutcome.Retry else ValidationOutcome.AuthUnavailable
        val session = refreshed.getOrThrow()
        val saved = runCatching { sessionStore.saveSession(session) }
        if (saved.isFailure) {
            if (saved.exceptionOrNull().isDeviceSessionRevoked()) return ValidationOutcome.Revoked
            return if (saved.exceptionOrNull().isRetryableQuoteFailure()) ValidationOutcome.Retry else ValidationOutcome.AuthUnavailable
        }
        return when {
            sessionStore.validateDeviceBinding(session).isSuccess -> ValidationOutcome.Valid(session)
            else -> ValidationOutcome.AuthUnavailable
        }
    }

    private fun notifyFailure(jobId: String, message: String) {
        runCatching {
            val manager = applicationContext.getSystemService(NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Quote sync", NotificationManager.IMPORTANCE_DEFAULT))
            val openApp = PendingIntent.getActivity(applicationContext, 0, Intent(applicationContext, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            manager.notify(NOTIFICATION_ID, NotificationCompat.Builder(applicationContext, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_error).setContentTitle("XDrive quote sync needs attention")
                .setContentText("Job ${jobId.take(8).uppercase()}: ${message.take(120)}")
                .setStyle(NotificationCompat.BigTextStyle().bigText(message.take(500))).setContentIntent(openApp).setAutoCancel(true).build())
        }
    }

    private sealed interface ValidationOutcome {
        data class Valid(val session: DriverSession) : ValidationOutcome
        data object Revoked : ValidationOutcome
        data object Retry : ValidationOutcome
        data object AuthUnavailable : ValidationOutcome
    }

    companion object { private const val CHANNEL_ID = "xdrive_driver_quote_sync"; private const val NOTIFICATION_ID = 4605 }
}

object QuoteSyncScheduler {
    private const val UNIQUE_WORK = "xdrive_quote_sync"
    fun schedule(context: Context) {
        val request = OneTimeWorkRequestBuilder<QuoteSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(UNIQUE_WORK, ExistingWorkPolicy.REPLACE, request)
    }
}

internal fun Throwable?.isRetryableQuoteFailure(): Boolean {
    if (this == null) return false
    if (this is IOException) return true
    val text = message.orEmpty().lowercase()
    if ("maximum number of bids" in text || "active quote already exists" in text || "already quoted for this job" in text) return false
    if ("no longer available" in text || "not visible" in text || "fully verified" in text || "selected vehicle is not assigned" in text) return false
    return "unable to resolve host" in text || "no address associated with hostname" in text || "timeout" in text || "timed out" in text ||
        "connection" in text || "network" in text || "temporarily unavailable" in text || "http 408" in text || "http 425" in text ||
        ("http 429" in text && "please wait" in text) || "http 500" in text || "http 502" in text || "http 503" in text || "http 504" in text
}

internal fun Throwable?.isQuoteSessionFailure(): Boolean {
    if (this.isDeviceSessionRevoked()) return false
    val text = this?.message.orEmpty().lowercase()
    return "jwt" in text || "token" in text || "http 401" in text || "unauthorized" in text || "authentication required" in text || "session" in text
}
