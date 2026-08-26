package co.uk.xdrivelogistics.driver.data

import android.content.Context
import java.util.UUID

class DeviceInstallationIdentity(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    val installationId: String
        get() {
            val existing = prefs.getString(KEY_INSTALLATION_ID, null)
                ?.takeIf { runCatching { UUID.fromString(it) }.isSuccess }
            if (existing != null) return existing
            return UUID.randomUUID().toString().also {
                prefs.edit().putString(KEY_INSTALLATION_ID, it).commit()
            }
        }

    companion object {
        const val PREFS_NAME = "xdrive_push_installation"
        const val KEY_INSTALLATION_ID = "installation_id"
    }
}
