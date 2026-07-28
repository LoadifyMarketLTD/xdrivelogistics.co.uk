package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.SessionStore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class DriverFirebaseMessagingService : FirebaseMessagingService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        if (token.isBlank()) return
        val sessionStore = SessionStore(applicationContext)
        val session = sessionStore.readSession() ?: return
        val api = ApiClient(
            xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
        )

        serviceScope.launch {
            val register = api.registerDeviceToken(
                session = session,
                token = token,
                platform = "android",
                appPackage = "co.uk.xdrivelogistics.driver",
            )
            if (register.isSuccess) return@launch

            val refreshed = api.refreshSession(session).getOrNull() ?: return@launch
            if (sessionStore.readSession()?.accessToken != session.accessToken) return@launch
            sessionStore.saveSession(refreshed)
            api.registerDeviceToken(
                session = refreshed,
                token = token,
                platform = "android",
                appPackage = "co.uk.xdrivelogistics.driver",
            )
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title?.takeIf { it.isNotBlank() }
            ?: message.data["title"]?.takeIf { it.isNotBlank() }
            ?: "XDrive update"
        val body = message.notification?.body?.takeIf { it.isNotBlank() }
            ?: message.data["body"]?.takeIf { it.isNotBlank() }
            ?: "You have a new dispatcher update."

        showDriverPushNotification(
            context = this,
            title = title,
            body = body,
            data = message.data,
        )
    }
}
