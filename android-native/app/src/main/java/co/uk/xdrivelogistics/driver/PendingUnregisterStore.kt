package co.uk.xdrivelogistics.driver

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Durable storage for a pending FCM device-token unregister that must survive process death.
 *
 * If the logout-time server unregister fails and the process dies before the same owner
 * signs in again, the pending record persists here so it can be retried on next login.
 * Only one pending record is stored at a time; it is replaced on each new failed unregister
 * and cleared on success or owner mismatch.
 */
class PendingUnregisterStore(context: Context) {
    private val appContext = context.applicationContext
    private val prefs: SharedPreferences by lazy {
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

    /** Persists a pending unregister record for [ownerId] and [token]. */
    fun save(ownerId: String, token: String) {
        prefs.edit()
            .putString(KEY_OWNER_ID, ownerId)
            .putString(KEY_TOKEN, token)
            .apply()
    }

    /** Reads the stored pending record, or null if none is present. */
    fun read(): PendingUnregister? {
        val ownerId = prefs.getString(KEY_OWNER_ID, null) ?: return null
        val token = prefs.getString(KEY_TOKEN, null) ?: return null
        if (ownerId.isBlank() || token.isBlank()) return null
        return PendingUnregister(ownerId = ownerId, token = token)
    }

    /** Removes the stored pending record. */
    fun clear() {
        prefs.edit()
            .remove(KEY_OWNER_ID)
            .remove(KEY_TOKEN)
            .apply()
    }

    private companion object {
        const val STORE_NAME = "xdrive_secure_pending_unregister"
        const val KEY_OWNER_ID = "owner_id"
        const val KEY_TOKEN = "token"
    }
}

data class PendingUnregister(val ownerId: String, val token: String)
