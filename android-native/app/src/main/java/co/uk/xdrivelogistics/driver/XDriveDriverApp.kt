package co.uk.xdrivelogistics.driver

import android.Manifest
import android.app.Activity
import android.app.Application
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import co.uk.xdrivelogistics.driver.data.AvailabilityPresenceApi
import co.uk.xdrivelogistics.driver.data.SessionStore
import co.uk.xdrivelogistics.driver.data.TrackingStateApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Starts/reconciles the single foreground location runtime only while the app
 * is visible. The already-running TrackingService then owns both JOB and
 * AVAILABILITY modes and can switch between them without a background FGS start.
 *
 * Push registration is reconciled from the same visible-app loop. Android 13+
 * notification permission is requested once, in authenticated app context, and
 * never blocks the in-app notification inbox if the user declines it.
 */
class XDriveDriverApp : Application(), Application.ActivityLifecycleCallbacks {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val sessionStore by lazy { SessionStore(applicationContext) }
    private val trackingStateApi by lazy { TrackingStateApi(BuildConfig.XDRIVE_BASE_URL) }
    private val availabilityApi by lazy { AvailabilityPresenceApi(BuildConfig.XDRIVE_BASE_URL) }
    private val pushRegistrationManager by lazy { PushRegistrationManager(applicationContext) }
    private val pushPrefs by lazy { getSharedPreferences("xdrive_push_installation", MODE_PRIVATE) }
    private var reconciliationJob: Job? = null
    private var resumedActivities = 0
    private var pushRegisteredUserId: String? = null

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(this)
        pushRegistrationManager.initializeFirebase()
    }

    override fun onTerminate() {
        reconciliationJob?.cancel()
        scope.cancel()
        unregisterActivityLifecycleCallbacks(this)
        super.onTerminate()
    }

    override fun onActivityResumed(activity: Activity) {
        resumedActivities += 1
        isAppVisible = true
        if (reconciliationJob?.isActive == true) return
        reconciliationJob = scope.launch {
            while (isActive && resumedActivities > 0) {
                reconcilePushRegistration(activity)
                reconcileLocationRuntime()
                delay(RECONCILE_INTERVAL_MS)
            }
        }
    }

    override fun onActivityPaused(activity: Activity) {
        resumedActivities = (resumedActivities - 1).coerceAtLeast(0)
        if (resumedActivities == 0) {
            isAppVisible = false
            reconciliationJob?.cancel()
            reconciliationJob = null
        }
    }

    private suspend fun reconcilePushRegistration(activity: Activity) {
        val session = runCatching { sessionStore.readSession() }.getOrNull() ?: run {
            pushRegisteredUserId = null
            return
        }
        if (!pushRegistrationManager.isConfigured()) return

        activity.runOnUiThread { maybeRequestNotificationPermission(activity) }

        if (pushRegisteredUserId == session.userId) return
        if (pushRegistrationManager.ensureRegistered(session).isSuccess) {
            pushRegisteredUserId = session.userId
        }
    }

    private fun maybeRequestNotificationPermission(activity: Activity) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return
        if (pushPrefs.getBoolean(KEY_NOTIFICATION_PERMISSION_REQUESTED, false)) return

        // Record before launching so lifecycle churn cannot generate repeated
        // permission dialogs. A declined permission can still be enabled later
        // from Android settings; the XDrive in-app notification inbox remains live.
        pushPrefs.edit().putBoolean(KEY_NOTIFICATION_PERMISSION_REQUESTED, true).apply()
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            REQUEST_NOTIFICATION_PERMISSION,
        )
    }

    private suspend fun reconcileLocationRuntime() {
        val session = runCatching { sessionStore.readSession() }.getOrNull() ?: return
        if (!hasForegroundLocationPermission()) return

        val activeJob = trackingStateApi.load(session.accessToken).getOrNull()?.shouldTrack == true
        val activeAvailability = if (activeJob) {
            false
        } else {
            availabilityApi.load(session).getOrNull()?.active == true
        }
        if (!activeJob && !activeAvailability) return

        runCatching {
            ContextCompat.startForegroundService(
                applicationContext,
                Intent(applicationContext, TrackingService::class.java),
            )
        }
    }

    private fun hasForegroundLocationPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
    override fun onActivityStarted(activity: Activity) = Unit
    override fun onActivityStopped(activity: Activity) = Unit
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
    override fun onActivityDestroyed(activity: Activity) = Unit

    companion object {
        @Volatile
        var isAppVisible: Boolean = false
            private set

        const val EXTRA_RECONCILED_JOB_ID = "xdrive_reconciled_job_id"
        private const val RECONCILE_INTERVAL_MS = 30_000L
        private const val KEY_NOTIFICATION_PERMISSION_REQUESTED = "notification_permission_requested"
        private const val REQUEST_NOTIFICATION_PERMISSION = 4101
    }
}
