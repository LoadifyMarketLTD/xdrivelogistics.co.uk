package co.uk.xdrivelogistics.driver

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

private const val DRIVER_PUSH_CHANNEL_ID = "driver_dispatch_updates"
private const val DRIVER_PUSH_CHANNEL_NAME = "Dispatcher updates"
private const val DRIVER_PUSH_CHANNEL_DESCRIPTION = "Assignment and dispatcher notifications"

/**
 * Resolve a push-notification data payload to a deep-link URI string.
 *
 * Uses [XDriveDeepLink.build] so that the canonical `xdrivedriver://` scheme is always
 * emitted. The `xdrive://` scheme is accepted only as an inbound compatibility alias and
 * must never be produced here for new links.
 *
 * Job-ID validation is delegated to [XDriveDeepLink.isValidJobId] which uses a broad
 * alphanumeric validator on the server-controlled `job_id` payload field. This is
 * intentionally less strict than [XDriveDeepLink.isValidUriJobId] (UUID-v4 only), which
 * is used for job IDs extracted from inbound URI paths to prevent arbitrary string
 * injection via crafted links.
 */
internal fun resolvePushDeepLink(data: Map<String, String>): String =
    XDriveDeepLink.build(resolvePushDestination(data)).toString()

/**
 * Resolve a push-notification data payload to a typed [DeepLinkDestination].
 * Exposed internally so tests can assert on the destination directly without
 * depending on the URI string representation.
 */
internal fun resolvePushDestination(data: Map<String, String>): DeepLinkDestination {
    val rawJobId = data["job_id"]?.trim().orEmpty()
    if (rawJobId.isNotEmpty()) {
        // Accept only well-formed identifiers: letters, digits, hyphens and underscores,
        // max 128 characters, starting with a letter or digit.
        // This covers UUID (8-4-4-4-12 hex) and common opaque job-ID formats while
        // preventing arbitrary user-controlled strings from reaching deep-link URIs.
        return if (XDriveDeepLink.isValidJobId(rawJobId)) {
            DeepLinkDestination.Job(rawJobId)
        } else {
            DeepLinkDestination.Messages
        }
    }
    val route = data["route"]?.trim()?.lowercase().orEmpty()
    return when (route) {
        "messages", "notification" -> DeepLinkDestination.Messages
        "documents" -> DeepLinkDestination.Documents
        "profile" -> DeepLinkDestination.Profile
        "nearby", "loads" -> DeepLinkDestination.Nearby
        else -> DeepLinkDestination.Messages
    }
}

internal fun showDriverPushNotification(
    context: Context,
    title: String,
    body: String,
    data: Map<String, String>,
) {
    ensureDriverPushChannel(context)
    val destination = resolvePushDestination(data)
    val deepLinkUri = XDriveDeepLink.build(destination)
    val intent = Intent(Intent.ACTION_VIEW, deepLinkUri, context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
        context,
        deepLinkUri.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(context, DRIVER_PUSH_CHANNEL_ID)
        .setSmallIcon(android.R.drawable.stat_notify_chat)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(pendingIntent)
        .build()
    if (
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) != PackageManager.PERMISSION_GRANTED
    ) {
        return
    }
    runCatching {
        NotificationManagerCompat.from(context).notify(deepLinkUri.hashCode(), notification)
    }
}

private fun ensureDriverPushChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel = NotificationChannel(
        DRIVER_PUSH_CHANNEL_ID,
        DRIVER_PUSH_CHANNEL_NAME,
        NotificationManager.IMPORTANCE_HIGH,
    ).apply {
        description = DRIVER_PUSH_CHANNEL_DESCRIPTION
    }
    manager.createNotificationChannel(channel)
}
