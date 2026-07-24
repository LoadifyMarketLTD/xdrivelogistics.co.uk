package co.uk.xdrivelogistics.driver

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.SessionStore
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

class TrackingService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var trackingJob: Job? = null

    private val api by lazy {
        ApiClient(
            xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
        )
    }
    private val sessionStore by lazy { SessionStore(applicationContext) }
    private val pendingStore by lazy { PendingLocationStore(applicationContext) }
    private val fusedClient by lazy { LocationServices.getFusedLocationProviderClient(this) }

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            pendingStore.clear()
            stopSelf()
            return START_NOT_STICKY
        }

        if (!hasLocationPermission()) {
            stopSelfResult(startId)
            return START_NOT_STICKY
        }

        val session = runCatching { sessionStore.readSession() }.getOrNull()
        if (session == null || !startForegroundSafely()) {
            stopSelfResult(startId)
            return START_NOT_STICKY
        }

        if (trackingJob?.isActive != true) {
            trackingJob = scope.launch { runTrackingLoop() }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startForegroundSafely(): Boolean = runCatching {
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification(
                title = "XDrive tracking active",
                text = "Preparing the first secure location update.",
                ongoing = true,
            ),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
        )
        true
    }.getOrDefault(false)

    private suspend fun runTrackingLoop() {
        while (scope.coroutineContext.isActive) {
            if (!hasLocationPermission()) {
                stopWithMessage(
                    "XDrive tracking stopped",
                    "Location permission was removed. Open the app to restart tracking.",
                )
                return
            }

            val session = runCatching { sessionStore.readSession() }.getOrNull()
            if (session == null) {
                stopWithMessage(
                    "XDrive tracking stopped",
                    "Sign in to the driver app before sharing location.",
                )
                return
            }

            captureCurrentLocation()?.let { current ->
                pendingStore.save(current)
            }

            val pending = pendingStore.read()
            if (pending == null) {
                updateNotification(
                    "XDrive tracking waiting for GPS",
                    "No current position is available yet. Tracking will retry automatically.",
                    ongoing = true,
                )
                delay(RETRY_INTERVAL_MS)
                continue
            }

            if (!pending.isFresh()) {
                pendingStore.clear()
                updateNotification(
                    "XDrive tracking waiting for GPS",
                    "The saved position expired. Waiting for a fresh GPS fix.",
                    ongoing = true,
                )
                delay(RETRY_INTERVAL_MS)
                continue
            }

            when (uploadPending(session, pending)) {
                UploadOutcome.SUCCESS -> {
                    pendingStore.clear()
                    showSharedNotification()
                    delay(TRACKING_INTERVAL_MS)
                }
                UploadOutcome.RETRY -> {
                    updateNotification(
                        "XDrive tracking waiting for connection",
                        "The latest location is encrypted on this device and will retry automatically.",
                        ongoing = true,
                    )
                    delay(RETRY_INTERVAL_MS)
                }
                UploadOutcome.AUTH_REQUIRED -> {
                    stopWithMessage(
                        "XDrive tracking stopped",
                        "Your session expired. Sign in again to resume tracking.",
                    )
                    return
                }
            }
        }
    }

    private suspend fun captureCurrentLocation(): PendingLocation? = runCatching {
        val tokenSource = CancellationTokenSource()
        val location = fusedClient.getCurrentLocation(
            Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            tokenSource.token,
        ).await() ?: return null
        PendingLocation(
            latitude = location.latitude,
            longitude = location.longitude,
            capturedAtEpochMs = System.currentTimeMillis(),
        )
    }.getOrNull()

    private suspend fun uploadPending(
        session: DriverSession,
        pending: PendingLocation,
    ): UploadOutcome {
        val first = api.sendLocation(session.accessToken, pending.latitude, pending.longitude)
        if (first.isSuccess) return UploadOutcome.SUCCESS

        val firstError = first.exceptionOrNull()
        if (firstError?.isAuthenticationFailure() != true) return UploadOutcome.RETRY

        val refreshed = api.refreshSession(session)
        if (refreshed.isFailure) {
            return if (refreshed.exceptionOrNull()?.isAuthenticationFailure() == true) {
                UploadOutcome.AUTH_REQUIRED
            } else {
                UploadOutcome.RETRY
            }
        }

        val refreshedSession = refreshed.getOrThrow()
        sessionStore.saveSession(refreshedSession)
        val retried = api.sendLocation(
            refreshedSession.accessToken,
            pending.latitude,
            pending.longitude,
        )
        return when {
            retried.isSuccess -> UploadOutcome.SUCCESS
            retried.exceptionOrNull()?.isAuthenticationFailure() == true -> UploadOutcome.AUTH_REQUIRED
            else -> UploadOutcome.RETRY
        }
    }

    private suspend fun stopWithMessage(title: String, text: String) {
        updateNotification(title, text, ongoing = false)
        delay(STOP_MESSAGE_DELAY_MS)
        stopSelf()
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun notification(title: String, text: String, ongoing: Boolean): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, TrackingService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopIntent)
            .setOngoing(ongoing)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun updateNotification(title: String, text: String, ongoing: Boolean) {
        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID, notification(title, text, ongoing))
    }

    private fun showSharedNotification() {
        val time = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
        updateNotification(
            "XDrive tracking active",
            "Last location shared successfully at $time.",
            ongoing = true,
        )
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Driver tracking",
                NotificationManager.IMPORTANCE_LOW,
            ),
        )
    }

    companion object {
        const val ACTION_STOP = "co.uk.xdrivelogistics.driver.STOP_TRACKING"
        private const val CHANNEL_ID = "xdrive_driver_tracking"
        private const val NOTIFICATION_ID = 4601
        private const val TRACKING_INTERVAL_MS = 60_000L
        private const val RETRY_INTERVAL_MS = 15_000L
        private const val STOP_MESSAGE_DELAY_MS = 1_500L
    }
}
