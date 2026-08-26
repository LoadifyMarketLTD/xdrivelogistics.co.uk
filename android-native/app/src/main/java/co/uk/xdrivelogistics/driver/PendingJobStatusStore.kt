package co.uk.xdrivelogistics.driver

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import co.uk.xdrivelogistics.driver.data.DriverJob
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID

data class PendingJobStatusUpdate(
    val id: String,
    val userId: String,
    val driverId: String,
    val jobId: String,
    val nextStatus: String,
    val createdAtEpochMs: Long,
)

private data class JobStatusSyncFailure(
    val userId: String,
    val jobId: String,
    val message: String,
    val createdAtEpochMs: Long,
)

class PendingJobStatusStore(context: Context) {
    private val appContext = context.applicationContext
    private val gson = Gson()
    private val listType = object : TypeToken<List<PendingJobStatusUpdate>>() {}.type
    private val failureListType = object : TypeToken<List<JobStatusSyncFailure>>() {}.type
    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            appContext,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    @Synchronized
    fun enqueue(userId: String, driverId: String, jobId: String, nextStatus: String): PendingJobStatusUpdate {
        val canonical = normalizeDriverStatus(nextStatus)
        val current = readAll().toMutableList()
        current.firstOrNull {
            it.userId == userId && it.driverId == driverId && it.jobId == jobId && it.nextStatus == canonical
        }?.let { return it }

        val action = PendingJobStatusUpdate(
            id = UUID.randomUUID().toString(),
            userId = userId,
            driverId = driverId,
            jobId = jobId,
            nextStatus = canonical,
            createdAtEpochMs = System.currentTimeMillis(),
        )
        current += action
        writeAll(current)
        return action
    }

    @Synchronized
    fun pendingForUser(userId: String): List<PendingJobStatusUpdate> =
        readAll()
            .filter { it.userId == userId }
            .sortedBy { it.createdAtEpochMs }

    @Synchronized
    fun hasPendingForUser(userId: String): Boolean = pendingForUser(userId).isNotEmpty()

    @Synchronized
    fun remove(id: String) {
        writeAll(readAll().filterNot { it.id == id })
    }

    @Synchronized
    fun failJob(userId: String, jobId: String, error: String) {
        writeAll(readAll().filterNot { it.userId == userId && it.jobId == jobId })
        val failures = readFailures().filterNot { it.userId == userId && it.jobId == jobId }.toMutableList()
        failures += JobStatusSyncFailure(
            userId = userId,
            jobId = jobId,
            message = error.take(500),
            createdAtEpochMs = System.currentTimeMillis(),
        )
        writeFailures(failures)
    }

    @Synchronized
    fun consumeFailureForUser(userId: String): String? {
        val failures = readFailures().sortedBy { it.createdAtEpochMs }
        val failure = failures.firstOrNull { it.userId == userId } ?: return null
        writeFailures(failures.filterNot { it === failure })
        return "A saved job status could not be synced: ${failure.message} Refresh the job before continuing."
    }

    @Synchronized
    fun optimisticJobs(userId: String, jobs: List<DriverJob>): List<DriverJob> {
        val latestByJob = pendingForUser(userId)
            .groupBy { it.jobId }
            .mapValues { (_, actions) -> actions.maxByOrNull { it.createdAtEpochMs }!! }
        if (latestByJob.isEmpty()) return jobs
        return jobs.map { job ->
            val pending = latestByJob[job.id] ?: return@map job
            job.copy(status = pending.nextStatus, currentStatus = pending.nextStatus)
        }
    }

    private fun readAll(): List<PendingJobStatusUpdate> {
        val raw = prefs.getString(KEY_QUEUE, null) ?: return emptyList()
        return runCatching { gson.fromJson<List<PendingJobStatusUpdate>>(raw, listType) }
            .getOrNull()
            .orEmpty()
    }

    private fun writeAll(items: List<PendingJobStatusUpdate>) {
        prefs.edit().putString(KEY_QUEUE, gson.toJson(items)).commit()
    }

    private fun readFailures(): List<JobStatusSyncFailure> {
        val raw = prefs.getString(KEY_FAILURES, null) ?: return emptyList()
        return runCatching { gson.fromJson<List<JobStatusSyncFailure>>(raw, failureListType) }
            .getOrNull()
            .orEmpty()
    }

    private fun writeFailures(items: List<JobStatusSyncFailure>) {
        prefs.edit().putString(KEY_FAILURES, gson.toJson(items)).commit()
    }

    companion object {
        private const val PREFS_NAME = "xdrive_pending_job_status"
        private const val KEY_QUEUE = "queue"
        private const val KEY_FAILURES = "failures"
    }
}
