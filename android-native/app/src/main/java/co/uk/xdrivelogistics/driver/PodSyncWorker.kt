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
import co.uk.xdrivelogistics.driver.data.SecureDriverMutationApi
import co.uk.xdrivelogistics.driver.data.SessionStore
import co.uk.xdrivelogistics.driver.data.isDeviceSessionRevoked
import java.io.IOException
import java.util.concurrent.TimeUnit

class PodSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    private val pendingStore = PendingPodStore(appContext)
    private val sessionStore = SessionStore(appContext)
    private val api = ApiClient(
        xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
        supabaseUrl = BuildConfig.SUPABASE_URL,
        supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
    )
    private val mutationApi = SecureDriverMutationApi(
        xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
        installationId = DeviceInstallationIdentity(appContext).installationId,
    )

    override suspend fun doWork(): Result {
        var session = sessionStore.readSession() ?: return Result.success()
        val actions = pendingStore.pendingForUser(session.userId)
        if (actions.isEmpty()) return Result.success()

        val deviceValidation = sessionStore.validateDeviceBinding(session)
        if (deviceValidation.isFailure && deviceValidation.exceptionOrNull().isDeviceSessionRevoked()) {
            sessionStore.clear(redirectToLogin = false)
            return Result.success()
        }
        if (deviceValidation.isFailure) return Result.retry()

        var profileResult = api.resolveDriverProfile(session)
        if (profileResult.isFailure && profileResult.exceptionOrNull().isPodSessionFailure()) {
            val refreshed = api.refreshSession(session)
            if (refreshed.isSuccess) {
                session = refreshed.getOrThrow()
                sessionStore.saveSession(session)
                profileResult = api.resolveDriverProfile(session)
            } else {
                val error = refreshed.exceptionOrNull()
                return if (error.isRetryablePodSyncFailure()) Result.retry() else Result.success()
            }
        }
        if (profileResult.isFailure) {
            val error = profileResult.exceptionOrNull()
            return if (error.isRetryablePodSyncFailure()) Result.retry() else Result.success()
        }
        val profile = profileResult.getOrThrow()

        for (action in actions) {
            if (action.driverId != profile.driverId) {
                val message = "Saved POD belongs to a different driver profile."
                pendingStore.fail(action, message)
                notifyTerminalFailure(action.jobId, message)
                continue
            }

            val payloadResult = runCatching { pendingStore.readBytes(action) }
            if (payloadResult.isFailure) {
                val message = payloadResult.exceptionOrNull()?.message ?: "Saved POD evidence is missing."
                pendingStore.fail(action, message)
                notifyTerminalFailure(action.jobId, message)
                continue
            }
            val payload = payloadResult.getOrThrow()

            var upload = mutationApi.uploadPodEvidence(session, action, payload)
            if (upload.isFailure && upload.exceptionOrNull().isDeviceSessionRevoked()) {
                sessionStore.clear(redirectToLogin = false)
                return Result.success()
            }
            if (upload.isFailure && upload.exceptionOrNull().isPodSessionFailure()) {
                val refreshed = api.refreshSession(session)
                if (refreshed.isSuccess) {
                    session = refreshed.getOrThrow()
                    sessionStore.saveSession(session)
                    upload = mutationApi.uploadPodEvidence(session, action, payload)
                    if (upload.isFailure && upload.exceptionOrNull().isDeviceSessionRevoked()) {
                        sessionStore.clear(redirectToLogin = false)
                        return Result.success()
                    }
                } else {
                    val refreshError = refreshed.exceptionOrNull()
                    return if (refreshError.isRetryablePodSyncFailure()) Result.retry() else Result.success()
                }
            }

            if (upload.isSuccess) {
                pendingStore.remove(action.id)
                continue
            }

            val error = upload.exceptionOrNull()
            if (error.isRetryablePodSyncFailure()) return Result.retry()
            if (error.isPodSessionFailure()) return Result.success()

            val message = error?.message ?: "POD sync was rejected by the server."
            pendingStore.fail(action, message)
            notifyTerminalFailure(action.jobId, message)
        }

        return Result.success()
    }

    private fun notifyTerminalFailure(jobId: String, message: String) {
        runCatching {
            val manager = applicationContext.getSystemService(NotificationManager::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                manager.createNotificationChannel(
                    NotificationChannel(
                        FAILURE_CHANNEL_ID,
                        "POD sync",
                        NotificationManager.IMPORTANCE_DEFAULT,
                    ),
                )
            }
            val openApp = PendingIntent.getActivity(
                applicationContext,
                0,
                Intent(applicationContext, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            manager.notify(
                FAILURE_NOTIFICATION_ID,
                NotificationCompat.Builder(applicationContext, FAILURE_CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_notify_error)
                    .setContentTitle("XDrive POD sync needs attention")
                    .setContentText("Job ${jobId.take(8).uppercase()}: ${message.take(120)}")
                    .setStyle(NotificationCompat.BigTextStyle().bigText(message.take(500)))
                    .setContentIntent(openApp)
                    .setAutoCancel(true)
                    .build(),
            )
        }
    }

    companion object {
        private const val FAILURE_CHANNEL_ID = "xdrive_driver_pod_sync"
        private const val FAILURE_NOTIFICATION_ID = 4604
    }
}

object PodSyncScheduler {
    private const val UNIQUE_WORK = "xdrive_pod_sync"

    fun schedule(context: Context) {
        val request = OneTimeWorkRequestBuilder<PodSyncWorker>()
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
            UNIQUE_WORK,
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }
}

internal fun Throwable?.isRetryablePodSyncFailure(): Boolean {
    if (this == null) return false
    if (this is IOException) return true
    val text = message.orEmpty().lowercase()
    return "unable to resolve host" in text ||
        "no address associated with hostname" in text ||
        "timeout" in text ||
        "timed out" in text ||
        "connection" in text ||
        "network" in text ||
        "temporarily unavailable" in text ||
        "http 408" in text ||
        "http 425" in text ||
        "http 429" in text ||
        "http 500" in text ||
        "http 502" in text ||
        "http 503" in text ||
        "http 504" in text
}

internal fun Throwable?.isPodSessionFailure(): Boolean {
    if (this.isDeviceSessionRevoked()) return false
    val text = this?.message.orEmpty().lowercase()
    return "jwt" in text ||
        "token" in text ||
        "http 401" in text ||
        "unauthorized" in text ||
        "authentication required" in text ||
        "session" in text
}
