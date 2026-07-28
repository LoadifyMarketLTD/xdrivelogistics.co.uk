package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverSession
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the push-notification session gate ([isPushAllowedForSession]).
 *
 * Verifies that operational push content is suppressed when there is no authenticated
 * session (delayed post-logout push, cold-process restart) and allowed when a session
 * is present. The function is extracted from [DriverFirebaseMessagingService] so that
 * it can be tested without a Firebase or Android context.
 */
class PushSessionGateTest {

    @Test
    fun `notification is suppressed when session is null`() {
        assertFalse(isPushAllowedForSession(null))
    }

    @Test
    fun `notification is allowed when a valid session exists`() {
        val session = DriverSession(
            accessToken = "access-token",
            refreshToken = "refresh-token",
            userId = "user-1",
            email = "driver@example.com",
        )
        assertTrue(isPushAllowedForSession(session))
    }

    @Test
    fun `different owners both produce an allowed session individually`() {
        val sessionA = DriverSession(
            accessToken = "token-a",
            refreshToken = "refresh-a",
            userId = "owner-a",
            email = "a@example.com",
        )
        val sessionB = DriverSession(
            accessToken = "token-b",
            refreshToken = "refresh-b",
            userId = "owner-b",
            email = "b@example.com",
        )
        assertTrue(isPushAllowedForSession(sessionA))
        assertTrue(isPushAllowedForSession(sessionB))
    }

    @Test
    fun `null session after A to B switch suppresses push`() {
        // Simulates the brief window between A logging out and B's session being written,
        // or a permanent logged-out state where no session is present.
        assertFalse(isPushAllowedForSession(null))
    }
}
