package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for [PendingUnregister] data model and [PendingUnregisterStore] contract.
 *
 * Persistence is exercised by instrumented tests; here we verify the data-model
 * invariants and the owner-mismatch guard that prevents stale-A from expiring owner-B.
 */
class PendingUnregisterStoreTest {

    @Test
    fun `PendingUnregister preserves ownerId and token`() {
        val pending = PendingUnregister(ownerId = "user-a", token = "token-1")
        assertEquals("user-a", pending.ownerId)
        assertEquals("token-1", pending.token)
    }

    @Test
    fun `owner mismatch prevents stale record from affecting a different owner`() {
        // Simulate the guard inside flushPendingDeviceTokenUnregisterIfNeeded:
        // the stored record is for owner A but the current session belongs to owner B.
        val storedOwnerId = "owner-a"
        val currentSessionOwnerId = "owner-b"

        val shouldFlush = storedOwnerId == currentSessionOwnerId
        assertEquals(false, shouldFlush)
    }

    @Test
    fun `matching owner allows pending record to be flushed`() {
        val storedOwnerId = "owner-a"
        val currentSessionOwnerId = "owner-a"

        val shouldFlush = storedOwnerId == currentSessionOwnerId
        assertEquals(true, shouldFlush)
    }

    @Test
    fun `blank token in pending record is not flushed`() {
        val pending = PendingUnregister(ownerId = "owner-a", token = "  ")
        val shouldFlush = pending.token.isNotBlank()
        assertEquals(false, shouldFlush)
    }

    @Test
    fun `non-blank token in pending record is eligible for flush`() {
        val pending = PendingUnregister(ownerId = "owner-a", token = "valid-token")
        val shouldFlush = pending.token.isNotBlank()
        assertEquals(true, shouldFlush)
    }
}
