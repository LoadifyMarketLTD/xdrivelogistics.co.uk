package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TrackingPolicyTest {
    @Test
    fun `pending location expires after safety window`() {
        val location = PendingLocation(53.75, -2.48, 1_000L)
        assertTrue(location.isFresh(nowEpochMs = 1_000L + 60_000L))
        assertFalse(location.isFresh(nowEpochMs = 1_000L + PendingLocation.DEFAULT_MAX_AGE_MS + 1L))
    }

    @Test
    fun `authentication failures are distinguished from network failures`() {
        assertTrue(IllegalStateException("401 unauthorized token").isAuthenticationFailure())
        assertTrue(IllegalStateException("JWT expired").isAuthenticationFailure())
        assertFalse(IllegalStateException("Unable to resolve host").isAuthenticationFailure())
    }
}
