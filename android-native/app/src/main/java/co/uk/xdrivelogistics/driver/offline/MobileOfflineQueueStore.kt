package co.uk.xdrivelogistics.driver.offline

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

data class CorruptQueueSnapshot(
    val source: String,
    val raw: String,
    val capturedAtEpochMs: Long,
)

internal class MobileOfflineQueuePersistenceCodec {
    private val gson = Gson()

    fun parseItems(raw: String?): List<MobileQueueItem>? {
        val payload = raw?.trim().orEmpty()
        if (payload.isBlank()) return emptyList()
        return runCatching {
            val type = object : TypeToken<List<MobileQueueItem>>() {}.type
            gson.fromJson<List<MobileQueueItem>>(payload, type).orEmpty()
        }.getOrNull()
    }

    fun parseCorruptSnapshots(raw: String?): List<CorruptQueueSnapshot> {
        val payload = raw?.trim().orEmpty()
        if (payload.isBlank()) return emptyList()
        return runCatching {
            val type = object : TypeToken<List<CorruptQueueSnapshot>>() {}.type
            gson.fromJson<List<CorruptQueueSnapshot>>(payload, type).orEmpty()
        }.getOrDefault(emptyList())
    }

    fun toJson(items: List<MobileQueueItem>): String = gson.toJson(items)
    fun toCorruptSnapshotsJson(items: List<CorruptQueueSnapshot>): String = gson.toJson(items)
}

class MobileOfflineQueueStore(context: Context) {
    private val appContext = context.applicationContext
    private val codec = MobileOfflineQueuePersistenceCodec()
    private val preferences: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            appContext,
            STORE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun readAll(): List<MobileQueueItem> {
        val primaryRaw = preferences.getString(KEY_QUEUE_ITEMS, null)
        val parsedPrimary = codec.parseItems(primaryRaw)
        if (parsedPrimary != null) return parsedPrimary

        quarantineRaw(source = "primary", raw = primaryRaw.orEmpty())

        val backupRaw = preferences.getString(KEY_QUEUE_ITEMS_BACKUP, null)
        val parsedBackup = codec.parseItems(backupRaw)
        if (parsedBackup != null) return parsedBackup

        quarantineRaw(source = "backup", raw = backupRaw.orEmpty())
        return emptyList()
    }

    fun saveAll(items: List<MobileQueueItem>) {
        val previousRaw = preferences.getString(KEY_QUEUE_ITEMS, null)
        val nextRaw = codec.toJson(items)
        val committed = preferences.edit()
            .putString(KEY_QUEUE_ITEMS_BACKUP, previousRaw)
            .putString(KEY_QUEUE_ITEMS, nextRaw)
            .commit()
        check(committed) { "Failed to persist offline queue snapshot." }
    }

    fun saveQuarantinedItems(items: List<MobileQueueItem>) {
        if (items.isEmpty()) return
        val snapshots = items.map {
            CorruptQueueSnapshot(
                source = "queue-validation",
                raw = codec.toJson(listOf(it)),
                capturedAtEpochMs = System.currentTimeMillis(),
            )
        }
        val existing = codec.parseCorruptSnapshots(preferences.getString(KEY_QUARANTINED_SNAPSHOTS, null))
        val merged = (existing + snapshots).takeLast(MAX_QUARANTINED_SNAPSHOTS)
        preferences.edit()
            .putString(KEY_QUARANTINED_SNAPSHOTS, codec.toCorruptSnapshotsJson(merged))
            .commit()
    }

    private fun quarantineRaw(source: String, raw: String) {
        if (raw.isBlank()) return
        val existing = codec.parseCorruptSnapshots(preferences.getString(KEY_QUARANTINED_SNAPSHOTS, null))
        val merged = (existing + CorruptQueueSnapshot(source = source, raw = raw.take(MAX_QUARANTINED_RAW_CHARS), capturedAtEpochMs = System.currentTimeMillis()))
            .takeLast(MAX_QUARANTINED_SNAPSHOTS)
        preferences.edit()
            .putString(KEY_QUARANTINED_SNAPSHOTS, codec.toCorruptSnapshotsJson(merged))
            .commit()
    }

    private companion object {
        const val STORE_NAME = "xdrive_secure_mobile_offline_queue"
        const val KEY_QUEUE_ITEMS = "queue_items"
        const val KEY_QUEUE_ITEMS_BACKUP = "queue_items_backup"
        const val KEY_QUARANTINED_SNAPSHOTS = "queue_items_quarantined_snapshots"
        const val MAX_QUARANTINED_SNAPSHOTS = 32
        const val MAX_QUARANTINED_RAW_CHARS = 2_000
    }
}
