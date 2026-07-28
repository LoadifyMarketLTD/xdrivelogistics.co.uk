package co.uk.xdrivelogistics.driver

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class DriverFirebaseMessagingService : FirebaseMessagingService() {

    /**
     * Called by the Firebase SDK when the registration token is created or rotated.
     *
     * This method may be invoked in a background process that was started directly for this
     * service, before [MainActivity] runs, so [ensureFirebaseAppInitialized] is called here
     * as a safety net (though [DriverApplication.onCreate] will already have run first in
     * every process). The new token is persisted to [DeviceTokenCoordinator] only;
     * no direct API call is made. [DriverViewModel] picks up the pending record and performs
     * the authenticated server registration under the correct owner/session/generation guards,
     * preventing stale A→B cross-session mutations from reaching the server.
     */
    override fun onNewToken(token: String) {
        if (token.isBlank()) return
        ensureFirebaseAppInitialized(applicationContext)
        DeviceTokenCoordinator(applicationContext).writePendingToken(token)
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
