package co.uk.xdrivelogistics.driver.offline

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.google.gson.JsonObject

/**
 * Crash-safe write-ahead store for pending POD uploads.
 *
 * Before the storage upload begins, the intent (jobId, driverId, storagePath, patchPayload)
 * is written synchronously. After the full upload + job-record patch succeeds, the record is
 * cleared synchronously. On app restart, any un-cleared records represent crashes between the
 * two phases and can be retried (patch-only, since the file was already uploaded).
 *
 * Key contract:
 *  - `record(...)` must be called before any network call.
 *  - `clear(...)` must be called only after both phases succeed.
 *  - `pendingForOwner(...)` returns all uncleared records for a user on restart.
 */
class PodPendingStore(context: Context) {
    private val gson = Gson()
    private val prefs: android.content.SharedPreferences = runCatching {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "xdrive_pod_pending",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }.getOrElse {
        context.getSharedPreferences("xdrive_pod_pending_fallback", Context.MODE_PRIVATE)
    }

    data class PodPendingRecord(
        val key: String,
        val ownerUserId: String,
        val driverId: String,
        val jobId: String,
        val storagePath: String,
        val needsCollectionProof: Boolean,
        val existingDeliveryPhotos: List<String>,
        val existingPodPhotos: List<String>,
        val recordedAt: Long,
        val attemptCount: Int = 0,
    )

    fun record(rec: PodPendingRecord) {
        prefs.edit().putString(rec.key, gson.toJson(rec)).commit()
    }

    fun markAttempted(key: String) {
        val existing = prefs.getString(key, null) ?: return
        runCatching {
            val obj = gson.fromJson(existing, JsonObject::class.java)
            obj.addProperty("attemptCount", (obj.get("attemptCount")?.asInt ?: 0) + 1)
            prefs.edit().putString(key, gson.toJson(obj)).commit()
        }
    }

    fun clear(key: String) {
        prefs.edit().remove(key).commit()
    }

    fun pendingForOwner(ownerUserId: String): List<PodPendingRecord> {
        return prefs.all.values
            .mapNotNull { value ->
                if (value !is String) return@mapNotNull null
                runCatching { gson.fromJson(value, PodPendingRecord::class.java) }.getOrNull()
            }
            .filter { it.ownerUserId == ownerUserId }
            .sortedBy { it.recordedAt }
    }

    fun allPending(): List<PodPendingRecord> {
        return prefs.all.values
            .mapNotNull { value ->
                if (value !is String) return@mapNotNull null
                runCatching { gson.fromJson(value, PodPendingRecord::class.java) }.getOrNull()
            }
            .sortedBy { it.recordedAt }
    }
}
