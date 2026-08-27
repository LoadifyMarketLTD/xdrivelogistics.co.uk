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
import co.uk.xdrivelogistics.driver.data.SecureDriverMutationApi
import co.uk.xdrivelogistics.driver.data.SessionStore
import co.uk.xdrivelogistics.driver.data.isDeviceSessionRevoked
import java.io.IOException
import java.util.concurrent.TimeUnit

class PodSyncWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    private val pendingStore = PendingPodStore(appContext)
    private val sessionStore = SessionStore(appContext)
    private val api = ApiClient(BuildConfig.XDRIVE_BASE_URL, BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY)
    private val mutationApi = SecureDriverMutationApi(BuildConfig.XDRIVE_BASE_URL, DeviceInstallationIdentity(appContext).installationId)

    override suspend fun doWork(): Result {
        var session = sessionStore.readSession() ?: return Result.success()
        val actions = pendingStore.pendingForUser(session.userId)
        if (actions.isEmpty()) return Result.success()

        when (val validated = validateOrRefresh(session)) {
            is ValidationOutcome.Revoked -> return Result.success()
            is ValidationOutcome.Retry -> return Result.retry()
            is ValidationOutcome.AuthUnavailable -> return Result.success()
            is ValidationOutcome.Valid -> session = validated.session
        }

        var profileResult = api.resolveDriverProfile(session)
        if (profileResult.isFailure && profileResult.exceptionOrNull().isPodSessionFailure()) {
            val refreshed = api.refreshSession(session)
            if (refreshed.isSuccess) {
                session = refreshed.getOrThrow()
                runCatching { sessionStore.saveSession(session) }.getOrElse { error ->
                    if (error.isDeviceSessionRevoked()) return Result.success()
                    return if (error.isRetryablePodSyncFailure()) Result.retry() else Result.success()
                }
                profileResult = api.resolveDriverProfile(session)
            } else {
                return if (refreshed.exceptionOrNull().isRetryablePodSyncFailure()) Result.retry() else Result.success()
            }
        }
        if (profileResult.isFailure) return if (profileResult.exceptionOrNull().isRetryablePodSyncFailure()) Result.retry() else Result.success()
        val profile = profileResult.getOrThrow()

        for (action in actions) {
            if (action.driverId != profile.driverId) {
                val message = "Saved POD belongs to a different driver profile."
                pendingStore.fail(action, message); notifyTerminalFailure(action.jobId, message); continue
            }
            val payloadResult = runCatching { pendingStore.readBytes(action) }
            if (payloadResult.isFailure) {
                val message = payloadResult.exceptionOrNull()?.message ?: "Saved POD evidence is missing."
                pendingStore.fail(action, message); notifyTerminalFailure(action.jobId, message); continue
            }
            val payload = payloadResult.getOrThrow()

            var upload = mutationApi.uploadPodEvidence(session, action, payload)
            if (upload.isFailure && upload.exceptionOrNull().isDeviceSessionRevoked()) {
                sessionStore.clear(redirectToLogin = false); return Result.success()
            }
            if (upload.isFailure && upload.exceptionOrNull().isPodSessionFailure()) {
                val refreshed = api.refreshSession(session)
                if (refreshed.isSuccess) {
                    session = refreshed.getOrThrow()
                    runCatching { sessionStore.saveSession(session) }.getOrElse { error ->
                        if (error.isDeviceSessionRevoked()) return Result.success()
                        return if (error.isRetryablePodSyncFailure()) Result.retry() else Result.success()
                    }
                    upload = mutationApi.uploadPodEvidence(session, action, payload)
                    if (upload.isFailure && upload.exceptionOrNull().isDeviceSessionRevoked()) {
                        sessionStore.clear(redirectToLogin = false); return Result.success()
                    }
                } else {
                    return if (refreshed.exceptionOrNull().isRetryablePodSyncFailure()) Result.retry() else Result.success()
                }
            }

            if (upload.isSuccess) { pendingStore.remove(action.id); continue }
            val error = upload.exceptionOrNull()
            if (error.isRetryablePodSyncFailure()) return Result.retry()
            if (error.isPodSessionFailure()) return Result.success()
            val message = error?.message ?: "POD sync was rejected by the server."
            pendingStore.fail(action, message); notifyTerminalFailure(action.jobId, message)
        }
        return Result.success()
    }

    private suspend fun validateOrRefresh(initial: DriverSession): ValidationOutcome {
        val first = sessionStore.validateDeviceBinding(initial)
        if (first.isSuccess) return ValidationOutcome.Valid(initial)
        val firstError = first.exceptionOrNull()
        if (firstError.isDeviceSessionRevoked()) {
            sessionStore.clear(redirectToLogin = false)
            return ValidationOutcome.Revoked
        }
        if (!firstError.isPodSessionFailure()) return if (firstError.isRetryablePodSyncFailure()) ValidationOutcome.Retry else ValidationOutcome.AuthUnavailable

        val refreshed = api.refreshSession(initial)
        if (refreshed.isFailure) return if (refreshed.exceptionOrNull().isRetryablePodSyncFailure()) ValidationOutcome.Retry else ValidationOutcome.AuthUnavailable
        val session = refreshed.getOrThrow()
        val saved = runCatching { sessionStore.saveSession(session) }
        if (saved.isFailure) {
            val error = saved.exceptionOrNull()
            if (error.isDeviceSessionRevoked()) return ValidationOutcome.Revoked
            return if (error.isRetryablePodSyncFailure()) ValidationOutcome.Retry else ValidationOutcome.AuthUnavailable
        }
        val second = sessionStore.validateDeviceBinding(session)
        if (second.isSuccess) return ValidationOutcome.Valid(session)
        if (second.exceptionOrNull().isDeviceSessionRevoked()) {
            sessionStore.clear(redirectToLogin = false)
            return ValidationOutcome.Revoked
        }
        return if (second.exceptionOrNull().isRetryablePodSyncFailure()) ValidationOutcome.Retry else ValidationOutcome.AuthUnavailable
    }

    private fun notifyTerminalFailure(jobId: String, message: String) {
        runCatching {
            val manager = applicationContext.getSystemService(NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) manager.createNotificationChannel(NotificationChannel(FAILURE_CHANNEL_ID, "POD sync", NotificationManager.IMPORTANCE_DEFAULT))
            val openApp = PendingIntent.getActivity(applicationContext, 0, Intent(applicationContext, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            manager.notify(FAILURE_NOTIFICATION_ID, NotificationCompat.Builder(applicationContext, FAILURE_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_error).setContentTitle("XDrive POD sync needs attention")
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

    companion object { private const val FAILURE_CHANNEL_ID = "xdrive_driver_pod_sync"; private const val FAILURE_NOTIFICATION_ID = 4604 }
}

object PodSyncScheduler {
    private const val UNIQUE_WORK = "xdrive_pod_sync"
    fun schedule(context: Context) {
        val request = OneTimeWorkRequestBuilder<PodSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build()
        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(UNIQUE_WORK, ExistingWorkPolicy.REPLACE, request)
    }
}

internal fun Throwable?.isRetryablePodSyncFailure(): Boolean {
    if (this == null) return false
    if (this is IOException) return true
    val text = message.orEmpty().lowercase()
    return "unable to resolve host" in text || "no address associated with hostname" in text || "timeout" in text || "timed out" in text ||
        "connection" in text || "network" in text || "temporarily unavailable" in text || "http 408" in text || "http 425" in text ||
        "http 429" in text || "http 500" in text || "http 502" in text || "http 503" in text || "http 504" in text
}

internal fun Throwable?.isPodSessionFailure(): Boolean {
    if (this.isDeviceSessionRevoked()) return false
    val text = this?.message.orEmpty().lowercase()
    return "jwt" in text || "token" in text || "http 401" in text || "unauthorized" in text || "authentication required" in text || "session" in text
}
