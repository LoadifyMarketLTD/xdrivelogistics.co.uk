package co.uk.xdrivelogistics.driver.data

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import co.uk.xdrivelogistics.driver.BuildConfig
import co.uk.xdrivelogistics.driver.LoginActivity
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

class SessionStore(context: Context) {
    private object Keys {
        const val accessToken = "access_token"; const val refreshToken = "refresh_token"; const val userId = "user_id"; const val email = "email"
        const val pendingLogoutAccessToken = "pending_logout_access_token"; const val pendingLogoutRefreshToken = "pending_logout_refresh_token"
        const val pendingLogoutUserId = "pending_logout_user_id"; const val pendingLogoutEmail = "pending_logout_email"
    }

    private val appContext = context.applicationContext
    private val loginPreferences by lazy { LoginPreferenceStore(appContext) }
    private val installationIdentity by lazy { DeviceInstallationIdentity(appContext) }
    private val deviceSessionApi by lazy { DeviceSessionApi(BuildConfig.XDRIVE_BASE_URL, installationIdentity.installationId) }
    private val authApi by lazy { ApiClient(BuildConfig.XDRIVE_BASE_URL, BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY) }
    private val revoker by lazy { SupabaseSessionRevoker(BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY) }
    private val pushApi by lazy { PushRegistrationApi(BuildConfig.XDRIVE_BASE_URL) }
    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(appContext).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        EncryptedSharedPreferences.create(appContext, "xdrive_secure_session", masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
    }

    init {
        if (processPersistencePolicyApplied.compareAndSet(false, true) && !loginPreferences.rememberMe) clearActiveSession()
    }

    val session: Flow<DriverSession?> = callbackFlow {
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ -> trySend(readSession()) }
        prefs.registerOnSharedPreferenceChangeListener(listener)
        trySend(readSession())
        launch { retryPendingRevocation() }
        launch {
            while (isActive) {
                delay(30_000L)
                val current = readSession() ?: continue
                val validation = validateDeviceBinding(current)
                if (validation.isSuccess) continue
                val error = validation.exceptionOrNull()
                if (error.isDeviceSessionRevoked()) {
                    clearActiveSession(); openLoginActivity(); continue
                }
                if (!error.isAuthFailure()) continue

                val refreshed = authApi.refreshSession(current)
                if (refreshed.isFailure) continue
                val freshSession = refreshed.getOrThrow()
                val saved = runCatching { saveSession(freshSession) }
                if (saved.exceptionOrNull().isDeviceSessionRevoked()) {
                    clearActiveSession(); openLoginActivity()
                }
            }
        }
        awaitClose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
    }

    fun readSession(): DriverSession? {
        val accessToken = prefs.getString(Keys.accessToken, null); val refreshToken = prefs.getString(Keys.refreshToken, null)
        val userId = prefs.getString(Keys.userId, null); val email = prefs.getString(Keys.email, null)
        return if (accessToken == null || refreshToken == null || userId == null || email == null) null else DriverSession(accessToken, refreshToken, userId, email)
    }

    suspend fun saveSession(session: DriverSession) {
        retryPendingRevocation()
        deviceSessionApi.register(session).getOrThrow()
        prefs.edit().putString(Keys.accessToken, session.accessToken).putString(Keys.refreshToken, session.refreshToken)
            .putString(Keys.userId, session.userId).putString(Keys.email, session.email).commit()
    }

    suspend fun validateDeviceBinding(session: DriverSession): Result<Unit> = deviceSessionApi.validate(session)

    suspend fun clear(redirectToLogin: Boolean = true) {
        val current = readSession()
        if (current == null) {
            clearActiveSession(); if (redirectToLogin) openLoginActivity(); return
        }
        savePendingRevocation(current)
        clearActiveSession()
        retryPendingRevocation()
        if (redirectToLogin) openLoginActivity()
    }

    private suspend fun retryPendingRevocation() {
        var pending = readPendingRevocation() ?: return
        var deviceRevocation = deviceSessionApi.revoke(pending)

        if (deviceRevocation.isFailure && !deviceRevocation.exceptionOrNull().isDeviceSessionRevoked() && deviceRevocation.exceptionOrNull().isAuthFailure()) {
            val refreshed = authApi.refreshSession(pending)
            if (refreshed.isSuccess) {
                pending = refreshed.getOrThrow()
                savePendingRevocation(pending)
                deviceRevocation = deviceSessionApi.revoke(pending)
            }
        }

        if (deviceRevocation.isFailure && !deviceRevocation.exceptionOrNull().isDeviceSessionRevoked()) {
            // SupabaseSessionRevoker performs its own refresh/terminal-session check.
            // If it proves the Auth session is gone, no stale JWT can be refreshed;
            // a later real login can atomically replace any historical registry row.
            if (revoker.revoke(pending).isSuccess) clearPendingRevocation()
            return
        }

        unregisterPushBestEffort(pending)
        if (revoker.revoke(pending).isSuccess || deviceRevocation.exceptionOrNull().isDeviceSessionRevoked()) clearPendingRevocation()
    }

    private suspend fun unregisterPushBestEffort(session: DriverSession) { pushApi.unregister(session, installationIdentity.installationId) }

    private fun readPendingRevocation(): DriverSession? {
        val accessToken = prefs.getString(Keys.pendingLogoutAccessToken, null); val refreshToken = prefs.getString(Keys.pendingLogoutRefreshToken, null)
        val userId = prefs.getString(Keys.pendingLogoutUserId, null); val email = prefs.getString(Keys.pendingLogoutEmail, null)
        return if (accessToken == null || refreshToken == null || userId == null || email == null) null else DriverSession(accessToken, refreshToken, userId, email)
    }

    private fun savePendingRevocation(session: DriverSession) {
        prefs.edit().putString(Keys.pendingLogoutAccessToken, session.accessToken).putString(Keys.pendingLogoutRefreshToken, session.refreshToken)
            .putString(Keys.pendingLogoutUserId, session.userId).putString(Keys.pendingLogoutEmail, session.email).commit()
    }
    private fun clearActiveSession() { prefs.edit().remove(Keys.accessToken).remove(Keys.refreshToken).remove(Keys.userId).remove(Keys.email).commit() }
    private fun clearPendingRevocation() { prefs.edit().remove(Keys.pendingLogoutAccessToken).remove(Keys.pendingLogoutRefreshToken).remove(Keys.pendingLogoutUserId).remove(Keys.pendingLogoutEmail).commit() }
    private fun openLoginActivity() { runCatching { appContext.startActivity(Intent(appContext, LoginActivity::class.java).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK) }) } }

    private fun Throwable?.isAuthFailure(): Boolean {
        if (this.isDeviceSessionRevoked()) return false
        val text = this?.message.orEmpty().lowercase()
        return "http 401" in text || "unauthorized" in text || "jwt" in text || "token" in text || "session expired" in text || "authentication" in text
    }

    private companion object { val processPersistencePolicyApplied = AtomicBoolean(false) }
}
