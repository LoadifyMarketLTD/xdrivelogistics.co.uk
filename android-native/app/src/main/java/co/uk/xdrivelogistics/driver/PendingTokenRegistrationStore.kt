package co.uk.xdrivelogistics.driver

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Durable store for an FCM registration token written by [DriverFirebaseMessagingService.onNewToken].
 *
 * The service does NOT call the registration API directly. It writes the token here so the
 * [DriverViewModel] can process it under the correct owner+session guards, preventing stale
 * A→B cross-session mutations from reaching the server.
 *
 * The ViewModel clears the entry once the token is successfully registered for the current owner.
 */
class PendingTokenRegistrationStore(context: Context) {
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

    /** Persists [token] as the latest FCM registration token waiting to be server-registered. */
    fun save(token: String) {
        if (token.isBlank()) return
        prefs.edit().putString(KEY_TOKEN, token).apply()
    }

    /** Returns the stored pending token, or null if none is present. */
    fun read(): String? = prefs.getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }

    /** Removes the stored pending token once the ViewModel has registered it. */
    fun clear() {
        prefs.edit().remove(KEY_TOKEN).apply()
    }

    private companion object {
        const val STORE_NAME = "xdrive_secure_pending_token_registration"
        const val KEY_TOKEN = "token"
    }
}
