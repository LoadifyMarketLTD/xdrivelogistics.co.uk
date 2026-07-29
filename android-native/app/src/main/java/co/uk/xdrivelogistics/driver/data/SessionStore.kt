package co.uk.xdrivelogistics.driver.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Contract for the driver session store. Abstracted to allow fake implementations in
 * instrumented tests without touching EncryptedSharedPreferences or the Android Keystore.
 */
interface SessionRepository {
    /** Hot stream of the current persisted session. Emits null when no session is stored. */
    val session: Flow<DriverSession?>
    /** Read the current session synchronously without subscribing to the flow. */
    fun readSession(): DriverSession?
    suspend fun saveSession(session: DriverSession)
    suspend fun clear()
}

class SessionStore(context: Context) : SessionRepository {
    private object Keys {
        const val accessToken = "access_token"
        const val refreshToken = "refresh_token"
        const val userId = "user_id"
        const val email = "email"
    }

    private val appContext = context.applicationContext
    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        EncryptedSharedPreferences.create(
            appContext,
            "xdrive_secure_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    override val session: Flow<DriverSession?> = callbackFlow {
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            trySend(readSession())
        }
        prefs.registerOnSharedPreferenceChangeListener(listener)
        trySend(readSession())
        awaitClose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
    }

    override fun readSession(): DriverSession? {
        val accessToken = prefs.getString(Keys.accessToken, null)
        val refreshToken = prefs.getString(Keys.refreshToken, null)
        val userId = prefs.getString(Keys.userId, null)
        val email = prefs.getString(Keys.email, null)

        return if (accessToken == null || refreshToken == null || userId == null || email == null) {
            null
        } else {
            DriverSession(
                accessToken = accessToken,
                refreshToken = refreshToken,
                userId = userId,
                email = email,
            )
        }
    }

    override suspend fun saveSession(session: DriverSession) {
        prefs.edit()
            .putString(Keys.accessToken, session.accessToken)
            .putString(Keys.refreshToken, session.refreshToken)
            .putString(Keys.userId, session.userId)
            .putString(Keys.email, session.email)
            .apply()
    }

    override suspend fun clear() {
        prefs.edit()
            .remove(Keys.accessToken)
            .remove(Keys.refreshToken)
            .remove(Keys.userId)
            .remove(Keys.email)
            .apply()
    }
}
