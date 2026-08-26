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
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.SessionStore
import co.uk.xdrivelogistics.driver.data.TrackingState
import co.uk.xdrivelogistics.driver.data.TrackingStateApi
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

/**
 * Single foreground location runtime for the native driver app.
 *
 * The runtime keeps privacy/data contracts separate while avoiding an Android
 * background-start gap between pre-job availability and an allocated job:
 * - JOB mode publishes only to /api/driver/location every 60 seconds.
 * - AVAILABILITY mode publishes only to /api/driver/availability-presence every 5 minutes.
 * - server-authoritative state is reconciled every 30 seconds, so an already
 *   running foreground service can switch modes without creating a new location
 *   foreground service from the background.
 */
class TrackingService : Service() {
    private enum class RuntimeMode { CHECKING, JOB, AVAILABILITY }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var trackingJob: Job? = null
    private var mode = RuntimeMode.CHECKING
    private var intentionalStop = false
    private var lastJobPublishAt = 0L
    private var lastAvailabilityPublishAt = 0L

    private val api by lazy {
        ApiClient(
            xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
        )
    }
    private val trackingStateApi by lazy { TrackingStateApi(BuildConfig.XDRIVE_BASE_URL) }
    private val availabilityApi by lazy { AvailabilityPresenceApi(BuildConfig.XDRIVE_BASE_URL) }
    private val sessionStore by lazy { SessionStore(applicationContext) }
    private val pendingStore by lazy { PendingLocationStore(applicationContext) }
    private val fusedClient by lazy { LocationServices.getFusedLocationProviderClient(this) }

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_AVAILABILITY) {
            scope.launch { stopAvailabilityIfNoActiveJob() }
            return START_STICKY
        }

        // Legacy/manual Stop must never disable mandatory active-job tracking.
        // The asynchronous server check decides whether stopping is permitted.
        if (intent?.action == ACTION_STOP) {
            scope.launch { stopIfNoActiveJob() }
            return START_STICKY
        }

        if (!hasLocationPermission()) {
            intentionalStop = true
            stopSelfResult(startId)
            return START_NOT_STICKY
        }

        val session = runCatching { sessionStore.readSession() }.getOrNull()
        if (session == null || !startForegroundSafely()) {
            intentionalStop = true
            stopSelfResult(startId)
            return START_NOT_STICKY
        }

        if (trackingJob?.isActive != true) {
            trackingJob = scope.launch { runRuntimeLoop() }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        val recoverFromExternalStop = !intentionalStop &&
            XDriveDriverApp.isAppVisible &&
            hasLocationPermission() &&
            runCatching { sessionStore.readSession() }.getOrNull() != null
        scope.cancel()
        super.onDestroy()

        // MainActivity historically calls stopService() directly. While the app
        // is visible, immediately reconcile rather than allowing that legacy UI
        // action to create a gap during a mandatory active job.
        if (recoverFromExternalStop) {
            runCatching {
                ContextCompat.startForegroundService(
                    applicationContext,
                    Intent(applicationContext, TrackingService::class.java),
                )
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startForegroundSafely(): Boolean = runCatching {
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            notification(
                title = "XDrive location service",
                text = "Checking current driver work state.",
                ongoing = true,
                allowStop = false,
            ),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
        )
        true
    }.getOrDefault(false)

    private suspend fun runRuntimeLoop() {
        while (scope.coroutineContext.isActive) {
            if (!hasLocationPermission()) {
                intentionalStop = true
                stopWithMessage(
                    "XDrive location stopped",
                    "Location permission was removed. Open the app to restore location access.",
                )
                return
            }

            var session = runCatching { sessionStore.readSession() }.getOrNull()
            if (session == null) {
                intentionalStop = true
                stopWithMessage("XDrive location stopped", "Sign in to the driver app to continue.")
                return
            }

            val trackingResolution = resolveTrackingState(session)
            if (trackingResolution == null) {
                updateNotificationForCurrentMode("Connection unavailable. Work state will retry.")
                delay(STATE_RETRY_INTERVAL_MS)
                continue
            }
            session = trackingResolution.first
            val trackingState = trackingResolution.second

            if (trackingState.shouldTrack) {
                runJobMode(session)
                delay(RECONCILE_INTERVAL_MS)
                continue
            }

            val availabilityResult = availabilityApi.load(session)
            if (availabilityResult.isFailure) {
                updateNotificationForCurrentMode("Availability state could not be verified. Retrying safely.")
                delay(STATE_RETRY_INTERVAL_MS)
                continue
            }

            val availability = availabilityResult.getOrThrow()
            if (!availability.active) {
                mode = RuntimeMode.CHECKING
                pendingStore.clear()
                intentionalStop = true
                stopSelf()
                return
            }

            runAvailabilityMode(session)
            delay(RECONCILE_INTERVAL_MS)
        }
    }

    private suspend fun runJobMode(session: DriverSession) {
        if (mode != RuntimeMode.JOB) {
            mode = RuntimeMode.JOB
            lastJobPublishAt = 0L
            pendingStore.clear()
            updateNotification(
                "XDrive job tracking active",
                "Allocated job detected. Secure live tracking is active.",
                ongoing = true,
                allowStop = false,
            )
        }

        val now = System.currentTimeMillis()
        if (lastJobPublishAt != 0L && now - lastJobPublishAt < JOB_PUBLISH_INTERVAL_MS) return

        captureCurrentLocation()?.let { current -> pendingStore.save(current) }
        val pending = pendingStore.read()
        if (pending == null) {
            updateNotification(
                "XDrive job tracking waiting for GPS",
                "No current position is available yet. Tracking will retry automatically.",
                ongoing = true,
                allowStop = false,
            )
            return
        }
        if (!pending.isFresh()) {
            pendingStore.clear()
            return
        }

        when (uploadJobLocation(session, pending)) {
            UploadOutcome.SUCCESS -> {
                pendingStore.clear()
                lastJobPublishAt = System.currentTimeMillis()
                showJobSharedNotification()
            }
            UploadOutcome.RETRY -> updateNotification(
                "XDrive job tracking waiting for connection",
                "The latest job location is encrypted on this device and will retry.",
                ongoing = true,
                allowStop = false,
            )
            UploadOutcome.AUTH_REQUIRED -> {
                intentionalStop = true
                stopWithMessage("XDrive tracking stopped", "Your session expired. Sign in again to resume tracking.")
            }
            UploadOutcome.JOB_NOT_ACTIVE -> {
                pendingStore.clear()
                lastJobPublishAt = 0L
                mode = RuntimeMode.CHECKING
            }
        }
    }

    private suspend fun runAvailabilityMode(session: DriverSession) {
        if (mode != RuntimeMode.AVAILABILITY) {
            mode = RuntimeMode.AVAILABILITY
            lastAvailabilityPublishAt = 0L
            pendingStore.clear()
            updateNotification(
                "XDrive availability active",
                "Pre-job availability is active. Location refreshes every 5 minutes.",
                ongoing = true,
                allowStop = true,
            )
        }

        val now = System.currentTimeMillis()
        if (lastAvailabilityPublishAt != 0L && now - lastAvailabilityPublishAt < AVAILABILITY_PUBLISH_INTERVAL_MS) return

        val location = captureCurrentLocation() ?: return
        val result = availabilityApi.refreshLocation(session, location.latitude, location.longitude)
        if (result.isSuccess) {
            lastAvailabilityPublishAt = System.currentTimeMillis()
            val time = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
            updateNotification(
                "XDrive availability active",
                "Availability location refreshed at $time.",
                ongoing = true,
                allowStop = true,
            )
            return
        }

        if (result.exceptionOrNull().isAvailabilityEnded()) {
            mode = RuntimeMode.CHECKING
            lastAvailabilityPublishAt = 0L
        } else {
            updateNotification(
                "XDrive availability waiting for connection",
                "Availability remains enabled and will retry safely.",
                ongoing = true,
                allowStop = true,
            )
        }
    }

    private suspend fun resolveTrackingState(session: DriverSession): Pair<DriverSession, TrackingState>? {
        val first = trackingStateApi.load(session.accessToken)
        if (first.isSuccess) return session to first.getOrThrow()
        if (!first.exceptionOrNull().isAuthenticationFailure()) return null

        val refreshed = api.refreshSession(session)
        if (refreshed.isFailure) return null
        val refreshedSession = refreshed.getOrThrow()
        sessionStore.saveSession(refreshedSession)
        return trackingStateApi.load(refreshedSession.accessToken).getOrNull()?.let { refreshedSession to it }
    }

    private suspend fun stopAvailabilityIfNoActiveJob() {
        val session = runCatching { sessionStore.readSession() }.getOrNull()
        if (session == null) {
            intentionalStop = true
            stopSelf()
            return
        }
        val state = resolveTrackingState(session)?.second
        if (state?.shouldTrack == true) {
            mode = RuntimeMode.JOB
            updateNotification(
                "XDrive job tracking required",
                "Availability controls cannot stop tracking for an active allocated job.",
                ongoing = true,
                allowStop = false,
            )
            return
        }
        availabilityApi.stop(session)
        intentionalStop = true
        pendingStore.clear()
        stopSelf()
    }

    private suspend fun stopIfNoActiveJob() {
        val session = runCatching { sessionStore.readSession() }.getOrNull()
        if (session == null) {
            intentionalStop = true
            stopSelf()
            return
        }
        val state = resolveTrackingState(session)?.second
        if (state?.shouldTrack == true) {
            mode = RuntimeMode.JOB
            updateNotification(
                "XDrive job tracking required",
                "Live tracking remains active while this job is allocated to you.",
                ongoing = true,
                allowStop = false,
            )
            return
        }
        intentionalStop = true
        pendingStore.clear()
        stopSelf()
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

    private suspend fun uploadJobLocation(session: DriverSession, pending: PendingLocation): UploadOutcome {
        val first = api.sendLocation(session.accessToken, pending.latitude, pending.longitude)
        if (first.isSuccess) return UploadOutcome.SUCCESS

        val firstError = first.exceptionOrNull()
        if (firstError.isInactiveJobFailure()) return UploadOutcome.JOB_NOT_ACTIVE
        if (!firstError.isAuthenticationFailure()) return UploadOutcome.RETRY

        val refreshed = api.refreshSession(session)
        if (refreshed.isFailure) {
            return if (refreshed.exceptionOrNull().isAuthenticationFailure()) UploadOutcome.AUTH_REQUIRED else UploadOutcome.RETRY
        }

        val refreshedSession = refreshed.getOrThrow()
        sessionStore.saveSession(refreshedSession)
        val retried = api.sendLocation(refreshedSession.accessToken, pending.latitude, pending.longitude)
        return when {
            retried.isSuccess -> UploadOutcome.SUCCESS
            retried.exceptionOrNull().isInactiveJobFailure() -> UploadOutcome.JOB_NOT_ACTIVE
            retried.exceptionOrNull().isAuthenticationFailure() -> UploadOutcome.AUTH_REQUIRED
            else -> UploadOutcome.RETRY
        }
    }

    private fun Throwable?.isInactiveJobFailure(): Boolean {
        val text = this?.message?.lowercase().orEmpty()
        return text.contains("single active job") ||
            text.contains("not authorised for this job state") ||
            text.contains("delivery is no longer")
    }

    private fun Throwable?.isAvailabilityEnded(): Boolean {
        val text = this?.message?.lowercase().orEmpty()
        return text.contains("no longer active") ||
            text.contains("active assigned job") ||
            text.contains("set your driver status to available")
    }

    private fun Throwable?.isAuthenticationFailure(): Boolean {
        val text = this?.message?.lowercase().orEmpty()
        return text.contains("unauthorized") || text.contains("jwt") || text.contains("token") || text.contains("session")
    }

    private suspend fun stopWithMessage(title: String, text: String) {
        updateNotification(title, text, ongoing = false, allowStop = false)
        delay(STOP_MESSAGE_DELAY_MS)
        intentionalStop = true
        stopSelf()
    }

    private fun hasLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    private fun notification(title: String, text: String, ongoing: Boolean, allowStop: Boolean): Notification {
        val openIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(openIntent)
            .setOngoing(ongoing)
            .setOnlyAlertOnce(true)

        if (allowStop) {
            val stopIntent = PendingIntent.getService(
                this,
                1,
                Intent(this, TrackingService::class.java).setAction(ACTION_STOP_AVAILABILITY),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop availability", stopIntent)
        }
        return builder.build()
    }

    private fun updateNotification(title: String, text: String, ongoing: Boolean, allowStop: Boolean) {
        getSystemService(NotificationManager::class.java).notify(
            NOTIFICATION_ID,
            notification(title, text, ongoing, allowStop),
        )
    }

    private fun updateNotificationForCurrentMode(text: String) {
        when (mode) {
            RuntimeMode.JOB -> updateNotification("XDrive job tracking active", text, ongoing = true, allowStop = false)
            RuntimeMode.AVAILABILITY -> updateNotification("XDrive availability active", text, ongoing = true, allowStop = true)
            RuntimeMode.CHECKING -> updateNotification("XDrive location service", text, ongoing = true, allowStop = false)
        }
    }

    private fun showJobSharedNotification() {
        val time = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
        updateNotification(
            "XDrive job tracking active",
            "Last job location shared successfully at $time.",
            ongoing = true,
            allowStop = false,
        )
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Driver location runtime", NotificationManager.IMPORTANCE_LOW),
        )
    }

    companion object {
        const val ACTION_STOP = "co.uk.xdrivelogistics.driver.STOP_TRACKING"
        const val ACTION_STOP_AVAILABILITY = "co.uk.xdrivelogistics.driver.STOP_AVAILABILITY_TRACKING"
        private const val CHANNEL_ID = "xdrive_driver_tracking"
        private const val NOTIFICATION_ID = 4601
        private const val JOB_PUBLISH_INTERVAL_MS = 60_000L
        private const val AVAILABILITY_PUBLISH_INTERVAL_MS = 5 * 60_000L
        private const val RECONCILE_INTERVAL_MS = 30_000L
        private const val STATE_RETRY_INTERVAL_MS = 15_000L
        private const val STOP_MESSAGE_DELAY_MS = 1_500L
    }
}
