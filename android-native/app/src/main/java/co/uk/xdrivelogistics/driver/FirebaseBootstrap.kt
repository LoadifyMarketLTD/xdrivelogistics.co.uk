package co.uk.xdrivelogistics.driver

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

internal data class FirebaseRuntimeConfig(
    val projectId: String,
    val applicationId: String,
    val apiKey: String,
    val senderId: String,
)

internal fun firebaseRuntimeConfigFromBuildConfig(
    projectId: String = BuildConfig.FIREBASE_PROJECT_ID,
    applicationId: String = BuildConfig.FIREBASE_APPLICATION_ID,
    apiKey: String = BuildConfig.FIREBASE_API_KEY,
    senderId: String = BuildConfig.FIREBASE_SENDER_ID,
): FirebaseRuntimeConfig = FirebaseRuntimeConfig(
    projectId = projectId.trim(),
    applicationId = applicationId.trim(),
    apiKey = apiKey.trim(),
    senderId = senderId.trim(),
)

internal fun buildFirebaseOptionsOrNull(config: FirebaseRuntimeConfig): FirebaseOptions? {
    if (
        config.projectId.isBlank() ||
        config.applicationId.isBlank() ||
        config.apiKey.isBlank() ||
        config.senderId.isBlank()
    ) {
        return null
    }
    return FirebaseOptions.Builder()
        .setProjectId(config.projectId)
        .setApplicationId(config.applicationId)
        .setApiKey(config.apiKey)
        .setGcmSenderId(config.senderId)
        .build()
}

internal fun ensureFirebaseAppInitialized(
    context: Context,
    config: FirebaseRuntimeConfig = firebaseRuntimeConfigFromBuildConfig(),
): Boolean {
    if (FirebaseApp.getApps(context).isNotEmpty()) return true
    val options = buildFirebaseOptionsOrNull(config) ?: return false
    return FirebaseApp.initializeApp(context, options) != null
}
