package co.uk.xdrivelogistics.driver

import android.Manifest
import android.app.Activity
import android.app.Application
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.core.content.ContextCompat
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
 * Reconciles active-job tracking only while the driver app is visible.
 *
 * Android 12+ restricts starting a location foreground service from the
 * background. This coordinator therefore checks server-authoritative job state
 * while an Activity is resumed, then starts TrackingService from that visible
 * state. Once started, TrackingService is allowed to continue in background.
 */
class XDriveDriverApp : Application(), Application.ActivityLifecycleCallbacks {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val sessionStore by lazy { SessionStore(applicationContext) }
    private val trackingStateApi by lazy { TrackingStateApi(BuildConfig.XDRIVE_BASE_URL) }
    private var reconciliationJob: Job? = null
    private var resumedActivities = 0

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(this)
    }

    override fun onTerminate() {
        reconciliationJob?.cancel()
        scope.cancel()
        unregisterActivityLifecycleCallbacks(this)
        super.onTerminate()
    }

    override fun onActivityResumed(activity: Activity) {
        resumedActivities += 1
        if (reconciliationJob?.isActive == true) return
        reconciliationJob = scope.launch {
            while (isActive && resumedActivities > 0) {
                reconcileTracking()
                delay(RECONCILE_INTERVAL_MS)
            }
        }
    }

    override fun onActivityPaused(activity: Activity) {
        resumedActivities = (resumedActivities - 1).coerceAtLeast(0)
        if (resumedActivities == 0) {
            reconciliationJob?.cancel()
            reconciliationJob = null
        }
    }

    private suspend fun reconcileTracking() {
        val session = runCatching { sessionStore.readSession() }.getOrNull() ?: return
        val state = trackingStateApi.load(session.accessToken).getOrNull() ?: return
        if (!state.shouldTrack) return
        if (!hasForegroundLocationPermission()) return

        runCatching {
            ContextCompat.startForegroundService(
                applicationContext,
                Intent(applicationContext, TrackingService::class.java)
                    .putExtra(EXTRA_RECONCILED_JOB_ID, state.jobId),
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
        const val EXTRA_RECONCILED_JOB_ID = "xdrive_reconciled_job_id"
        private const val RECONCILE_INTERVAL_MS = 30_000L
    }
}
