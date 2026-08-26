package co.uk.xdrivelogistics.driver

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedFile
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import java.util.UUID

data class PendingPodUpload(
    val id: String,
    val userId: String,
    val driverId: String,
    val jobId: String,
    val isCollectionProof: Boolean,
    val fileName: String,
    val mimeType: String,
    val localFileName: String,
    val remoteObjectName: String,
    val createdAtEpochMs: Long,
)

private data class PodSyncFailure(
    val userId: String,
    val jobId: String,
    val message: String,
    val createdAtEpochMs: Long,
)

class PendingPodStore(context: Context) {
    private val appContext = context.applicationContext
    private val gson = Gson()
    private val listType = object : TypeToken<List<PendingPodUpload>>() {}.type
    private val failureListType = object : TypeToken<List<PodSyncFailure>>() {}.type
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }
    private val prefs: SharedPreferences by lazy {
        EncryptedSharedPreferences.create(
            appContext,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }
    private val queueDir: File by lazy {
        File(appContext.noBackupFilesDir, QUEUE_DIR).apply { mkdirs() }
    }

    @Synchronized
    fun enqueue(
        userId: String,
        driverId: String,
        jobId: String,
        isCollectionProof: Boolean,
        fileName: String,
        mimeType: String,
        bytes: ByteArray,
    ): PendingPodUpload {
        require(bytes.isNotEmpty()) { "Selected POD file is empty." }

        val id = UUID.randomUUID().toString()
        val safeName = fileName.ifBlank { "pod.jpg" }.replace("[^a-zA-Z0-9._-]".toRegex(), "_")
        val localFileName = "$id.pod"
        // Stable object name; the worker prefixes the verified current company/job
        // so production pod-photos storage policies remain authoritative.
        val remoteObjectName = "android-offline-$id-$safeName"
        val localFile = File(queueDir, localFileName)

        encryptedFile(localFile).openFileOutput().use { output ->
            output.write(bytes)
            output.flush()
        }

        val action = PendingPodUpload(
            id = id,
            userId = userId,
            driverId = driverId,
            jobId = jobId,
            isCollectionProof = isCollectionProof,
            fileName = safeName,
            mimeType = mimeType.ifBlank { "application/octet-stream" },
            localFileName = localFileName,
            remoteObjectName = remoteObjectName,
            createdAtEpochMs = System.currentTimeMillis(),
        )
        val current = readAll().toMutableList()
        current += action
        writeAll(current)
        return action
    }

    @Synchronized
    fun pendingForUser(userId: String): List<PendingPodUpload> =
        readAll()
            .filter { it.userId == userId }
            .sortedBy { it.createdAtEpochMs }

    @Synchronized
    fun hasPendingForUser(userId: String): Boolean = pendingForUser(userId).isNotEmpty()

    @Synchronized
    fun readBytes(action: PendingPodUpload): ByteArray {
        val file = File(queueDir, action.localFileName)
        if (!file.exists()) throw IllegalStateException("Saved POD evidence is missing from this device.")
        return encryptedFile(file).openFileInput().use { it.readBytes() }
    }

    @Synchronized
    fun remove(id: String) {
        val action = readAll().firstOrNull { it.id == id }
        writeAll(readAll().filterNot { it.id == id })
        action?.let { runCatching { File(queueDir, it.localFileName).delete() } }
    }

    @Synchronized
    fun fail(action: PendingPodUpload, error: String) {
        writeAll(readAll().filterNot { it.id == action.id })
        runCatching { File(queueDir, action.localFileName).delete() }
        val failures = readFailures()
            .filterNot { it.userId == action.userId && it.jobId == action.jobId }
            .toMutableList()
        failures += PodSyncFailure(
            userId = action.userId,
            jobId = action.jobId,
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
        return "A saved POD could not be synced: ${failure.message} Open the job and capture the evidence again if required."
    }

    private fun encryptedFile(file: File): EncryptedFile =
        EncryptedFile.Builder(
            appContext,
            file,
            masterKey,
            EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB,
        ).build()

    private fun readAll(): List<PendingPodUpload> {
        val raw = prefs.getString(KEY_QUEUE, null) ?: return emptyList()
        return runCatching { gson.fromJson<List<PendingPodUpload>>(raw, listType) }
            .getOrNull()
            .orEmpty()
    }

    private fun writeAll(items: List<PendingPodUpload>) {
        prefs.edit().putString(KEY_QUEUE, gson.toJson(items)).commit()
    }

    private fun readFailures(): List<PodSyncFailure> {
        val raw = prefs.getString(KEY_FAILURES, null) ?: return emptyList()
        return runCatching { gson.fromJson<List<PodSyncFailure>>(raw, failureListType) }
            .getOrNull()
            .orEmpty()
    }

    private fun writeFailures(items: List<PodSyncFailure>) {
        prefs.edit().putString(KEY_FAILURES, gson.toJson(items)).commit()
    }

    companion object {
        private const val PREFS_NAME = "xdrive_pending_pod"
        private const val KEY_QUEUE = "queue"
        private const val KEY_FAILURES = "failures"
        private const val QUEUE_DIR = "xdrive_pending_pod_payloads"
    }
}
