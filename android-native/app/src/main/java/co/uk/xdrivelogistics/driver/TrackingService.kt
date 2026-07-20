package co.uk.xdrivelogistics.driver

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.SessionStore
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
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
    private val fusedClient by lazy { LocationServices.getFusedLocationProviderClient(this) }
    private val pendingStore by lazy { getSharedPreferences(PENDING_STORE, MODE_PRIVATE) }

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (!hasLocationPermission()) {
            startForeground(NOTIFICATION_ID, notification(
                title = "XDrive tracking not started",
                text = "Location permission is required. Open the app and enable tracking again.",
                ongoing = false,
            ))
            stopSelfResult(startId)
            return START_NOT_STICKY
        }

        startForeground(
            NOTIFICATION_ID,
            notification(
                title = "XDrive tracking starting",
                text = "Checking your session and preparing the first location update.",
                ongoing = true,
            )
        )

        if (trackingJob?.isActive != true) {
            trackingJob = scope.launch { runTrackingLoop() }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        trackingJob?.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private suspend fun runTrackingLoop() {
        while (scope.coroutineContext.isActive) {
            if (!hasLocationPermission()) {
                updateNotification(
                    "XDrive tracking stopped",
                    "Location permission was removed. Open the app to restart tracking.",
                    ongoing = false,
                )
                stopSelf()
                return
            }

            val session = sessionStore.readSession()
            if (session == null) {
                updateNotification(
                    "XDrive tracking stopped",
                    "Sign in to the driver app before sharing location.",
                    ongoing = false,
                )
                stopSelf()
                return
            }

            val pendingLat = pendingStore.takeIf { it.contains(KEY_PENDING_LAT) }?.getString(KEY_PENDING_LAT, null)?.toDoubleOrNull()
            val pendingLng = pendingStore.takeIf { it.contains(KEY_PENDING_LNG) }?.getString(KEY_PENDING_LNG, null)?.toDoubleOrNull()
            if (pendingLat != null && pendingLng != null) {
                val pendingResult = api.sendLocation(session.accessToken, pendingLat, pendingLng)
                if (pendingResult.isSuccess) {
                    clearPendingLocation()
                    showSharedNotification()
                } else {
                    updateNotification(
                        "XDrive tracking waiting for connection",
                        "The last location is saved and will retry automatically.",
                        ongoing = true,
                    )
                    delay(RETRY_INTERVAL_MS)
                    continue
                }
            }

            val locationResult = runCatching {
                fusedClient.getCurrentLocation(
                    Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                    null,
                ).await()
            }

            val location = locationResult.getOrNull()
            if (location == null) {
                updateNotification(
                    "XDrive tracking waiting for GPS",
                    "No current position is available yet. Tracking will retry automatically.",
                    ongoing = true,
                )
                delay(RETRY_INTERVAL_MS)
                continue
            }

            val uploadResult = api.sendLocation(session.accessToken, location.latitude, location.longitude)
            if (uploadResult.isSuccess) {
                clearPendingLocation()
                showSharedNotification()
                delay(TRACKING_INTERVAL_MS)
            } else {
                savePendingLocation(location.latitude, location.longitude)
                updateNotification(
                    "XDrive tracking waiting for connection",
                    "The current location is saved and will retry automatically.",
                    ongoing = true,
                )
                delay(RETRY_INTERVAL_MS)
            }
        }
    }

    private fun savePendingLocation(lat: Double, lng: Double) {
        pendingStore.edit()
            .putString(KEY_PENDING_LAT, lat.toString())
            .putString(KEY_PENDING_LNG, lng.toString())
            .putLong(KEY_PENDING_AT, System.currentTimeMillis())
            .apply()
    }

    private fun clearPendingLocation() {
        pendingStore.edit()
            .remove(KEY_PENDING_LAT)
            .remove(KEY_PENDING_LNG)
            .remove(KEY_PENDING_AT)
            .apply()
    }

    private fun showSharedNotification() {
        val time = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
        updateNotification(
            "XDrive tracking active",
            "Last location shared successfully at $time.",
            ongoing = true,
        )
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun notification(title: String, text: String, ongoing: Boolean): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(ongoing)
            .setOnlyAlertOnce(true)
            .build()

    private fun updateNotification(title: String, text: String, ongoing: Boolean) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, notification(title, text, ongoing))
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Driver tracking",
            NotificationManager.IMPORTANCE_LOW,
        )
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val ACTION_STOP = "co.uk.xdrivelogistics.driver.STOP_TRACKING"
        private const val CHANNEL_ID = "xdrive_driver_tracking"
        private const val NOTIFICATION_ID = 4601
        private const val TRACKING_INTERVAL_MS = 60_000L
        private const val RETRY_INTERVAL_MS = 15_000L
        private const val PENDING_STORE = "xdrive_tracking_pending"
        private const val KEY_PENDING_LAT = "pending_lat"
        private const val KEY_PENDING_LNG = "pending_lng"
        private const val KEY_PENDING_AT = "pending_at"
    }
}
