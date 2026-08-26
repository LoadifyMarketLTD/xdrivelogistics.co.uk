package co.uk.xdrivelogistics.driver

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import co.uk.xdrivelogistics.driver.data.AvailabilityPresence
import co.uk.xdrivelogistics.driver.data.AvailabilityPresenceApi
import co.uk.xdrivelogistics.driver.data.DriverSession
import kotlinx.coroutines.tasks.await

/**
 * One-shot availability publisher for the native app.
 *
 * It deliberately uses the fused provider only to obtain a single fresh
 * position when the driver explicitly enables availability. It never starts
 * the job TrackingService and therefore cannot silently turn pre-award
 * availability into continuous execution tracking.
 */
class AvailabilityPresenceController(
    context: Context,
    xdriveBaseUrl: String,
) {
    private val appContext = context.applicationContext
    private val locationClient = LocationServices.getFusedLocationProviderClient(appContext)
    private val api = AvailabilityPresenceApi(xdriveBaseUrl)

    suspend fun load(session: DriverSession): Result<AvailabilityPresence> = api.load(session)

    @SuppressLint("MissingPermission")
    suspend fun start(
        session: DriverSession,
        visibility: String,
        hours: Int,
        hasLocationPermission: Boolean,
    ): Result<AvailabilityPresence> {
        if (!hasLocationPermission) return Result.failure(IllegalStateException("Location permission is required to share availability."))

        val location = runCatching {
            val tokenSource = CancellationTokenSource()
            locationClient.getCurrentLocation(
                Priority.PRIORITY_BALANCED_POWER_ACCURACY,
                tokenSource.token,
            ).await()
        }.getOrNull() ?: return Result.failure(IllegalStateException("Current location is unavailable. Try again after GPS has a fix."))

        return api.start(
            session = session,
            lat = location.latitude,
            lng = location.longitude,
            visibility = visibility,
            hours = hours,
        )
    }

    suspend fun stop(session: DriverSession): Result<Unit> = api.stop(session)
}
