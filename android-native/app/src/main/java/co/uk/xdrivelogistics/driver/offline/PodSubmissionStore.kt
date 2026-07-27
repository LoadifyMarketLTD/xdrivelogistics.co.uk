package co.uk.xdrivelogistics.driver.offline

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson

// -------------------------------------------------------------------------
// Storage exception hierarchy
// -------------------------------------------------------------------------

/**
 * Typed exception hierarchy for [PodSubmissionStore] persistence failures.
 * All write operations throw a subclass of this when persistence cannot be guaranteed.
 */
sealed class PodStorageException(message: String, cause: Throwable? = null) : Exception(message, cause) {
    /**
     * Encrypted storage is unavailable on this device (hardware key unavailable,
     * security chip locked, or similar). POD submission cannot be persisted safely.
     */
    class Unavailable(message: String, cause: Throwable? = null) : PodStorageException(message, cause)

    /**
     * A synchronous [SharedPreferences.Editor.commit] call returned false.
     * The intended write may not have been persisted to disk.
     */
    class CommitFailed(operation: String) : PodStorageException(
        "POD store commit failed during '$operation'. Evidence persistence cannot be guaranteed."
    )
}

// -------------------------------------------------------------------------
// Internal storage backend abstraction (enables unit testing without Android)
// -------------------------------------------------------------------------

/**
 * Minimal key-value store interface used internally by [PodSubmissionStore].
 * The primary implementation wraps [EncryptedSharedPreferences].
 * Test implementations may use an in-memory [Map].
 */
internal interface PodStoreBackend {
    fun getString(key: String): String?
    /** Returns `true` if the write was committed to disk. */
    fun putStringSync(key: String, value: String): Boolean
    /** Returns `true` if the remove was committed to disk. */
    fun removeSync(key: String): Boolean
    /** All string values currently persisted (keys → values). */
    fun allStrings(): Map<String, String>
}

/** Backend backed by a [SharedPreferences] instance (encrypted or plain). */
private class SharedPreferencesPodBackend(private val prefs: SharedPreferences) : PodStoreBackend {
    override fun getString(key: String): String? = prefs.getString(key, null)
    override fun putStringSync(key: String, value: String): Boolean =
        prefs.edit().putString(key, value).commit()
    override fun removeSync(key: String): Boolean =
        prefs.edit().remove(key).commit()
    override fun allStrings(): Map<String, String> =
        prefs.all.entries
            .mapNotNull { (k, v) -> if (v is String) k to v else null }
            .toMap()
}

/** In-memory backend for unit tests — never persists to disk. */
internal class InMemoryPodStoreBackend : PodStoreBackend {
    private val map = mutableMapOf<String, String>()
    override fun getString(key: String): String? = map[key]
    override fun putStringSync(key: String, value: String): Boolean { map[key] = value; return true }
    override fun removeSync(key: String): Boolean { map.remove(key); return true }
    override fun allStrings(): Map<String, String> = map.toMap()
}

/**
 * Durable, per-account store for in-progress server-mediated POD submissions.
 *
 * Lifecycle:
 *  1. Before any network call, [recordSubmission] writes the full intent
 *     (podKey, evidenceId, local durable URI, SHA-256, kind, etc.) atomically.
 *     [PodSubmissionRecord.payloadFingerprint] must be a non-empty string computed
 *     before the first upload-init call.
 *  2. After the signed-URL upload succeeds, [markEvidenceUploaded] records
 *     the confirmed canonical storage path.
 *  3. After the server finalisation call succeeds, [clearSubmission] removes
 *     the record. Local evidence files must be deleted by the caller only after
 *     this call returns.
 *  4. On app restart, [pendingForOwner] returns all valid uncleared records.
 *     Malformed records are quarantined: removed from the store and reported
 *     via the [onQuarantined] callback without poisoning valid records.
 *
 * Account isolation: every record carries [ownerUserId]; [pendingForOwner]
 * filters strictly by owner, so driver-A's pending evidence is never visible
 * to driver-B.
 *
 * Storage: backed exclusively by [EncryptedSharedPreferences]. Silent downgrade to
 * unencrypted storage is not permitted. If the encrypted store is unavailable,
 * [isStorageAvailable] returns `false` and all write operations throw
 * [PodStorageException.Unavailable].
 */
