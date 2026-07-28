package co.uk.xdrivelogistics.driver

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * A single pending FCM device-token unregister entry.
 *
 * @param ownerId       The user ID that owns this token.
 * @param token         The FCM registration token to unregister from the server.
 * @param installationId Stable per-install identifier used by server-side ordering checks.
 * @param generation    Registration generation that was accepted for this token/installation.
 * @param addedAtMs     Epoch-milliseconds when this entry was first recorded.
 * @param attemptCount  Number of unregister attempts that have been made so far.
 */
data class PendingUnregister(
    val ownerId: String,
    val token: String,
    val installationId: String,
    val generation: Long,
    val addedAtMs: Long = 0L,
    val attemptCount: Int = 0,
)

/**
 * Durable multi-entry store for failed FCM device-token unregistrations.
 *
 * Each failed logout-time server unregister is appended as a separate entry.
 * Entries for different owners or tokens do **not** overwrite each other, so
 * a second failed logout for a different owner preserves the first unresolved
 * invalidation.
 *
 * Bounded retry: entries are pruned automatically after [MAX_ATTEMPT_COUNT]
 * failed attempts or after [MAX_AGE_MS] (7 days) to prevent indefinite growth.
 *
 * Thread-safety: all mutations are serialised under a lock so concurrent calls
 * from the ViewModel coroutine and a logout path cannot interleave.
 */
class PendingUnregisterStore(context: Context) {
    private val appContext = context.applicationContext
    private val gson = Gson()
    private val lock = Any()
    private val prefs: SharedPreferences by lazy { buildPrefs() }

    // ── Write operations ─────────────────────────────────────────────────────

    /**
     * Appends a new pending-unregister entry for [ownerId] + [token] + installation/generation.
     *
     * If an entry for the same owner+token already exists it is replaced (to
     * reset [PendingUnregister.addedAtMs] and [PendingUnregister.attemptCount]).
     */
    fun add(ownerId: String, token: String, installationId: String, generation: Long) {
        if (ownerId.isBlank() || token.isBlank() || installationId.isBlank() || generation <= 0L) return
        synchronized(lock) {
            val current = readAllInternal().toMutableList()
            current.removeAll {
                it.ownerId == ownerId &&
                    it.token == token &&
                    it.installationId == installationId &&
                    it.generation == generation
            }
            current.add(
                PendingUnregister(
                    ownerId = ownerId,
                    token = token,
                    installationId = installationId,
                    generation = generation,
                    addedAtMs = System.currentTimeMillis(),
                )
            )
            persist(current)
        }
    }

    /**
     * Removes the entry matching [ownerId] + [token].
     * No-op if the entry does not exist.
     */
    fun remove(ownerId: String, token: String, installationId: String, generation: Long) {
        synchronized(lock) {
            val current = readAllInternal().toMutableList()
            if (current.removeAll {
                    it.ownerId == ownerId &&
                        it.token == token &&
                        it.installationId == installationId &&
                        it.generation == generation
                }
            ) {
                persist(current)
            }
        }
    }

    /**
     * Increments [PendingUnregister.attemptCount] for the entry matching [ownerId] + [token].
     * No-op if the entry does not exist.
     */
    fun incrementAttemptCount(ownerId: String, token: String, installationId: String, generation: Long) {
        synchronized(lock) {
            val current = readAllInternal().toMutableList()
            val idx = current.indexOfFirst {
                it.ownerId == ownerId &&
                    it.token == token &&
                    it.installationId == installationId &&
                    it.generation == generation
            }
            if (idx >= 0) {
                current[idx] = current[idx].copy(attemptCount = current[idx].attemptCount + 1)
                persist(current)
            }
        }
    }

    // ── Read operations ──────────────────────────────────────────────────────

    /**
     * Returns all stored entries (across all owners), unfiltered.
     * Callers should normally use [readAllForOwner] to scope to the current session.
     */
    fun readAll(): List<PendingUnregister> = synchronized(lock) { readAllInternal() }

    /**
     * Returns all stored entries whose [PendingUnregister.ownerId] matches [ownerId].
     */
    fun readAllForOwner(ownerId: String): List<PendingUnregister> =
        readAll().filter {
            it.ownerId == ownerId &&
                it.token.isNotBlank() &&
                it.installationId.isNotBlank() &&
                it.generation > 0L
        }

    // ── Maintenance ──────────────────────────────────────────────────────────

    /**
     * Removes entries that have exceeded [MAX_AGE_MS] or [MAX_ATTEMPT_COUNT].
     * Call this at the start of each flush pass to bound store growth.
     */
    fun pruneExpired(nowMs: Long = System.currentTimeMillis()) {
        synchronized(lock) {
            val current = readAllInternal()
            val pruned = current.filter { entry ->
                entry.attemptCount < MAX_ATTEMPT_COUNT &&
                    (nowMs - entry.addedAtMs) < MAX_AGE_MS
            }
            if (pruned.size != current.size) persist(pruned)
        }
    }

    // ── Internal helpers ─────────────────────────────────────────────────────

    private fun readAllInternal(): List<PendingUnregister> {
        val json = prefs.getString(KEY_ENTRIES, null) ?: return emptyList()
        val type = object : TypeToken<List<PendingUnregister>>() {}.type
        return runCatching { gson.fromJson<List<PendingUnregister>>(json, type) }
            .getOrNull()
            ?.filterNotNull()
            ?: emptyList()
    }

    private fun persist(entries: List<PendingUnregister>) {
        prefs.edit().putString(KEY_ENTRIES, gson.toJson(entries)).apply()
    }

    private fun buildPrefs(): SharedPreferences {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            appContext,
            STORE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    companion object {
        internal const val STORE_NAME = "xdrive_secure_pending_unregister"
        private const val KEY_ENTRIES = "entries"
        /** Maximum number of unregister attempts before an entry is pruned. */
        const val MAX_ATTEMPT_COUNT = 5
        /** Maximum age of a pending entry before it is pruned (7 days). */
        const val MAX_AGE_MS = 7L * 24 * 60 * 60 * 1_000
    }
}
