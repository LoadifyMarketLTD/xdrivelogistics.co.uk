package co.uk.xdrivelogistics.driver.data

import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class PushRegistrationApi(private val xdriveBaseUrl: String) {
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun register(session: DriverSession, installationId: String, fcmToken: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            require(xdriveBaseUrl.isNotBlank()) { "XDrive API is not configured." }
            val body = JsonObject().apply {
                addProperty("token", fcmToken)
                addProperty("installation_id", installationId)
                addProperty("app_package", "co.uk.xdrivelogistics.driver")
            }
            val request = Request.Builder()
                .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/push-devices")
                .addHeader("Authorization", "Bearer ${session.accessToken}")
                .addHeader("Content-Type", "application/json")
                .post(gson.toJson(body).toRequestBody(jsonMediaType))
                .build()
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw IllegalStateException("Push registration failed (${response.code}).")
                }
            }
        }
    }

    suspend fun unregister(session: DriverSession, installationId: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val body = JsonObject().apply { addProperty("installation_id", installationId) }
            val request = Request.Builder()
                .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/push-devices")
                .addHeader("Authorization", "Bearer ${session.accessToken}")
                .addHeader("Content-Type", "application/json")
                .delete(gson.toJson(body).toRequestBody(jsonMediaType))
                .build()
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    throw IllegalStateException("Push unregistration failed (${response.code}).")
                }
            }
        }
    }
}
