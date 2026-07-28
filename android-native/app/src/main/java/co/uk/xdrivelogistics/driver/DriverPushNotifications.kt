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

internal fun resolvePushDeepLink(data: Map<String, String>): String {
    val explicitJobId = data["job_id"]?.trim().orEmpty()
    if (explicitJobId.isNotBlank()) {
        return "xdrive://job/$explicitJobId"
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
    if (!canPostDriverPushNotifications(context)) return
    runCatching {
        NotificationManagerCompat.from(context).notify(deepLink.hashCode(), notification)
    }
}

private fun canPostDriverPushNotifications(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
    return ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS,
    ) == PackageManager.PERMISSION_GRANTED
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
