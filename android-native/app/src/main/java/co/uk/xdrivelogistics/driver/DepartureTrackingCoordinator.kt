package co.uk.xdrivelogistics.driver

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat

/**
 * Best-effort tracking activation for a driver-initiated departure action.
 *
 * Job lifecycle and GPS visibility intentionally remain separate channels:
 * a temporary location/network problem must not deadlock the driver's manual
 * job status progression. When the app is visible and Android's location
 * prerequisites are satisfied, we start the existing foreground tracking
 * runtime from the user interaction. Otherwise we return a driver-safe warning
 * and leave the lifecycle action free to continue.
 */
internal class DepartureTrackingCoordinator(
    private val context: Context,
    private val isAppVisible: () -> Boolean = { XDriveDriverApp.isAppVisible },
) {
    internal enum class Outcome {
        STARTED,
        APP_NOT_VISIBLE,
        PRECISE_LOCATION_REQUIRED,
        LOCATION_SERVICES_OFF,
        START_FAILED,
    }

    fun startBestEffort(): Outcome {
        if (!isAppVisible()) return Outcome.APP_NOT_VISIBLE
        if (!hasFineLocationPermission()) return Outcome.PRECISE_LOCATION_REQUIRED
        if (!isDeviceLocationEnabled()) return Outcome.LOCATION_SERVICES_OFF

        return runCatching {
            ContextCompat.startForegroundService(
                context,
                Intent(context, TrackingService::class.java),
            )
            Outcome.STARTED
        }.getOrDefault(Outcome.START_FAILED)
    }

    private fun hasFineLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun isDeviceLocationEnabled(): Boolean =
        runCatching {
            LocationManagerCompat.isLocationEnabled(context.getSystemService(LocationManager::class.java))
        }.getOrDefault(false)
}

internal fun DepartureTrackingCoordinator.Outcome.driverWarningOrNull(): String? = when (this) {
    DepartureTrackingCoordinator.Outcome.STARTED -> null
    DepartureTrackingCoordinator.Outcome.PRECISE_LOCATION_REQUIRED ->
        "Live tracking needs Precise Location. Your job status can continue; enable Precise Location as soon as it is safe."
    DepartureTrackingCoordinator.Outcome.LOCATION_SERVICES_OFF ->
        "Live tracking could not start because Android Location Services are off. Your job status can continue; turn Location on as soon as it is safe."
    DepartureTrackingCoordinator.Outcome.APP_NOT_VISIBLE,
    DepartureTrackingCoordinator.Outcome.START_FAILED ->
        "Live tracking could not start automatically. Your job status can continue; open XDrive tracking when it is safe to do so."
}
