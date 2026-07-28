package co.uk.xdrivelogistics.driver

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

private const val DRIVER_PUSH_CHANNEL_ID = "driver_dispatch_updates"
private const val DRIVER_PUSH_CHANNEL_NAME = "Dispatcher updates"
private const val DRIVER_PUSH_CHANNEL_DESCRIPTION = "Assignment and dispatcher notifications"

/**
 * Closed set of valid job-ID characters: letters, digits, hyphens, underscores.
 * Must start with a letter or digit; total length enforced at the call site (≤ 128 chars).
 * Covers UUID (8-4-4-4-12 hex) and common opaque alphanumeric job IDs.
 */
private val VALID_JOB_ID_PATTERN = Regex("^[A-Za-z0-9][A-Za-z0-9_\\-]*$")

internal fun resolvePushDeepLink(data: Map<String, String>): String {
    val rawJobId = data["job_id"]?.trim().orEmpty()
    if (rawJobId.isNotEmpty()) {
        // Accept only well-formed identifiers: letters, digits, hyphens and underscores,
        // max 128 characters, starting with a letter or digit.
        // This covers UUID (8-4-4-4-12 hex) and common opaque job-ID formats while
        // preventing arbitrary user-controlled strings from reaching deep-link URIs.
        return if (rawJobId.length <= 128 && VALID_JOB_ID_PATTERN.matches(rawJobId)) {
            "xdrive://job/$rawJobId"
        } else {
            "xdrive://notification"
        }
    }
    val route = data["route"]?.trim()?.lowercase().orEmpty()
    return when (route) {
        "messages", "notification" -> "xdrive://notification"
        "documents", "profile" -> "xdrive://documents"
        "nearby", "loads" -> "xdrive://nearby"
        else -> "xdrive://notification"
    }
}

internal fun showDriverPushNotification(
    context: Context,
    title: String,
    body: String,
    data: Map<String, String>,
) {
    ensureDriverPushChannel(context)
    val deepLink = resolvePushDeepLink(data)
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink), context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
        context,
        deepLink.hashCode(),
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
        NotificationManagerCompat.from(context).notify(deepLink.hashCode(), notification)
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
