package co.uk.xdrivelogistics.driver.data

import android.content.Context

/**
 * Process-scoped native installation binding for the few low-level calls that
 * still use ApiClient directly (authentication refresh + job location publish).
 *
 * XDriveDriverApp initializes this once from the encrypted installation
 * identity. Sensitive driver API calls must fail closed if initialization did
 * not happen rather than sending an unbound bearer token.
 */
object NativeInstallationBinding {
    @Volatile
    private var installationId: String = ""

    fun initialize(context: Context) {
        installationId = DeviceInstallationIdentity(context.applicationContext).installationId.trim()
        require(installationId.isNotBlank()) { "Native installation identity is missing." }
    }

    fun requireInstallationId(): String = installationId
        .takeIf { it.isNotBlank() }
        ?: throw IllegalStateException("Native installation identity is not initialized.")
}
