package co.uk.xdrivelogistics.driver

import android.content.Context
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.PushRegistrationApi
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await
import java.util.UUID

class PushRegistrationManager(context: Context) {
    private val appContext = context.applicationContext
    private val api = PushRegistrationApi(BuildConfig.XDRIVE_BASE_URL)
    private val prefs = appContext.getSharedPreferences("xdrive_push_installation", Context.MODE_PRIVATE)

    val installationId: String by lazy {
        prefs.getString(KEY_INSTALLATION_ID, null)
            ?.takeIf { runCatching { UUID.fromString(it) }.isSuccess }
            ?: UUID.randomUUID().toString().also {
                prefs.edit().putString(KEY_INSTALLATION_ID, it).apply()
            }
    }

    fun isConfigured(): Boolean = listOf(
        BuildConfig.FIREBASE_PROJECT_ID,
        BuildConfig.FIREBASE_APPLICATION_ID,
        BuildConfig.FIREBASE_API_KEY,
        BuildConfig.FIREBASE_SENDER_ID,
    ).all { it.isNotBlank() }

    fun initializeFirebase(): Boolean {
        if (!isConfigured()) return false
        if (FirebaseApp.getApps(appContext).isNotEmpty()) return true

        val options = FirebaseOptions.Builder()
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            .setApplicationId(BuildConfig.FIREBASE_APPLICATION_ID)
            .setApiKey(BuildConfig.FIREBASE_API_KEY)
            .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
            .build()
        return FirebaseApp.initializeApp(appContext, options) != null
    }

    suspend fun ensureRegistered(session: DriverSession): Result<Unit> {
        if (!initializeFirebase()) return Result.failure(IllegalStateException("Firebase push is not configured."))
        return runCatching {
            val token = FirebaseMessaging.getInstance().token.await()
            require(token.isNotBlank()) { "Firebase returned an empty messaging token." }
            api.register(session, installationId, token).getOrThrow()
        }
    }

    suspend fun registerToken(session: DriverSession, token: String): Result<Unit> {
        if (token.isBlank()) return Result.failure(IllegalArgumentException("Push token is empty."))
        return api.register(session, installationId, token)
    }

    suspend fun unregister(session: DriverSession): Result<Unit> = api.unregister(session, installationId)

    private companion object {
        const val KEY_INSTALLATION_ID = "installation_id"
    }
}
