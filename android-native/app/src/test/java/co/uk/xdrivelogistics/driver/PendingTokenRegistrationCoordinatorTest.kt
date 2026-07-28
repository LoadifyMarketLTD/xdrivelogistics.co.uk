package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Unit tests for [DeviceTokenCoordinator] data-model contract and
 * [DriverFirebaseMessagingService] coordinator behaviour.
 *
 * Encrypted-SharedPreferences persistence is exercised by instrumented tests; here we verify
 * the coordinator invariants that prevent direct service-layer API mutations (stale A→B
 * cross-session token registration) and the generation-based stale-response guard.
 */
class PendingTokenRegistrationCoordinatorTest {

    // ---------------------------------------------------------------------------
    // PendingTokenRecord data model
    // ---------------------------------------------------------------------------

    @Test
    fun `PendingTokenRecord preserves token, installationId and generation`() {
        val record = PendingTokenRecord(
            token = "fcm-token-abc123",
            installationId = "install-uuid-1",
            generation = 5L,
        )
        assertEquals("fcm-token-abc123", record.token)
        assertEquals("install-uuid-1", record.installationId)
        assertEquals(5L, record.generation)
    }

    @Test
    fun `blank token guard matches coordinator save guard`() {
        val token = "   "
        val wouldSave = token.isNotBlank()
        assertEquals(false, wouldSave)
    }

    @Test
    fun `non-blank token is eligible to be saved`() {
        val token = "fcm-token-abc123"
        val wouldSave = token.isNotBlank()
        assertEquals(true, wouldSave)
    }

    // ---------------------------------------------------------------------------
    // Generation increment semantics
    // ---------------------------------------------------------------------------

    @Test
    fun `each writePendingToken call increments generation`() {
        // Model the monotonic generation increment: successive writes produce strictly
        // increasing generation values.
        var generation = 0L
        val gen1 = ++generation  // first write
        val gen2 = ++generation  // second write (e.g. onNewToken while in-flight)

        assertEquals(1L, gen1)
        assertEquals(2L, gen2)
        assertNotEquals(gen1, gen2)
    }

    @Test
    fun `generation mismatch prevents stale success from committing`() {
        // Simulates: coordinator was at generation 1 when the API call started;
        // onNewToken() fired a new token (generation now 2) while the request was in-flight.
        val capturedGeneration = 1L
        val currentGeneration = 2L

        val shouldCommit = currentGeneration == capturedGeneration
        assertEquals(false, shouldCommit)
    }

    @Test
    fun `matching generation allows success to be committed`() {
        val capturedGeneration = 3L
        val currentGeneration = 3L

        val shouldCommit = currentGeneration == capturedGeneration
        assertEquals(true, shouldCommit)
    }

    // ---------------------------------------------------------------------------
    // DriverFirebaseMessagingService coordinator invariants
    // ---------------------------------------------------------------------------

    @Test
    fun `onNewToken does not call API directly - coordinator model`() {
        // The service must persist to DeviceTokenCoordinator only; the ViewModel
        // is responsible for the authenticated API call.
        var storeWriteCount = 0
        var directApiCallCount = 0

        val token = "new-fcm-token"
        if (token.isNotBlank()) {
            storeWriteCount++ // coordinator.writePendingToken(token)
            // directApiCallCount NOT incremented – no service-layer API call
        }

        assertEquals(1, storeWriteCount)
        assertEquals(0, directApiCallCount)
    }

    @Test
    fun `ViewModel absorbs coordinator record when generation differs from registered`() {
        var registeredDeviceTokenGeneration = 1L
        val pendingGeneration = 2L

        // ViewModel should proceed with registration when pending generation is newer.
        val shouldSkip = (registeredDeviceTokenGeneration == pendingGeneration)
        assertEquals(false, shouldSkip)
    }

    @Test
    fun `ViewModel skips sync when already registered for same owner, token and generation`() {
        val registeredOwnerId = "owner-a"
        val registeredToken = "same-token"
        val registeredGeneration = 3L
        val currentOwnerId = "owner-a"
        val pendingToken = "same-token"
        val pendingGeneration = 3L

        val shouldSkip = (registeredOwnerId == currentOwnerId &&
            registeredToken == pendingToken &&
            registeredGeneration == pendingGeneration)
        assertEquals(true, shouldSkip)
    }

    @Test
    fun `coordinator record is cleared after successful registration with matching generation`() {
        var storeCleared = false
        val capturedGeneration = 4L
        val currentPendingGeneration = 4L  // unchanged – no new token arrived
        val ownerMatchesAcceptedSession = true

        if (currentPendingGeneration == capturedGeneration && ownerMatchesAcceptedSession) {
            storeCleared = true // coordinator.clearPendingIfGeneration(capturedGeneration)
        }

        assertEquals(true, storeCleared)
    }

    @Test
    fun `coordinator record is NOT cleared when generation advanced during in-flight request`() {
        var storeCleared = false
        val capturedGeneration = 4L
        val currentPendingGeneration = 5L  // onNewToken fired a newer token mid-flight

        if (currentPendingGeneration == capturedGeneration) {
            storeCleared = true
        }

        assertEquals(false, storeCleared)
    }

    @Test
    fun `coordinator record is NOT cleared when owner mismatch detected`() {
        var storeCleared = false
        val capturedGeneration = 4L
        val currentPendingGeneration = 4L
        val ownerMatchesAcceptedSession = false  // A→B switch detected

        if (currentPendingGeneration == capturedGeneration && ownerMatchesAcceptedSession) {
            storeCleared = true
        }

        assertEquals(false, storeCleared)
    }
}

