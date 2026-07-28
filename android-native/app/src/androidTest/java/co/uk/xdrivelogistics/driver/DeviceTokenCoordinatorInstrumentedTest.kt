package co.uk.xdrivelogistics.driver

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for [DeviceTokenCoordinator].
 *
 * Verifies actual EncryptedSharedPreferences persistence:
 * - stable installation ID across reads;
 * - generation monotonically increases;
 * - clearPendingIfGeneration only clears when generation matches;
 * - pending record round-trips correctly.
 */
@RunWith(AndroidJUnit4::class)
class DeviceTokenCoordinatorInstrumentedTest {

    private lateinit var coordinator: DeviceTokenCoordinator

    @Before
    fun setup() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        coordinator = DeviceTokenCoordinator(context)
    }

    @Test
    fun installationIdIsStableAcrossMultipleReads() {
        val id1 = coordinator.installationId
        val id2 = coordinator.installationId
        assertEquals(id1, id2)
        assertTrue(id1.isNotBlank())
    }

    @Test
    fun writeAndReadPendingTokenRoundTrips() {
        val record = coordinator.writePendingToken("test-fcm-token")
        val read = coordinator.readPending()
        assertNotNull(read)
        assertEquals("test-fcm-token", read!!.token)
        assertEquals(record.installationId, read.installationId)
        assertEquals(record.generation, read.generation)
    }

    @Test
    fun generationIncreasesWithEachWrite() {
        val r1 = coordinator.writePendingToken("token-1")
        val r2 = coordinator.writePendingToken("token-2")
        assertTrue(r2.generation > r1.generation)
    }

    @Test
    fun clearPendingIfGenerationClearsWhenGenerationMatches() {
        val record = coordinator.writePendingToken("token-to-clear")
        coordinator.clearPendingIfGeneration(record.generation)
        assertNull(coordinator.readPending())
    }

    @Test
    fun clearPendingIfGenerationDoesNotClearWhenGenerationMismatches() {
        coordinator.writePendingToken("token-first")
        val r2 = coordinator.writePendingToken("token-second")
        // Try to clear with the generation of the first write — should be no-op.
        coordinator.clearPendingIfGeneration(r2.generation - 1)
        val pending = coordinator.readPending()
        assertNotNull(pending)
        assertEquals("token-second", pending!!.token)
    }
}
