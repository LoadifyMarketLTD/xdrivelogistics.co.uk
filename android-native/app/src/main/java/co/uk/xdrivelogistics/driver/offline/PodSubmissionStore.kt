package co.uk.xdrivelogistics.driver.offline

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Durable, per-account store for in-progress server-mediated POD submissions.
 *
 * Lifecycle:
 *  1. Before any network call, [recordSubmission] writes the full intent
 *     (podKey, evidenceId, local URI, SHA-256, kind, etc.) atomically.
 *  2. After the signed-URL upload succeeds, [markEvidenceUploaded] records
 *     the confirmed canonical storage path. The record is now in UPLOADED state.
 *  3. After the server finalisation call succeeds, [clearSubmission] removes
 *     the record. Local evidence files may be deleted only after this call.
 *  4. On app restart, [pendingForOwner] returns all uncleared records so the
 *     ViewModel can resume from the correct phase.
 *
 * Account isolation: every record carries [ownerUserId]; [pendingForOwner]
 * filters strictly by owner, so driver-A's pending evidence is never visible
 * to driver-B.
 *
 * Storage: backed by [EncryptedSharedPreferences] when available, falling back
 * to regular prefs.  Neither path is cloud-synced.
 */
class PodSubmissionStore(context: Context) {

    private val gson = Gson()
    private val prefs: SharedPreferences = runCatching {
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
    }.getOrElse {
        context.getSharedPreferences("xdrive_pod_submissions_fallback", Context.MODE_PRIVATE)
    }

    // -------------------------------------------------------------------------
    // Public data types
    // -------------------------------------------------------------------------

    enum class EvidenceState {
        /** File is in app-private storage; upload has not started yet. */
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
     * @param evidenceId     Stable per-file ID generated before the first network call.
     * @param localUri       App-private content URI or file URI (durable until cleared).
     * @param sha256Hex      Lowercase hex SHA-256 of the evidence bytes.
     * @param mimeType       Detected MIME type (e.g. "image/jpeg").
     * @param byteSize       File size in bytes.
     * @param kind           "photos", "documents", or "collection".
     * @param storagePath    Canonical path in the pod-photos bucket; null until UPLOADED.
     * @param state          Current lifecycle phase.
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
     * @param podKey            Stable idempotency key for this submission.
     * @param payloadFingerprint Hex SHA-256 of the canonical payload (computed
     *                           from evidence IDs + recipientName).
     * @param ownerUserId       Account owner; never transferred or mutated.
     * @param driverId          Driver record ID.
     * @param jobId             Job being confirmed.
     * @param recipientName     Confirmed recipient name (required for POD finalisation).
     * @param signatureDataUri  Optional base64 data URI of a drawn signature image.
     * @param notes             Optional delivery notes (max 5000 chars).
     * @param evidence          One or more evidence records for this submission.
     * @param state             Overall submission phase.
     * @param recordedAt        Epoch millis when the intent was first recorded.
     * @param attemptCount      Number of finalisation attempts (for quarantine logic).
     */
    data class PodSubmissionRecord(
        val podKey: String,
        val payloadFingerprint: String?,
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
    // Write operations
    // -------------------------------------------------------------------------

    /**
     * Atomically record a new submission intent before any network call.
     * Must be called before [initPodEvidenceUpload] or [uploadEvidenceBytes].
     */
    fun recordSubmission(record: PodSubmissionRecord) {
        prefs.edit().putString(prefKey(record.ownerUserId, record.jobId), gson.toJson(record)).commit()
    }

    /**
     * Update the storage path for a specific evidence item after upload confirms.
     * Transitions that evidence item from UPLOAD_INITIATED (or PENDING_UPLOAD) to UPLOADED.
     * When all evidence items are UPLOADED, also transitions the submission to
     * READY_TO_FINALISE.
     */
    fun markEvidenceUploaded(ownerUserId: String, jobId: String, evidenceId: String, storagePath: String) {
        val key = prefKey(ownerUserId, jobId)
        val existing = load(key) ?: return
        val updatedEvidence = existing.evidence.map { ev ->
            if (ev.evidenceId == evidenceId) ev.copy(storagePath = storagePath, state = EvidenceState.UPLOADED)
            else ev
        }
        val allUploaded = updatedEvidence.all { it.state == EvidenceState.UPLOADED }
        val newState = if (allUploaded) SubmissionState.READY_TO_FINALISE else SubmissionState.PENDING
        prefs.edit().putString(key, gson.toJson(existing.copy(evidence = updatedEvidence, state = newState))).commit()
    }

    /**
     * Transition an evidence item to UPLOAD_INITIATED (signed URL obtained).
     */
    fun markEvidenceInitiated(ownerUserId: String, jobId: String, evidenceId: String) {
        val key = prefKey(ownerUserId, jobId)
        val existing = load(key) ?: return
        val updatedEvidence = existing.evidence.map { ev ->
            if (ev.evidenceId == evidenceId && ev.state == EvidenceState.PENDING_UPLOAD)
                ev.copy(state = EvidenceState.UPLOAD_INITIATED)
            else ev
        }
        prefs.edit().putString(key, gson.toJson(existing.copy(evidence = updatedEvidence))).commit()
    }

    /**
     * Increment the attempt counter. After [MAX_ATTEMPTS], the record should be
     * quarantined by the caller.
     */
    fun incrementAttemptCount(ownerUserId: String, jobId: String) {
        val key = prefKey(ownerUserId, jobId)
        val existing = load(key) ?: return
        prefs.edit().putString(key, gson.toJson(existing.copy(attemptCount = existing.attemptCount + 1))).commit()
    }

    /**
     * Remove the record after confirmed server finalisation.
     * Local evidence files must be deleted only by the caller after this returns.
     */
    fun clearSubmission(ownerUserId: String, jobId: String) {
        prefs.edit().remove(prefKey(ownerUserId, jobId)).commit()
    }

    // -------------------------------------------------------------------------
    // Read operations
    // -------------------------------------------------------------------------

    /**
     * All in-progress submissions for this owner, ordered by [PodSubmissionRecord.recordedAt].
     * Only items whose [PodSubmissionRecord.ownerUserId] matches are returned; records
     * belonging to other drivers are never included.
     */
    fun pendingForOwner(ownerUserId: String): List<PodSubmissionRecord> =
        prefs.all.values
            .mapNotNull { v -> if (v is String) load(v) else null }
            .filter { it.ownerUserId == ownerUserId }
            .sortedBy { it.recordedAt }

    /**
     * Returns the in-progress record for a specific job, or null if none exists.
     * Validates owner before returning.
     */
    fun getForOwnerJob(ownerUserId: String, jobId: String): PodSubmissionRecord? {
        val record = load(prefKey(ownerUserId, jobId)) ?: return null
        return if (record.ownerUserId == ownerUserId) record else null
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private fun prefKey(ownerUserId: String, jobId: String) = "pod_sub_${ownerUserId}_$jobId"

    private fun load(keyOrValue: String): PodSubmissionRecord? {
        // Accept either a prefs key or a raw JSON value (used when iterating all()).
        val raw = if (keyOrValue.startsWith("pod_sub_")) prefs.getString(keyOrValue, null) else keyOrValue
        return raw?.let {
            runCatching {
                gson.fromJson(it, object : TypeToken<PodSubmissionRecord>() {}.type)
            }.getOrNull()
        }
    }

    companion object {
        /** Quarantine after this many consecutive finalisation failures. */
        const val MAX_ATTEMPTS = 5
    }
}
