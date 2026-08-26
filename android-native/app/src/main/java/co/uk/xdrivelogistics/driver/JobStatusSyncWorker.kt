package co.uk.xdrivelogistics.driver

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.SessionStore
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

    override suspend fun doWork(): Result {
        var session = sessionStore.readSession() ?: return Result.success()
        val actions = pendingStore.pendingForUser(session.userId)
        if (actions.isEmpty()) return Result.success()

        for (action in actions) {
            var update = api.updateJobStatus(session, action.driverId, action.jobId, action.nextStatus)
            if (update.isFailure && update.exceptionOrNull().isStatusSessionFailure()) {
                val refreshed = api.refreshSession(session)
                if (refreshed.isSuccess) {
                    session = refreshed.getOrThrow()
                    sessionStore.saveSession(session)
                    update = api.updateJobStatus(session, action.driverId, action.jobId, action.nextStatus)
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

            pendingStore.failJob(
                userId = action.userId,
                jobId = action.jobId,
                error = error?.message ?: "Status update was rejected by the server.",
            )
            return Result.success()
        }

        return Result.success()
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
        "502" in text ||
        "503" in text ||
        "504" in text
}

internal fun Throwable?.isStatusSessionFailure(): Boolean {
    val text = this?.message.orEmpty().lowercase()
    return "jwt" in text ||
        "token" in text ||
        "401" in text ||
        "unauthorized" in text ||
        "authentication required" in text ||
        "session" in text
}
