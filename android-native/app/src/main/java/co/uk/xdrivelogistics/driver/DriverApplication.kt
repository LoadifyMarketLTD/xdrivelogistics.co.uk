package co.uk.xdrivelogistics.driver

import android.app.Application

/**
 * Process-wide Application subclass registered in the manifest so that Firebase is initialised
 * before any background component (e.g. [DriverFirebaseMessagingService]) starts.
 *
 * Initialisation is guarded by [ensureFirebaseAppInitialized]: CI/test builds that omit
 * production credentials will skip Firebase setup without crashing.
 */
class DriverApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        ensureFirebaseAppInitialized(this)
    }
}
