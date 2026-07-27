package co.uk.xdrivelogistics.driver.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.InterruptedIOException
import java.net.UnknownHostException

class MobileApiErrorClassifierTest {
    @Test
    fun `transport failure is retryable typed exception`() {
        val error = MobileApiErrorClassifier.transportFailure(UnknownHostException("dns")) as MobileApiTransportException
        assertEquals("transport_dns", error.code)
        assertTrue(error.retryable)
        assertEquals(MobileApiFailureCategory.TRANSPORT_DNS, error.category)
    }

    @Test
    fun `transport timeout is classified as retryable timeout`() {
        val error = MobileApiErrorClassifier.transportFailure(InterruptedIOException("timeout")) as MobileApiTransportException
        assertEquals("transport_timeout", error.code)
        assertTrue(error.retryable)
        assertEquals(MobileApiFailureCategory.TRANSPORT_TIMEOUT, error.category)
    }

    @Test
    fun `http retry matrix covers auth conflicts and selected retries`() {
        val unauthorized = MobileApiErrorClassifier.httpFailure(401, "fallback", "unauthorized", null, "m-1", null)
        assertFalse(unauthorized.retryable)
        assertEquals(MobileApiFailureCategory.HTTP_UNAUTHORIZED, unauthorized.category)

        val forbidden = MobileApiErrorClassifier.httpFailure(403, "fallback", "forbidden", null, "m-2", null)
        assertFalse(forbidden.retryable)
        assertEquals(MobileApiFailureCategory.HTTP_FORBIDDEN, forbidden.category)

        val conflict = MobileApiErrorClassifier.httpFailure(409, "fallback", "conflict", null, "m-3", null)
        assertFalse(conflict.retryable)
        assertEquals(MobileApiFailureCategory.HTTP_CONFLICT, conflict.category)

        val tooEarly = MobileApiErrorClassifier.httpFailure(425, "fallback", "too early", null, "m-4", null)
        assertTrue(tooEarly.retryable)
        assertEquals(MobileApiFailureCategory.HTTP_TOO_EARLY, tooEarly.category)

        val rateLimited = MobileApiErrorClassifier.httpFailure(429, "fallback", "rate limit", null, "m-5", "120")
        assertTrue(rateLimited.retryable)
        assertEquals(120L, rateLimited.retryAfterSeconds)

        val serviceUnavailable = MobileApiErrorClassifier.httpFailure(503, "fallback", "service unavailable", "svc_down", "m-6", null)
        assertTrue(serviceUnavailable.retryable)
        assertEquals("svc_down", serviceUnavailable.code)
        assertEquals(MobileApiFailureCategory.HTTP_SERVER_RETRYABLE, serviceUnavailable.category)

        val nonRetryableServer = MobileApiErrorClassifier.httpFailure(500, "fallback", "internal error", null, "m-7", null)
        assertFalse(nonRetryableServer.retryable)
        assertEquals(MobileApiFailureCategory.HTTP_SERVER_NON_RETRYABLE, nonRetryableServer.category)
    }
}
