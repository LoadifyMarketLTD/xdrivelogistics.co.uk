package co.uk.xdrivelogistics.driver

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import co.uk.xdrivelogistics.driver.data.DriverBid
import co.uk.xdrivelogistics.driver.data.DriverJob
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID

data class PendingQuoteSubmission(
    val id: String,
    val userId: String,
    val driverId: String,
    val jobId: String,
    val amount: Double,
    val note: String,
    val createdAtEpochMs: Long,
)

private data class QuoteSyncFailure(
    val userId: String,
    val jobId: String,
    val amount: Double,
    val note: String,
    val message: String,
    val createdAtEpochMs: Long,
)

class PendingQuoteStore(context: Context) {
    private val appContext = context.applicationContext
    private val gson = Gson()
    private val queueType = object : TypeToken<List<PendingQuoteSubmission>>() {}.type
    private val failureType = object : TypeToken<List<QuoteSyncFailure>>() {}.type
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
    fun enqueue(
        userId: String,
        driverId: String,
        jobId: String,
        amount: Double,
        note: String,
    ): PendingQuoteSubmission {
        require(amount.isFinite() && amount > 0.0 && amount <= 1_000_000.0) { "Enter a valid quote amount." }
        require(note.length <= 1_000) { "Quote message is too long." }

        val current = readQueue().toMutableList()
        val sameJob = current.firstOrNull { it.userId == userId && it.driverId == driverId && it.jobId == jobId }
        if (sameJob != null) {
            require(sameJob.amount == amount && sameJob.note == note.trim()) {
                "A quote for this job is already pending. Wait for it to sync before changing the amount."
            }
            return sameJob
        }

        val action = PendingQuoteSubmission(
            id = UUID.randomUUID().toString(),
            userId = userId,
            driverId = driverId,
            jobId = jobId,
            amount = amount,
            note = note.trim(),
            createdAtEpochMs = System.currentTimeMillis(),
        )
        current += action
        writeQueue(current)
        return action
    }

    @Synchronized
    fun pendingForUser(userId: String): List<PendingQuoteSubmission> =
        readQueue().filter { it.userId == userId }.sortedBy { it.createdAtEpochMs }

    @Synchronized
    fun hasPendingForUser(userId: String): Boolean = pendingForUser(userId).isNotEmpty()

    @Synchronized
    fun remove(id: String) {
        writeQueue(readQueue().filterNot { it.id == id })
    }

    @Synchronized
    fun fail(action: PendingQuoteSubmission, message: String) {
        remove(action.id)
        val failures = readFailures()
            .filterNot { it.userId == action.userId && it.jobId == action.jobId }
            .toMutableList()
        failures += QuoteSyncFailure(
            userId = action.userId,
            jobId = action.jobId,
            amount = action.amount,
            note = action.note,
            message = message.take(500),
            createdAtEpochMs = System.currentTimeMillis(),
        )
        writeFailures(failures)
    }

    @Synchronized
    fun consumeFailureForUser(userId: String): String? {
        val failures = readFailures().sortedBy { it.createdAtEpochMs }
        val failure = failures.firstOrNull { it.userId == userId } ?: return null
        writeFailures(failures.filterNot { it === failure })
        return "A saved quote was not sent: ${failure.message} Refresh the load before quoting again."
    }

    @Synchronized
    fun optimisticBids(userId: String, jobs: List<DriverJob>, serverBids: List<DriverBid>): List<DriverBid> {
        val serverJobIds = serverBids.mapTo(mutableSetOf()) { it.jobId }
        val jobsById = jobs.associateBy { it.id }
        val pending = pendingForUser(userId)
            .filterNot { it.jobId in serverJobIds }
            .map { action ->
                val job = jobsById[action.jobId]
                DriverBid(
                    id = "pending-${action.id}",
                    jobId = action.jobId,
                    amount = action.amount,
                    currency = "GBP",
                    status = "pending",
                    message = action.note,
                    createdAt = null,
                    pickupLocation = job?.pickupLocation ?: "Collection area",
                    deliveryLocation = job?.deliveryLocation ?: "Delivery area",
                    pickupDatetime = job?.pickupDatetime,
                    clientName = job?.clientName.orEmpty(),
                )
            }
        return pending + serverBids
    }

    private fun readQueue(): List<PendingQuoteSubmission> {
        val raw = prefs.getString(KEY_QUEUE, null) ?: return emptyList()
        return runCatching { gson.fromJson<List<PendingQuoteSubmission>>(raw, queueType) }.getOrNull().orEmpty()
    }

    private fun writeQueue(items: List<PendingQuoteSubmission>) {
        prefs.edit().putString(KEY_QUEUE, gson.toJson(items)).commit()
    }

    private fun readFailures(): List<QuoteSyncFailure> {
        val raw = prefs.getString(KEY_FAILURES, null) ?: return emptyList()
        return runCatching { gson.fromJson<List<QuoteSyncFailure>>(raw, failureType) }.getOrNull().orEmpty()
    }

    private fun writeFailures(items: List<QuoteSyncFailure>) {
        prefs.edit().putString(KEY_FAILURES, gson.toJson(items)).commit()
    }

    companion object {
        private const val PREFS_NAME = "xdrive_pending_quotes"
        private const val KEY_QUEUE = "queue"
        private const val KEY_FAILURES = "failures"
    }
}
