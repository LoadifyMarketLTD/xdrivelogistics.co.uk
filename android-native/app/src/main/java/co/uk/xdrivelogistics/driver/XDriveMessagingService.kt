package co.uk.xdrivelogistics.driver

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import co.uk.xdrivelogistics.driver.data.SessionStore
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlin.math.abs

class XDriveMessagingService : FirebaseMessagingService() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        scope.launch {
            val session = runCatching { SessionStore(applicationContext).readSession() }.getOrNull() ?: return@launch
            PushRegistrationManager(applicationContext).registerToken(session, token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val data = message.data
        val title = message.notification?.title ?: data["title"] ?: "XDrive Driver"
        val body = message.notification?.body ?: data["body"] ?: "Open XDrive for details."
        val jobId = data["job_id"]?.takeIf { it.isNotBlank() }
        showNotification(title, body, jobId)
    }

    private fun showNotification(title: String, body: String, jobId: String?) {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ASSIGNMENTS,
                    "Driver jobs and alerts",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Assigned jobs and operational XDrive alerts"
                },
            )
        }

        val intent = if (jobId != null) {
            Intent(applicationContext, JobDeepLinkActivity::class.java).apply {
                action = JobDeepLinkActivity.ACTION_OPEN_JOB
                data = Uri.parse("xdrive://job/$jobId")
                putExtra(JobDeepLinkActivity.EXTRA_JOB_ID, jobId)
            }
        } else {
            Intent(Intent.ACTION_VIEW, Uri.parse("xdrive://notification"), applicationContext, MainActivity::class.java)
        }.apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val pendingIntent = PendingIntent.getActivity(
            applicationContext,
            abs((jobId ?: title).hashCode()),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ASSIGNMENTS)
            .setSmallIcon(android.R.drawable.stat_notify_more)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        manager.notify(abs((jobId ?: "$title:$body").hashCode()), notification)
    }

    private companion object {
        const val CHANNEL_ASSIGNMENTS = "xdrive_driver_assignments"
    }
}
