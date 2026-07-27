package co.uk.xdrivelogistics.driver

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class ActiveJobSelectionStore(context: Context) {
    private val appContext = context.applicationContext
    private val prefs: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            appContext,
            STORE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun readSelectedJobId(ownerUserId: String): String? =
        prefs.getString(key(ownerUserId), null)?.takeIf { it.isNotBlank() }

    fun saveSelectedJobId(ownerUserId: String, jobId: String) {
        if (ownerUserId.isBlank() || jobId.isBlank()) return
        prefs.edit().putString(key(ownerUserId), jobId).apply()
    }

    fun clearSelectedJobId(ownerUserId: String) {
        if (ownerUserId.isBlank()) return
        prefs.edit().remove(key(ownerUserId)).apply()
    }

    private fun key(ownerUserId: String): String = "selected_job_${ownerUserId.trim()}"

    private companion object {
        const val STORE_NAME = "xdrive_secure_active_job_selection"
    }
}
