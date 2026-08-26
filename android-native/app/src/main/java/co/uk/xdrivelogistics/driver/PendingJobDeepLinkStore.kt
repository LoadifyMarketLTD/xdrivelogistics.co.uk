package co.uk.xdrivelogistics.driver

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class PendingJobDeepLinkStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    val pendingJobIds: Flow<String?> = callbackFlow {
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
            if (key == KEY_JOB_ID || key == KEY_CREATED_AT) trySend(read())
        }
        prefs.registerOnSharedPreferenceChangeListener(listener)
        trySend(read())
        awaitClose { prefs.unregisterOnSharedPreferenceChangeListener(listener) }
    }

    fun save(jobId: String) {
        prefs.edit()
            .putString(KEY_JOB_ID, jobId)
            .putLong(KEY_CREATED_AT, System.currentTimeMillis())
            .apply()
    }

    fun read(): String? {
        val jobId = prefs.getString(KEY_JOB_ID, null)?.takeIf { it.isNotBlank() } ?: return null
        val createdAt = prefs.getLong(KEY_CREATED_AT, 0L)
        if (createdAt <= 0L || System.currentTimeMillis() - createdAt > MAX_AGE_MS) {
            clear()
            return null
        }
        return jobId
    }

    fun clear() {
        prefs.edit().remove(KEY_JOB_ID).remove(KEY_CREATED_AT).apply()
    }

    private companion object {
        const val PREFS = "xdrive_pending_deep_link"
        const val KEY_JOB_ID = "job_id"
        const val KEY_CREATED_AT = "created_at"
        const val MAX_AGE_MS = 15 * 60_000L
    }
}
