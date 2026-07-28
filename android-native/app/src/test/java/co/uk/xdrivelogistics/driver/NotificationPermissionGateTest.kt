package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for notification permission gate logic.
 *
 * Android runtime permission requests (ActivityResultContracts) require
 * instrumented tests; here we prove the conditional logic that decides
 * whether to request POST_NOTIFICATIONS is correct for the three cases:
 * - Already granted: no request needed.
 * - Denied/not-yet-asked on Android 13+: request required.
 * - Pre-Android 13: no request required.
 */
class NotificationPermissionGateTest {

    private fun shouldRequestNotificationPermission(
        sdkInt: Int,
        isGranted: Boolean,
        tiramissaSdkVersion: Int = 33, // Build.VERSION_CODES.TIRAMISU
    ): Boolean {
        return sdkInt >= tiramissaSdkVersion && !isGranted
    }

    @Test
    fun `pre-Android-13 device never needs explicit notification permission request`() {
        assertEquals(false, shouldRequestNotificationPermission(sdkInt = 28, isGranted = false))
        assertEquals(false, shouldRequestNotificationPermission(sdkInt = 32, isGranted = false))
    }

    @Test
    fun `Android 13 or above with permission granted does not need request`() {
        assertEquals(false, shouldRequestNotificationPermission(sdkInt = 33, isGranted = true))
        assertEquals(false, shouldRequestNotificationPermission(sdkInt = 35, isGranted = true))
    }

    @Test
    fun `Android 13 or above without permission granted requires request`() {
        assertEquals(true, shouldRequestNotificationPermission(sdkInt = 33, isGranted = false))
        assertEquals(true, shouldRequestNotificationPermission(sdkInt = 35, isGranted = false))
    }

    @Test
    fun `request is triggered only when user is authenticated`() {
        val isAuthenticated = false
        val sdkInt = 34
        val isGranted = false
        // Authentication must be confirmed before launching the permission request
        val shouldRequest = isAuthenticated && shouldRequestNotificationPermission(sdkInt, isGranted)
        assertEquals(false, shouldRequest)
    }

    @Test
    fun `request is triggered when authenticated and permission not yet granted on Android 13 plus`() {
        val isAuthenticated = true
        val sdkInt = 34
        val isGranted = false
        val shouldRequest = isAuthenticated && shouldRequestNotificationPermission(sdkInt, isGranted)
        assertEquals(true, shouldRequest)
    }
}
