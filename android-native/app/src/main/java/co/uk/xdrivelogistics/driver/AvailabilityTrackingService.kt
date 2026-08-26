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
import co.uk.xdrivelogistics.driver.data.AvailabilityPresenceApi
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

/**
 * Opt-in pre-award availability publisher.
 *
 * This is intentionally separate from active-job TrackingService. It refreshes
 * only driver_availability_presence and never writes job GPS. The server keeps
 * the original 1/4/8 hour expiry and stops accepting refreshes as soon as the
 * driver is no longer Available, the presence expires, or an active job exists.
 */
class AvailabilityTrackingService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var loopJob: Job? = null

    private val sessionStore by lazy { SessionStore(applicationContext) }
    private val availabilityApi by lazy { AvailabilityPresenceApi(BuildConfig.XDRIVE_BASE_URL) }
    private val authApi by lazy {
        ApiClient(
            xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
        )
    }
    private val locationClient by lazy { LocationServices.getFusedLocationProviderClient(this) }

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            val session = sessionStore.readSession()
            scope.launch {
                if (session != null) availabilityApi.stop(session)
                stopSelf()
            }
            return START_NOT_STICKY
        }
        if (!hasLocationPermission()) {
            stopSelfResult(startId)
            return START_NOT_STICKY
        }
        if (sessionStore.readSession() == null || !startForegroundSafely()) {
            stopSelfResult(startId)
            return START_NOT_STICKY
        }
        if (loopJob?.isActive != true) loopJob = scope.launch { runLoop() }
        return START_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private suspend fun runLoop() {
        // The explicit Start action already published a fresh fix. Subsequent
        // updates are intentionally much less frequent than active-job GPS.
        delay(REFRESH_INTERVAL_MS)
        while (scope.coroutineContext.isActive) {
            if (!hasLocationPermission()) {
                stopWithMessage("Availability stopped", "Location permission is no longer available.")
                return
            }
            val session = sessionStore.readSession()
            if (session == null) {
                stopWithMessage("Availability stopped", "Sign in again to share availability.")
                return
            }
            val location = currentLocation()
            if (location == null) {
                updateNotification("Availability active", "Waiting for a fresh location fix.")
                delay(RETRY_INTERVAL_MS)
                continue
            }

            val first = availabilityApi.refreshLocation(session, location.first, location.second)
            if (first.isSuccess) {
                updateNotification("Availability active", "Your availability location is being refreshed periodically.")
                delay(REFRESH_INTERVAL_MS)
                continue
            }

            val error = first.exceptionOrNull()
            if (error.isAvailabilityEnded()) {
                stopWithMessage("Availability stopped", "Availability expired, changed, or an active job has started.")
                return
            }
            if (!error.isAuthenticationFailure()) {
                updateNotification("Availability active", "Connection unavailable. Location refresh will retry.")
                delay(RETRY_INTERVAL_MS)
                continue
            }

            val refreshed = authApi.refreshSession(session)
            if (refreshed.isFailure) {
                stopWithMessage("Availability stopped", "Your session expired. Sign in again to resume availability.")
                return
            }
            val refreshedSession = refreshed.getOrThrow()
            sessionStore.saveSession(refreshedSession)
            val retried = availabilityApi.refreshLocation(refreshedSession, location.first, location.second)
            if (retried.isSuccess) {
                delay(REFRESH_INTERVAL_MS)
            } else if (retried.exceptionOrNull().isAvailabilityEnded()) {
                stopWithMessage("Availability stopped", "Availability expired, changed, or an active job has started.")
                return
            } else {
                delay(RETRY_INTERVAL_MS)
            }
        }
    }

    private suspend fun currentLocation(): Pair<Double, Double>? = runCatching {
        val token = CancellationTokenSource()
        val location = locationClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, token.token).await()
            ?: return null
        location.latitude to location.longitude
    }.getOrNull()

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun startForegroundSafely(): Boolean = runCatching {
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification("Availability active", "XDrive will refresh your pre-job availability location every 5 minutes."),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
        )
        true
    }.getOrDefault(false)

    private fun notification(title: String, text: String): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, AvailabilityTrackingService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop availability", stopIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun updateNotification(title: String, text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification(title, text))
    }

    private suspend fun stopWithMessage(title: String, text: String) {
        updateNotification(title, text)
        delay(1_500L)
        stopSelf()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Driver availability", NotificationManager.IMPORTANCE_LOW),
        )
    }

    private fun Throwable?.isAvailabilityEnded(): Boolean {
        val value = this?.message.orEmpty().lowercase()
        return "no longer active" in value ||
            "active assigned job" in value ||
            "set your driver status to available" in value
    }

    private fun Throwable?.isAuthenticationFailure(): Boolean {
        val value = this?.message.orEmpty().lowercase()
        return "unauthorized" in value || "jwt" in value || "token" in value || "session" in value
    }

    companion object {
        const val ACTION_STOP = "co.uk.xdrivelogistics.driver.STOP_AVAILABILITY_TRACKING"
        private const val CHANNEL_ID = "xdrive_driver_availability"
        private const val NOTIFICATION_ID = 4602
        private const val REFRESH_INTERVAL_MS = 5 * 60_000L
        private const val RETRY_INTERVAL_MS = 60_000L
    }
}
