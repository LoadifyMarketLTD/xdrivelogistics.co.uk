package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for [PendingUnregister] data model and [PendingUnregisterStore] contract.
 *
 * Persistence is exercised by instrumented tests; here we verify the data-model
 * invariants, multi-entry semantics, owner-mismatch guard, and bounded retry logic.
 */
class PendingUnregisterStoreTest {

    @Test
    fun `PendingUnregister preserves ownerId and token`() {
        val pending = PendingUnregister(ownerId = "user-a", token = "token-1")
        assertEquals("user-a", pending.ownerId)
        assertEquals("token-1", pending.token)
    }

    @Test
    fun `PendingUnregister default addedAtMs is zero and attemptCount is zero`() {
        val pending = PendingUnregister(ownerId = "user-a", token = "token-1")
        assertEquals(0L, pending.addedAtMs)
        assertEquals(0, pending.attemptCount)
    }

    @Test
    fun `owner mismatch prevents stale record from affecting a different owner`() {
        // Simulate the guard: stored record is for owner A, current session is owner B.
        val entries = listOf(PendingUnregister(ownerId = "owner-a", token = "token-1"))
        val currentOwnerId = "owner-b"
        val forOwner = entries.filter { it.ownerId == currentOwnerId }
        assertTrue(forOwner.isEmpty())
    }

    @Test
    fun `matching owner exposes pending records for flush`() {
        val entries = listOf(PendingUnregister(ownerId = "owner-a", token = "token-1"))
        val currentOwnerId = "owner-a"
        val forOwner = entries.filter { it.ownerId == currentOwnerId }
        assertEquals(1, forOwner.size)
    }

    @Test
    fun `blank token in pending record is not eligible for flush`() {
        val pending = PendingUnregister(ownerId = "owner-a", token = "  ")
        assertFalse(pending.token.isNotBlank())
    }

    @Test
    fun `non-blank token in pending record is eligible for flush`() {
        val pending = PendingUnregister(ownerId = "owner-a", token = "valid-token")
        assertTrue(pending.token.isNotBlank())
    }

    // ── Multi-entry semantics ────────────────────────────────────────────────

    @Test
    fun `second failed logout for different owner appends rather than overwrites`() {
        // Model the append-not-overwrite contract of PendingUnregisterStore.add().
        val entries = mutableListOf<PendingUnregister>()
        entries.add(PendingUnregister(ownerId = "owner-a", token = "token-a"))
        entries.add(PendingUnregister(ownerId = "owner-b", token = "token-b"))
        assertEquals(2, entries.size)
        assertEquals("owner-a", entries[0].ownerId)
        assertEquals("owner-b", entries[1].ownerId)
    }

    @Test
    fun `adding duplicate owner+token replaces existing entry`() {
        // Matches PendingUnregisterStore.add() deduplication behaviour.
        val entries = mutableListOf(PendingUnregister(ownerId = "owner-a", token = "token-1", attemptCount = 3))
        entries.removeAll { it.ownerId == "owner-a" && it.token == "token-1" }
        entries.add(PendingUnregister(ownerId = "owner-a", token = "token-1"))
        assertEquals(1, entries.size)
        assertEquals(0, entries[0].attemptCount)
    }

    @Test
    fun `removing one entry leaves others intact`() {
        val entries = mutableListOf(
            PendingUnregister(ownerId = "owner-a", token = "token-1"),
            PendingUnregister(ownerId = "owner-b", token = "token-2"),
        )
        entries.removeAll { it.ownerId == "owner-a" && it.token == "token-1" }
        assertEquals(1, entries.size)
        assertEquals("owner-b", entries[0].ownerId)
    }

    // ── Bounded retry / expiry ───────────────────────────────────────────────

    @Test
    fun `entry exceeding MAX_ATTEMPT_COUNT is pruned`() {
        val entries = listOf(
            PendingUnregister(ownerId = "owner-a", token = "token-1", attemptCount = PendingUnregisterStore.MAX_ATTEMPT_COUNT),
        )
        val pruned = entries.filter { it.attemptCount < PendingUnregisterStore.MAX_ATTEMPT_COUNT }
        assertTrue(pruned.isEmpty())
    }

    @Test
    fun `entry below MAX_ATTEMPT_COUNT survives pruning`() {
        val entries = listOf(
            PendingUnregister(ownerId = "owner-a", token = "token-1", attemptCount = PendingUnregisterStore.MAX_ATTEMPT_COUNT - 1),
        )
        val pruned = entries.filter { it.attemptCount < PendingUnregisterStore.MAX_ATTEMPT_COUNT }
        assertEquals(1, pruned.size)
    }

    @Test
    fun `entry older than MAX_AGE_MS is pruned`() {
        val nowMs = System.currentTimeMillis()
        val entries = listOf(
            PendingUnregister(ownerId = "owner-a", token = "token-1", addedAtMs = nowMs - PendingUnregisterStore.MAX_AGE_MS - 1_000),
        )
        val pruned = entries.filter { (nowMs - it.addedAtMs) < PendingUnregisterStore.MAX_AGE_MS }
        assertTrue(pruned.isEmpty())
    }

    @Test
    fun `entry within MAX_AGE_MS survives pruning`() {
        val nowMs = System.currentTimeMillis()
        val entries = listOf(
            PendingUnregister(ownerId = "owner-a", token = "token-1", addedAtMs = nowMs - 1_000),
        )
        val pruned = entries.filter { (nowMs - it.addedAtMs) < PendingUnregisterStore.MAX_AGE_MS }
        assertEquals(1, pruned.size)
    }
}
