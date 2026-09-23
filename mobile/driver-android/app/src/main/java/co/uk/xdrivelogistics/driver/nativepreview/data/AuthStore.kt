package co.uk.xdrivelogistics.driver.nativepreview.data

import android.content.Context
import java.util.UUID

class AuthStore(context: Context) {
    private val prefs = context.getSharedPreferences("xdrive_native_preview", Context.MODE_PRIVATE)

    val installationId: String
        get() {
            val existing = prefs.getString("installation_id", null)
            if (!existing.isNullOrBlank()) return existing
            val created = UUID.randomUUID().toString()
            prefs.edit().putString("installation_id", created).apply()
            return created
        }

    val accessToken: String?
        get() = prefs.getString("access_token", null)?.takeIf { it.isNotBlank() }

    val refreshToken: String?
        get() = prefs.getString("refresh_token", null)?.takeIf { it.isNotBlank() }

    val signedIn: Boolean
        get() = accessToken != null

    fun saveSession(accessToken: String, refreshToken: String?) {
        prefs.edit()
            .putString("access_token", accessToken)
            .putString("refresh_token", refreshToken.orEmpty())
            .apply()
    }

    fun clearSession() {
        prefs.edit().remove("access_token").remove("refresh_token").apply()
    }

    fun readLoadsCache(): String? =
        prefs.getString("loads_cache_json", null)?.takeIf { it.isNotBlank() }

    fun writeLoadsCache(rawJson: String) {
        prefs.edit()
            .putString("loads_cache_json", rawJson)
            .putLong("loads_cache_saved_at", System.currentTimeMillis())
            .apply()
    }

    fun clearLoadsCache() {
        prefs.edit().remove("loads_cache_json").remove("loads_cache_saved_at").apply()
    }

    fun readSavedLoadIds(): Set<String> =
        prefs.getStringSet("saved_load_ids", emptySet())?.toSet().orEmpty()

    fun readDismissedLoadIds(): Set<String> =
        prefs.getStringSet("dismissed_load_ids", emptySet())?.toSet().orEmpty()

    fun setLoadSaved(loadId: String, saved: Boolean) {
        val next = readSavedLoadIds().toMutableSet()
        if (saved) next += loadId else next -= loadId
        prefs.edit().putStringSet("saved_load_ids", next).apply()
    }

    fun setLoadDismissed(loadId: String, dismissed: Boolean) {
        val next = readDismissedLoadIds().toMutableSet()
        if (dismissed) next += loadId else next -= loadId
        prefs.edit().putStringSet("dismissed_load_ids", next).apply()
    }
}
