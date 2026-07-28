package co.uk.xdrivelogistics.driver

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import java.util.UUID

/**
 * Persisted record for a pending FCM device-token registration.
 *
 * Stores enough context to let [DeviceTokenCoordinator] detect stale A→B
 * cross-session writes: a monotonic [generation] counter advances each time a
 * new token is written so that ViewModel success handlers can reject responses
 * that correspond to an superseded operation.
 *
 * [installationId] is a stable random UUID generated once per app install.
 */
data class PendingTokenRecord(
    val token: String,
    val installationId: String,
    val generation: Long,
)

/**
 * Single authoritative coordinator for FCM token registration writes.
 *
 * Both [DriverFirebaseMessagingService.onNewToken] (background process, no active session)
 * and [DriverViewModel.registerDeviceToken] (foreground, authenticated) route through here.
 * Neither path calls the server API directly; the ViewModel absorbs pending records under
 * the correct owner+session guards, preventing stale A→B token reassignment.
 *
 * Thread-safety: [writePendingToken] increments and persists the generation atomically
 * under a lock so concurrent calls from foreground and background components produce a
 * stable, ordered sequence.
 */
class DeviceTokenCoordinator(context: Context) {
    private val appContext = context.applicationContext
    private val gson = Gson()
    private val prefs: SharedPreferences by lazy { buildPrefs() }
    private val lock = Any()

    // ── Installation identity ────────────────────────────────────────────────

    /**
     * Stable random UUID generated on first use and persisted for the lifetime of the install.
     * Used as a second-factor guard in the ViewModel to reject token updates originating from
     * a different device.
     */
    val installationId: String
        get() {
            val stored = prefs.getString(KEY_INSTALLATION_ID, null)
            if (!stored.isNullOrBlank()) return stored
            val generated = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_INSTALLATION_ID, generated).apply()
            return generated
        }

    // ── Pending token record ─────────────────────────────────────────────────

    /**
     * Persists [token] as the next pending FCM registration together with the current
     * [installationId] and a freshly incremented [generation].
     *
     * Increments the generation under a lock to serialize concurrent calls from the
     * Firebase messaging service (background) and the ViewModel (foreground), ensuring
     * the latest write always carries the highest generation number.
     *
     * @return the [PendingTokenRecord] that was persisted.
     */
    fun writePendingToken(token: String): PendingTokenRecord {
        if (token.isBlank()) error("token must not be blank")
        synchronized(lock) {
            val nextGeneration = prefs.getLong(KEY_GENERATION, 0L) + 1L
            val record = PendingTokenRecord(
                token = token,
                installationId = installationId,
                generation = nextGeneration,
            )
            prefs.edit()
                .putString(KEY_PENDING_RECORD, gson.toJson(record))
                .putLong(KEY_GENERATION, nextGeneration)
                .apply()
            return record
        }
    }

    /** Returns the stored [PendingTokenRecord], or null if none is present. */
    fun readPending(): PendingTokenRecord? {
        val json = prefs.getString(KEY_PENDING_RECORD, null) ?: return null
        return runCatching { gson.fromJson(json, PendingTokenRecord::class.java) }
            .getOrNull()
            ?.takeIf { it.token.isNotBlank() }
    }

    /**
     * Clears the pending record once the ViewModel has confirmed successful server
     * registration. Only call this when the [PendingTokenRecord.generation] of the
     * absorbed record still matches the current persisted generation to avoid clearing
     * a record that was concurrently replaced by a newer [writePendingToken] call.
     */
    fun clearPendingIfGeneration(generation: Long) {
        synchronized(lock) {
            if (prefs.getLong(KEY_GENERATION, 0L) == generation) {
                prefs.edit().remove(KEY_PENDING_RECORD).apply()
            }
        }
    }

    /** Returns the current (latest written) generation counter. */
    val currentGeneration: Long
        get() = prefs.getLong(KEY_GENERATION, 0L)

    // ── Internal helpers ─────────────────────────────────────────────────────

    private fun buildPrefs(): SharedPreferences {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            appContext,
            STORE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private companion object {
        const val STORE_NAME = "xdrive_secure_device_token_coordinator"
        const val KEY_INSTALLATION_ID = "installation_id"
        const val KEY_GENERATION = "generation"
        const val KEY_PENDING_RECORD = "pending_record"
    }
}
