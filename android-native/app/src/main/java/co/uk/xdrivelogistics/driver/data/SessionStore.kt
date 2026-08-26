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
    private val loginPreferences by lazy { LoginPreferenceStore(appContext) }
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

    init {
        // Only the first SessionStore created in a process applies the cold-start
        // persistence policy. A user who did not choose Keep me signed in remains
        // authenticated for the current process, but the encrypted active session
        // is discarded the next time Android starts a new app process.
        if (processPersistencePolicyApplied.compareAndSet(false, true) && !loginPreferences.rememberMe) {
            clearActiveSession()
        }
    }

    val session: Flow<DriverSession?> = callbackFlow {
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            trySend(readSession())
        }
        prefs.registerOnSharedPreferenceChangeListener(listener)
        trySend(readSession())

        launch { retryPendingRevocation() }

        // Do not trust a locally persisted session indefinitely. While the app is
        // running, check that this exact installation + auth session remains the
        // active native device. Network failures preserve offline usability; an
        // explicit 401/403 device-revocation result removes the stale session.
        launch {
            while (isActive) {
                delay(30_000L)
                val current = readSession() ?: continue
                val validation = validateDeviceBinding(current)
                if (validation.isFailure && validation.exceptionOrNull().isDeviceSessionRevoked()) {
                    clearActiveSession()
                    openLoginActivity()
                }
            }
        }

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
        retryPendingRevocation()
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

    suspend fun clear(redirectToLogin: Boolean = true) {
        val current = readSession()
        if (current == null) {
            clearActiveSession()
            if (redirectToLogin) openLoginActivity()
            return
        }

        savePendingRevocation(current)
        clearActiveSession()
        retryPendingRevocation()
        if (redirectToLogin) openLoginActivity()
    }

    private suspend fun retryPendingRevocation() {
        val pending = readPendingRevocation() ?: return

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

    private fun openLoginActivity() {
        runCatching {
            appContext.startActivity(
                Intent(appContext, LoginActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                },
            )
        }
    }

    private companion object {
        val processPersistencePolicyApplied = AtomicBoolean(false)
    }
}
