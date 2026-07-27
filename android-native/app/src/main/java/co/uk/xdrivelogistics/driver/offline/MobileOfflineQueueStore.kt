package co.uk.xdrivelogistics.driver.offline

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

class MobileOfflineQueueStore(context: Context) {
    private val appContext = context.applicationContext
    private val gson = Gson()
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

    fun readAll(): List<MobileQueueItem> {
        val raw = preferences.getString(KEY_QUEUE_ITEMS, null).orEmpty()
        if (raw.isBlank()) return emptyList()
        return runCatching {
            val type = object : TypeToken<List<MobileQueueItem>>() {}.type
            gson.fromJson<List<MobileQueueItem>>(raw, type).orEmpty()
        }.getOrElse { emptyList() }
    }

    fun saveAll(items: List<MobileQueueItem>) {
        preferences.edit()
            .putString(KEY_QUEUE_ITEMS, gson.toJson(items))
            .apply()
    }

    private companion object {
        const val STORE_NAME = "xdrive_secure_mobile_offline_queue"
        const val KEY_QUEUE_ITEMS = "queue_items"
    }
}
