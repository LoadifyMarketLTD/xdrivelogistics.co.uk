package co.uk.xdrivelogistics.driver

import android.content.Context

enum class PendingAppDestination(val value: String) {
    MESSAGES("messages"),
    PROFILE("profile"),
    DOCUMENTS("documents");

    companion object {
        fun fromHost(host: String?): PendingAppDestination? = when (host?.lowercase()) {
            "notification" -> MESSAGES
            "profile" -> PROFILE
            "documents" -> DOCUMENTS
            else -> null
        }

        fun fromValue(value: String?): PendingAppDestination? = entries.firstOrNull { it.value == value }
    }
}

class PendingAppDestinationStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun save(destination: PendingAppDestination) {
        prefs.edit().putString(KEY_DESTINATION, destination.value).commit()
    }

    fun read(): PendingAppDestination? = PendingAppDestination.fromValue(prefs.getString(KEY_DESTINATION, null))

    fun clear() {
        prefs.edit().remove(KEY_DESTINATION).commit()
    }

    companion object {
        private const val PREFS = "xdrive_pending_app_destination"
        private const val KEY_DESTINATION = "destination"
    }
}
