package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Task 10 – Offline Queue + Pending Sync
 * Task 12 – GPS / Tracking
 */
class TrackingPolicyTest {

    // ── Task 12 – GPS / Tracking – PendingLocation freshness ─────────────────

    @Test
    fun `task12 pending location expires after safety window`() {
        val location = PendingLocation(53.75, -2.48, 1_000L)
        assertTrue(location.isFresh(nowEpochMs = 1_000L + 60_000L))
        assertFalse(location.isFresh(nowEpochMs = 1_000L + PendingLocation.DEFAULT_MAX_AGE_MS + 1L))
    }

    @Test
    fun `task12 pending location with zero capture time is never fresh`() {
        val stale = PendingLocation(53.75, -2.48, capturedAtEpochMs = 0L)
        assertFalse(stale.isFresh(nowEpochMs = 1_000L))
    }

    @Test
    fun `task12 pending location is fresh exactly at max age boundary`() {
        val location = PendingLocation(53.75, -2.48, 5_000L)
        val atBoundary = 5_000L + PendingLocation.DEFAULT_MAX_AGE_MS
        assertTrue(location.isFresh(nowEpochMs = atBoundary))
        assertFalse(location.isFresh(nowEpochMs = atBoundary + 1L))
    }

    @Test
    fun `task12 default max age is ten minutes`() {
        assertEquals(10 * 60 * 1000L, PendingLocation.DEFAULT_MAX_AGE_MS)
    }

    @Test
    fun `task12 pending location stores coordinates correctly`() {
        val location = PendingLocation(latitude = 51.509865, longitude = -0.118092, capturedAtEpochMs = 1_000L)
        assertEquals(51.509865, location.latitude, 0.000001)
        assertEquals(-0.118092, location.longitude, 0.000001)
    }

    @Test
    fun `task12 custom max age override is respected`() {
        val location = PendingLocation(53.0, -2.0, 1_000L)
        assertTrue(location.isFresh(nowEpochMs = 1_000L + 30_000L, maxAgeMs = 60_000L))
        assertFalse(location.isFresh(nowEpochMs = 1_000L + 90_000L, maxAgeMs = 60_000L))
    }

    // ── Task 16 – Authentication error handling ───────────────────────────────

    @Test
    fun `task16 authentication failures are distinguished from network failures`() {
        assertTrue(IllegalStateException("401 unauthorized token").isAuthenticationFailure())
        assertTrue(IllegalStateException("JWT expired").isAuthenticationFailure())
        assertFalse(IllegalStateException("Unable to resolve host").isAuthenticationFailure())
    }

    @Test
    fun `task16 all jwt and token variants trigger authentication failure`() {
        assertTrue(IllegalStateException("HTTP 401 Unauthorized").isAuthenticationFailure())
        assertTrue(IllegalStateException("jwt is invalid").isAuthenticationFailure())
        assertTrue(IllegalStateException("JWT expired").isAuthenticationFailure())
        assertTrue(IllegalStateException("token has been revoked").isAuthenticationFailure())
        assertTrue(IllegalStateException("session expired").isAuthenticationFailure())
    }

    @Test
    fun `task16 network and server errors do not trigger authentication failure`() {
        assertFalse(IllegalStateException("Unable to resolve host").isAuthenticationFailure())
        assertFalse(IllegalStateException("Connection refused").isAuthenticationFailure())
        assertFalse(IllegalStateException("Read timeout").isAuthenticationFailure())
        assertFalse(IllegalStateException("503 Service Unavailable").isAuthenticationFailure())
    }

    // ── Task 10 – Offline Queue + Pending Sync – UploadOutcome ───────────────

    @Test
    fun `task10 upload outcome values are distinct`() {
        val outcomes = UploadOutcome.values()
        assertEquals(4, outcomes.size)
        assertTrue(UploadOutcome.SUCCESS in outcomes)
        assertTrue(UploadOutcome.RETRY in outcomes)
        assertTrue(UploadOutcome.AUTH_REQUIRED in outcomes)
        assertTrue(UploadOutcome.JOB_NOT_ACTIVE in outcomes)
    }

    @Test
    fun `task10 success outcome is different from retry`() {
        assertTrue(UploadOutcome.SUCCESS != UploadOutcome.RETRY)
    }

    @Test
    fun `task10 auth required outcome triggers re-login not retry`() {
        assertTrue(UploadOutcome.AUTH_REQUIRED != UploadOutcome.RETRY)
        assertTrue(UploadOutcome.AUTH_REQUIRED != UploadOutcome.SUCCESS)
    }

    @Test
    fun `task10 inactive job outcome does not retry or trigger re-login`() {
        assertTrue(UploadOutcome.JOB_NOT_ACTIVE != UploadOutcome.RETRY)
        assertTrue(UploadOutcome.JOB_NOT_ACTIVE != UploadOutcome.AUTH_REQUIRED)
        assertTrue(UploadOutcome.JOB_NOT_ACTIVE != UploadOutcome.SUCCESS)
    }
}
