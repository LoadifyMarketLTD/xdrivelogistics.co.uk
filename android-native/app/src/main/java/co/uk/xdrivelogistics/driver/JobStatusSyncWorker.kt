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

class JobStatusSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    private val pendingStore = PendingJobStatusStore(appContext)
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

        for (action in actions) {
            var update = mutationApi.updateJobStatus(session, action.jobId, action.nextStatus)
            if (update.isFailure && update.exceptionOrNull().isDeviceSessionRevoked()) {
                sessionStore.clear(redirectToLogin = false)
                return Result.success()
            }
            if (update.isFailure && update.exceptionOrNull().isStatusSessionFailure()) {
                val refreshed = api.refreshSession(session)
                if (refreshed.isSuccess) {
                    session = refreshed.getOrThrow()
                    sessionStore.saveSession(session)
                    update = mutationApi.updateJobStatus(session, action.jobId, action.nextStatus)
                    if (update.isFailure && update.exceptionOrNull().isDeviceSessionRevoked()) {
                        sessionStore.clear(redirectToLogin = false)
                        return Result.success()
                    }
                } else {
                    val refreshError = refreshed.exceptionOrNull()
                    return if (refreshError.isRetryableStatusSyncFailure()) Result.retry() else Result.success()
                }
            }

            if (update.isSuccess) {
                pendingStore.remove(action.id)
                continue
            }

            val error = update.exceptionOrNull()
            if (error.isRetryableStatusSyncFailure()) return Result.retry()
            if (error.isStatusSessionFailure()) return Result.success()

            val message = error?.message ?: "Status update was rejected by the server."
            pendingStore.failJob(
                userId = action.userId,
                jobId = action.jobId,
                error = message,
            )
            notifyTerminalFailure(action.jobId, message)
            return Result.success()
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
                        "Driver status sync",
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
                    .setContentTitle("XDrive status sync needs attention")
                    .setContentText("Job ${jobId.take(8).uppercase()}: ${message.take(120)}")
                    .setStyle(NotificationCompat.BigTextStyle().bigText(message.take(500)))
                    .setContentIntent(openApp)
                    .setAutoCancel(true)
                    .build(),
            )
        }
    }

    companion object {
        private const val FAILURE_CHANNEL_ID = "xdrive_driver_status_sync"
        private const val FAILURE_NOTIFICATION_ID = 4603
    }
}

object JobStatusSyncScheduler {
    private const val UNIQUE_WORK = "xdrive_job_status_sync"

    fun schedule(context: Context) {
        val request = OneTimeWorkRequestBuilder<JobStatusSyncWorker>()
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

internal fun Throwable?.isRetryableStatusSyncFailure(): Boolean {
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

internal fun Throwable?.isStatusSessionFailure(): Boolean {
    if (this.isDeviceSessionRevoked()) return false
    val text = this?.message.orEmpty().lowercase()
    return "jwt" in text ||
        "token" in text ||
        "http 401" in text ||
        "unauthorized" in text ||
        "authentication required" in text ||
        "session" in text
}