class PodSubmissionStore internal constructor(
    private val backend: PodStoreBackend,
    private val storageAvailable: Boolean = true,
    private val onQuarantined: (key: String, rawJson: String, cause: Throwable) -> Unit = { _, _, _ -> },
) {
    private val gson = Gson()

    /**
     * `true` when the encrypted storage backend is available.
     * When `false`, read operations return empty/null and write operations
     * throw [PodStorageException.Unavailable].
     */
    val isStorageAvailable: Boolean get() = storageAvailable

    private fun requireStorage(operation: String) {
        if (!storageAvailable) throw PodStorageException.Unavailable(
            "Encrypted storage is unavailable. Cannot persist POD evidence for '$operation'."
        )
    }

    // -------------------------------------------------------------------------
    // Public data types
    // -------------------------------------------------------------------------

    enum class EvidenceState {
        /** File is in app-private durable storage; upload has not started yet. */
        PENDING_UPLOAD,
        /** Upload-init was called; signed URL obtained but upload not confirmed. */
        UPLOAD_INITIATED,
        /** File upload to storage confirmed; server finalisation not yet called. */
        UPLOADED,
    }

    enum class SubmissionState {
        /** One or more evidence items are not yet uploaded. */
        PENDING,
        /** All evidence uploaded; server finalisation not yet confirmed. */
        READY_TO_FINALISE,
    }

    /**
     * Metadata for a single piece of evidence (photo, document, or collection photo).
     *
     * @param evidenceId  Stable per-file ID generated before the first network call.
     * @param localUri    Absolute path to the app-private durable copy of the file
     *                    (e.g. in `context.filesDir/pod/`). Must never be a cache or
     *                    temporary content URI.
     * @param sha256Hex   Lowercase hex SHA-256 of the evidence bytes.
     * @param mimeType    Detected MIME type (e.g. "image/jpeg").
     * @param byteSize    File size in bytes.
     * @param kind        "photos", "documents", or "collection".
     * @param storagePath Canonical path in the pod-photos bucket; null until UPLOADED.
     * @param state       Current lifecycle phase.
     */
    data class EvidenceRecord(
        val evidenceId: String,
        val localUri: String,
        val sha256Hex: String,
        val mimeType: String,
        val byteSize: Long,
        val kind: String,
        val storagePath: String? = null,
        val state: EvidenceState = EvidenceState.PENDING_UPLOAD,
    )

    /**
     * Full POD submission intent for one job.
     *
     * @param podKey             Stable idempotency key for this submission.
     * @param payloadFingerprint Non-null hex fingerprint computed before the first
     *                           network call (from podKey + evidenceId + sha256Hex).
     *                           Updated at finalisation to include evidence paths +
     *                           recipientName.  Must not be blank.
     * @param ownerUserId        Account owner; never transferred or mutated.
     * @param driverId           Driver record ID.
     * @param jobId              Job being confirmed.
     * @param recipientName      Confirmed recipient name (required for POD finalisation).
     * @param signatureDataUri   Optional base64 data URI of a drawn signature image.
     * @param notes              Optional delivery notes (max 5000 chars).
     * @param evidence           One or more evidence records for this submission.
     * @param state              Overall submission phase.
     * @param recordedAt         Epoch millis when the intent was first recorded.
     * @param attemptCount       Number of finalisation attempts (for quarantine logic).
     */
    data class PodSubmissionRecord(
        val podKey: String,
        val payloadFingerprint: String,
        val ownerUserId: String,
        val driverId: String,
        val jobId: String,
        val recipientName: String,
        val signatureDataUri: String?,
        val notes: String?,
        val evidence: List<EvidenceRecord>,
        val state: SubmissionState = SubmissionState.PENDING,
        val recordedAt: Long = System.currentTimeMillis(),
        val attemptCount: Int = 0,
    )

    // -------------------------------------------------------------------------
    // Write operations — all throw PodStorageException on failure
    // -------------------------------------------------------------------------

    /**
     * Atomically record a new submission intent before any network call.
     * Must be called before `initPodEvidenceUpload` or `uploadEvidenceBytes`.
     *
     * [record.payloadFingerprint] must not be blank.
     *
     * @throws PodStorageException.Unavailable  if encrypted storage is not available.
     * @throws PodStorageException.CommitFailed if the synchronous disk write failed.
     */
    fun recordSubmission(record: PodSubmissionRecord) {
        requireStorage("recordSubmission")
        require(record.payloadFingerprint.isNotBlank()) {
            "payloadFingerprint must be set before persisting a POD submission record."
        }
        val committed = backend.putStringSync(prefKey(record.ownerUserId, record.jobId), gson.toJson(record))
        if (!committed) throw PodStorageException.CommitFailed("recordSubmission")
    }

    /**
     * Update the storage path for a specific evidence item after upload confirms.
     * When all evidence items are UPLOADED, also transitions the submission to
     * READY_TO_FINALISE.
     *
     * @throws PodStorageException.Unavailable  if encrypted storage is not available.
     * @throws PodStorageException.CommitFailed if the synchronous disk write failed.
     */
    fun markEvidenceUploaded(ownerUserId: String, jobId: String, evidenceId: String, storagePath: String) {
        requireStorage("markEvidenceUploaded")
        val key = prefKey(ownerUserId, jobId)
        val existing = load(key) ?: return
        val updatedEvidence = existing.evidence.map { ev ->
            if (ev.evidenceId == evidenceId) ev.copy(storagePath = storagePath, state = EvidenceState.UPLOADED)
            else ev
        }
        val allUploaded = updatedEvidence.all { it.state == EvidenceState.UPLOADED }
        val newState = if (allUploaded) SubmissionState.READY_TO_FINALISE else SubmissionState.PENDING
        val committed = backend.putStringSync(key, gson.toJson(existing.copy(evidence = updatedEvidence, state = newState)))
        if (!committed) throw PodStorageException.CommitFailed("markEvidenceUploaded")
    }

    /**
     * Transition an evidence item to UPLOAD_INITIATED (signed URL obtained).
     *
     * @throws PodStorageException.Unavailable  if encrypted storage is not available.
     * @throws PodStorageException.CommitFailed if the synchronous disk write failed.
     */
    fun markEvidenceInitiated(ownerUserId: String, jobId: String, evidenceId: String) {
        requireStorage("markEvidenceInitiated")
        val key = prefKey(ownerUserId, jobId)
        val existing = load(key) ?: return
        val updatedEvidence = existing.evidence.map { ev ->
            if (ev.evidenceId == evidenceId && ev.state == EvidenceState.PENDING_UPLOAD)
                ev.copy(state = EvidenceState.UPLOAD_INITIATED)
            else ev
        }
        val committed = backend.putStringSync(key, gson.toJson(existing.copy(evidence = updatedEvidence)))
        if (!committed) throw PodStorageException.CommitFailed("markEvidenceInitiated")
    }

    /**
     * Increment the attempt counter. After [MAX_ATTEMPTS], the record should be
     * quarantined by the caller.
     *
     * @throws PodStorageException.Unavailable  if encrypted storage is not available.
     * @throws PodStorageException.CommitFailed if the synchronous disk write failed.
     */
    fun incrementAttemptCount(ownerUserId: String, jobId: String) {
        requireStorage("incrementAttemptCount")
        val key = prefKey(ownerUserId, jobId)
        val existing = load(key) ?: return
        val committed = backend.putStringSync(key, gson.toJson(existing.copy(attemptCount = existing.attemptCount + 1)))
        if (!committed) throw PodStorageException.CommitFailed("incrementAttemptCount")
    }

    /**
     * Remove the record after confirmed server finalisation.
     * Local evidence files must be deleted only by the caller after this returns.
     *
     * @throws PodStorageException.Unavailable  if encrypted storage is not available.
     * @throws PodStorageException.CommitFailed if the synchronous disk write failed.
     */
    fun clearSubmission(ownerUserId: String, jobId: String) {
        requireStorage("clearSubmission")
        val committed = backend.removeSync(prefKey(ownerUserId, jobId))
        if (!committed) throw PodStorageException.CommitFailed("clearSubmission")
    }

    // -------------------------------------------------------------------------
    // Read operations — return empty/null when storage is unavailable
    // -------------------------------------------------------------------------

    /**
     * All in-progress submissions for this owner, ordered by [PodSubmissionRecord.recordedAt].
     * Only items whose [PodSubmissionRecord.ownerUserId] matches are returned.
     *
     * Malformed records are quarantined: removed from the store and reported via
     * [onQuarantined] without throwing, so one corrupt record cannot prevent other
     * valid records from loading.
     */
    fun pendingForOwner(ownerUserId: String): List<PodSubmissionRecord> {
        if (!storageAvailable) return emptyList()
        val allValues = backend.allStrings()
        val valid = mutableListOf<PodSubmissionRecord>()
        for ((key, rawJson) in allValues) {
            val parsed = runCatching { gson.fromJson(rawJson, PodSubmissionRecord::class.java) }
            if (parsed.isSuccess) {
                val rec = parsed.getOrThrow()
                if (rec.ownerUserId == ownerUserId) valid.add(rec)
            } else {
                val cause = parsed.exceptionOrNull() ?: Exception("unknown deserialization error")
                runCatching { backend.removeSync(key) }
                onQuarantined(key, rawJson, cause)
            }
        }
        return valid.sortedBy { it.recordedAt }
    }

    /**
     * Returns the in-progress record for a specific job, or null if none exists.
     * Validates owner before returning.
     */
    fun getForOwnerJob(ownerUserId: String, jobId: String): PodSubmissionRecord? {
        if (!storageAvailable) return null
        val record = load(prefKey(ownerUserId, jobId)) ?: return null
        return if (record.ownerUserId == ownerUserId) record else null
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private fun prefKey(ownerUserId: String, jobId: String) = "pod_sub_${ownerUserId}_$jobId"

    private fun load(key: String): PodSubmissionRecord? {
        val raw = backend.getString(key) ?: return null
        return runCatching { gson.fromJson(raw, PodSubmissionRecord::class.java) }.getOrNull()
    }

    companion object {
        /** Quarantine after this many consecutive finalisation failures. */
        const val MAX_ATTEMPTS = 5

        /**
         * Creates a [PodSubmissionStore] backed by [EncryptedSharedPreferences].
         * Encrypted storage is attempted exactly once — no silent fallback.
         * If init fails, [isStorageAvailable] will be `false` and all writes throw
         * [PodStorageException.Unavailable].
         *
         * Using [operator fun invoke] allows the idiomatic call-site syntax
         * `PodSubmissionStore(context)` without a secondary constructor, avoiding
         * the double-initialisation problem inherent in secondary constructors that
         * delegate to a primary constructor with multiple derived parameters.
         */
        operator fun invoke(context: Context): PodSubmissionStore {
            val prefsResult = runCatching {
                val masterKey = MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
                EncryptedSharedPreferences.create(
                    context,
                    "xdrive_pod_submissions",
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
                )
            }
            return if (prefsResult.isSuccess) {
                PodSubmissionStore(SharedPreferencesPodBackend(prefsResult.getOrThrow()), true)
            } else {
                PodSubmissionStore(InMemoryPodStoreBackend(), false)
            }
        }
    }
}
