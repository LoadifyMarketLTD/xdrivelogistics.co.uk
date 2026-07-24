package co.uk.xdrivelogistics.driver

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class PendingLocationStore(context: Context) {
    private val appContext = context.applicationContext
    private val preferences: SharedPreferences by lazy {
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

    fun save(location: PendingLocation) {
        preferences.edit()
            .putString(KEY_LATITUDE, location.latitude.toString())
            .putString(KEY_LONGITUDE, location.longitude.toString())
            .putLong(KEY_CAPTURED_AT, location.capturedAtEpochMs)
            .apply()
    }

    fun read(): PendingLocation? {
        val latitude = preferences.getString(KEY_LATITUDE, null)?.toDoubleOrNull() ?: return null
        val longitude = preferences.getString(KEY_LONGITUDE, null)?.toDoubleOrNull() ?: return null
        val capturedAt = preferences.getLong(KEY_CAPTURED_AT, 0L)
        return PendingLocation(latitude, longitude, capturedAt)
    }

    fun clear() {
        preferences.edit().clear().apply()
    }

    private companion object {
        const val STORE_NAME = "xdrive_secure_pending_location"
        const val KEY_LATITUDE = "latitude"
        const val KEY_LONGITUDE = "longitude"
        const val KEY_CAPTURED_AT = "captured_at"
    }
}
