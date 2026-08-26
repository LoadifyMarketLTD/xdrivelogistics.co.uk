package co.uk.xdrivelogistics.driver.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import co.uk.xdrivelogistics.driver.BuildConfig
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch

class SessionStore(context: Context) {
    private object Keys {
        const val accessToken = "access_token"
        const val refreshToken = "refresh_token"
        const val userId = "user_id"
        const val email = "email"
        const val pendingLogoutAccessToken = "pending_logout_access_token"
        const val pendingLogoutRefreshToken = "pending_logout_refresh_token"
        const val pendingLogoutUserId = "pending_logout_user_id"
        const val pendingLogoutEmail = "pending_logout_email"
    }

    private val appContext = context.applicationContext
    private val installationIdentity by lazy { DeviceInstallationIdentity(appContext) }
    private val deviceSessionApi by lazy {
        DeviceSessionApi(
            xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
            installationId = installationIdentity.installationId,
        )
    }
    private val revoker by lazy {
        SupabaseSessionRevoker(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
        )
    }
    private val pushApi by lazy { PushRegistrationApi(BuildConfig.XDRIVE_BASE_URL) }
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

    val session: Flow<DriverSession?> = callbackFlow {
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            trySend(readSession())
        }
        prefs.registerOnSharedPreferenceChangeListener(listener)
        trySend(readSession())

        // A logout attempted while offline is kept only as encrypted pending
        // revocation material, never as an active app session. Retry whenever the
        // app observes the store again.
        launch { retryPendingRevocation() }

        awaitClose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
    }

    fun readSession(): DriverSession? {
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

    suspend fun saveSession(session: DriverSession) {
        // Never let a stale pending logout silently survive a later login. Retry
        // the previous session revocation first; a network failure keeps the
        // encrypted pending record for a future retry without blocking login.
        retryPendingRevocation()

        // A session is not considered persistable until XDrive binds it to this
        // random native installation. The server enforces newest-native-login-wins.
        deviceSessionApi.register(session).getOrThrow()

        prefs.edit()
            .putString(Keys.accessToken, session.accessToken)
            .putString(Keys.refreshToken, session.refreshToken)
            .putString(Keys.userId, session.userId)
            .putString(Keys.email, session.email)
            .commit()
    }

    suspend fun validateDeviceBinding(session: DriverSession): Result<Unit> =
        deviceSessionApi.validate(session)

    suspend fun clear() {
        val current = readSession()
        if (current == null) {
            clearActiveSession()
            return
        }

        // Logout is immediate on-device. Persist revocation material first, then
        // remove the active app session. Server cleanup is retried in the safe
        // order: device binding -> push endpoint -> Supabase Auth session.
        savePendingRevocation(current)
        clearActiveSession()
        retryPendingRevocation()
    }

    private suspend fun retryPendingRevocation() {
        val pending = readPendingRevocation() ?: return

        // Keep the valid credential until the XDrive device registry is disabled;
        // otherwise an offline failure followed by Auth logout would make the
        // device binding impossible to revoke with the user's own session.
        val deviceRevocation = deviceSessionApi.revoke(pending)
        if (deviceRevocation.isFailure && !deviceRevocation.exceptionOrNull().isDeviceSessionRevoked()) {
            return
        }

        unregisterPushBestEffort(pending)
        if (revoker.revoke(pending).isSuccess || deviceRevocation.exceptionOrNull().isDeviceSessionRevoked()) {
            clearPendingRevocation()
        }
    }

    private suspend fun unregisterPushBestEffort(session: DriverSession) {
        pushApi.unregister(session, installationIdentity.installationId)
    }

    private fun readPendingRevocation(): DriverSession? {
        val accessToken = prefs.getString(Keys.pendingLogoutAccessToken, null)
        val refreshToken = prefs.getString(Keys.pendingLogoutRefreshToken, null)
        val userId = prefs.getString(Keys.pendingLogoutUserId, null)
        val email = prefs.getString(Keys.pendingLogoutEmail, null)
        return if (accessToken == null || refreshToken == null || userId == null || email == null) {
            null
        } else {
            DriverSession(accessToken, refreshToken, userId, email)
        }
    }

    private fun savePendingRevocation(session: DriverSession) {
        prefs.edit()
            .putString(Keys.pendingLogoutAccessToken, session.accessToken)
            .putString(Keys.pendingLogoutRefreshToken, session.refreshToken)
            .putString(Keys.pendingLogoutUserId, session.userId)
            .putString(Keys.pendingLogoutEmail, session.email)
            .commit()
    }

    private fun clearActiveSession() {
        prefs.edit()
            .remove(Keys.accessToken)
            .remove(Keys.refreshToken)
            .remove(Keys.userId)
            .remove(Keys.email)
            .commit()
    }

    private fun clearPendingRevocation() {
        prefs.edit()
            .remove(Keys.pendingLogoutAccessToken)
            .remove(Keys.pendingLogoutRefreshToken)
            .remove(Keys.pendingLogoutUserId)
            .remove(Keys.pendingLogoutEmail)
            .commit()
    }
}
