package co.uk.xdrivelogistics.driver

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Instrumented tests for [PendingUnregisterStore].
 *
 * Verifies actual EncryptedSharedPreferences persistence, multi-entry append semantics,
 * owner-scoped reads, attempt-count increment, and bounded-retry/expiry pruning.
 */
@RunWith(AndroidJUnit4::class)
class PendingUnregisterStoreInstrumentedTest {

    private lateinit var store: PendingUnregisterStore

    @Before
    fun setup() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        store = PendingUnregisterStore(context)
        // Start each test with an empty store.
        for (entry in store.readAll()) {
            store.remove(entry.ownerId, entry.token)
        }
    }

    @Test
    fun emptyStoreReadsNoEntries() {
        assertTrue(store.readAll().isEmpty())
    }

    @Test
    fun addSingleEntryAndRead() {
        store.add("owner-a", "token-1")
        val all = store.readAll()
        assertEquals(1, all.size)
        assertEquals("owner-a", all[0].ownerId)
        assertEquals("token-1", all[0].token)
        assertEquals(0, all[0].attemptCount)
    }

    @Test
    fun addTwoEntriesForDifferentOwnersBothPreserved() {
        store.add("owner-a", "token-a")
        store.add("owner-b", "token-b")
        val all = store.readAll()
        assertEquals(2, all.size)
        val owners = all.map { it.ownerId }.toSet()
        assertTrue(owners.contains("owner-a"))
        assertTrue(owners.contains("owner-b"))
    }

    @Test
    fun addDuplicateOwnerTokenResetsAttemptCount() {
        store.add("owner-a", "token-1")
        store.incrementAttemptCount("owner-a", "token-1")
        store.incrementAttemptCount("owner-a", "token-1")
        assertEquals(2, store.readAllForOwner("owner-a")[0].attemptCount)

        // Re-adding same owner+token must reset attempt count.
        store.add("owner-a", "token-1")
        assertEquals(1, store.readAll().size)
        assertEquals(0, store.readAllForOwner("owner-a")[0].attemptCount)
    }

    @Test
    fun removeOneEntryLeavesOtherIntact() {
        store.add("owner-a", "token-1")
        store.add("owner-b", "token-2")
        store.remove("owner-a", "token-1")
        val all = store.readAll()
        assertEquals(1, all.size)
        assertEquals("owner-b", all[0].ownerId)
    }

    @Test
    fun readAllForOwnerReturnsOnlyThatOwner() {
        store.add("owner-a", "token-1")
        store.add("owner-b", "token-2")
        val forA = store.readAllForOwner("owner-a")
        assertEquals(1, forA.size)
        assertEquals("owner-a", forA[0].ownerId)
    }

    @Test
    fun incrementAttemptCountUpdatesPersistedEntry() {
        store.add("owner-a", "token-1")
        store.incrementAttemptCount("owner-a", "token-1")
        store.incrementAttemptCount("owner-a", "token-1")
        assertEquals(2, store.readAllForOwner("owner-a")[0].attemptCount)
    }

    @Test
    fun pruneExpiredRemovesEntriesExceedingMaxAttempts() {
        store.add("owner-a", "token-1")
        repeat(PendingUnregisterStore.MAX_ATTEMPT_COUNT) {
            store.incrementAttemptCount("owner-a", "token-1")
        }
        store.pruneExpired()
        assertTrue(store.readAllForOwner("owner-a").isEmpty())
    }

    @Test
    fun pruneExpiredRemovesEntriesOlderThanMaxAge() {
        store.add("owner-a", "token-1")
        // Pass a nowMs that is MAX_AGE_MS + 1 second beyond addedAtMs (0).
        val futureNowMs = PendingUnregisterStore.MAX_AGE_MS + 1_000
        store.pruneExpired(nowMs = futureNowMs)
        assertTrue(store.readAllForOwner("owner-a").isEmpty())
    }

    @Test
    fun pruneExpiredKeepsRecentEntries() {
        store.add("owner-a", "token-1")
        store.pruneExpired()  // fresh entry, well within MAX_AGE_MS
        assertFalse(store.readAllForOwner("owner-a").isEmpty())
    }
}
