package co.uk.xdrivelogistics.driver.data

import android.content.Context

class LoginPreferenceStore(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    val rememberMe: Boolean
        get() = prefs.getBoolean(KEY_REMEMBER_ME, true)

    fun setRememberMe(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_REMEMBER_ME, enabled).commit()
    }

    companion object {
        private const val PREFS_NAME = "xdrive_login_preferences"
        private const val KEY_REMEMBER_ME = "remember_me"
    }
}
