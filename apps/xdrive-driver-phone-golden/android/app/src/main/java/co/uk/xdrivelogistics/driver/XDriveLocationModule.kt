package co.uk.xdrivelogistics.driver

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.atomic.AtomicBoolean

class XDriveLocationModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var activeManager: LocationManager? = null
  private var activeListener: LocationListener? = null

  override fun getName(): String = "XDriveLocation"

  @ReactMethod
  fun getCurrentPosition(promise: Promise) {
    val fineGranted = reactContext.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val coarseGranted = reactContext.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (!fineGranted && !coarseGranted) {
      promise.reject("LOCATION_PERMISSION", "Location permission has not been granted.")
      return
    }

    val manager = reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
    if (manager == null) {
      promise.reject("LOCATION_UNAVAILABLE", "Android location service is unavailable.")
      return
    }

    val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
      .filter { provider -> runCatching { manager.isProviderEnabled(provider) }.getOrDefault(false) }

    if (providers.isEmpty()) {
      promise.reject("LOCATION_DISABLED", "Location services are disabled on this device.")
      return
    }

    val lastKnown = providers
      .mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
      .maxByOrNull { location -> location.time }

    if (lastKnown != null && System.currentTimeMillis() - lastKnown.time <= FRESH_LOCATION_MS) {
      resolveLocation(promise, lastKnown)
      return
    }

    activeListener?.let { listener -> runCatching { activeManager?.removeUpdates(listener) } }

    val completed = AtomicBoolean(false)
    lateinit var listener: LocationListener
    lateinit var timeout: Runnable

    listener = object : LocationListener {
      override fun onLocationChanged(location: Location) {
        if (!completed.compareAndSet(false, true)) return
        mainHandler.removeCallbacks(timeout)
        runCatching { manager.removeUpdates(this) }
        if (activeListener === this) {
          activeListener = null
          activeManager = null
        }
        resolveLocation(promise, location)
      }

      override fun onProviderEnabled(provider: String) = Unit
      override fun onProviderDisabled(provider: String) = Unit
      @Deprecated("Deprecated in Android")
      override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
    }

    timeout = Runnable {
      if (!completed.compareAndSet(false, true)) return@Runnable
      runCatching { manager.removeUpdates(listener) }
      if (activeListener === listener) {
        activeListener = null
        activeManager = null
      }
      if (lastKnown != null) {
        resolveLocation(promise, lastKnown)
      } else {
        promise.reject("LOCATION_TIMEOUT", "No device location was available before timeout.")
      }
    }

    activeManager = manager
    activeListener = listener

    try {
      providers.forEach { provider ->
        manager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
      }
      mainHandler.postDelayed(timeout, LOCATION_TIMEOUT_MS)
    } catch (error: SecurityException) {
      completed.set(true)
      runCatching { manager.removeUpdates(listener) }
      activeListener = null
      activeManager = null
      promise.reject("LOCATION_PERMISSION", "Android denied access to device location.", error)
    } catch (error: Exception) {
      completed.set(true)
      runCatching { manager.removeUpdates(listener) }
      activeListener = null
      activeManager = null
      promise.reject("LOCATION_ERROR", "Unable to read the current device location.", error)
    }
  }

  override fun invalidate() {
    activeListener?.let { listener -> runCatching { activeManager?.removeUpdates(listener) } }
    activeListener = null
    activeManager = null
    super.invalidate()
  }

  private fun resolveLocation(promise: Promise, location: Location) {
    val payload = Arguments.createMap().apply {
      putDouble("latitude", location.latitude)
      putDouble("longitude", location.longitude)
      if (location.hasBearing()) putDouble("heading", location.bearing.toDouble()) else putNull("heading")
      if (location.hasSpeed()) putDouble("speedMph", location.speed.toDouble() * METRES_PER_SECOND_TO_MPH) else putNull("speedMph")
      putDouble("accuracyMetres", location.accuracy.toDouble())
      putDouble("recordedAtMs", location.time.toDouble())
    }
    promise.resolve(payload)
  }

  companion object {
    private const val FRESH_LOCATION_MS = 15_000L
    private const val LOCATION_TIMEOUT_MS = 10_000L
    private const val METRES_PER_SECOND_TO_MPH = 2.2369362920544
  }
}
