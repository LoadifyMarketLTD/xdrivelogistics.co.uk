package co.uk.xdrivelogistics.driver.data

import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

data class TrackingState(
    val shouldTrack: Boolean,
    val jobId: String? = null,
    val status: String? = null,
    val reason: String? = null,
)

class TrackingStateApi(
    private val xdriveBaseUrl: String,
) {
    private val gson = Gson()
    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun load(accessToken: String): Result<TrackingState> = withContext(Dispatchers.IO) {
        runCatching {
            require(xdriveBaseUrl.isNotBlank()) { "XDRIVE_BASE_URL is missing." }
            val request = Request.Builder()
                .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/tracking-state")
                .addHeader("Authorization", "Bearer $accessToken")
                .addHeader("Accept", "application/json")
                .get()
                .build()

            http.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    val message = runCatching {
                        gson.fromJson(raw, JsonObject::class.java)?.get("error")?.asString
                    }.getOrNull()
                    throw IllegalStateException(message ?: "Tracking state request failed (${response.code}).")
                }
                val payload = if (raw.isBlank()) JsonObject() else gson.fromJson(raw, JsonObject::class.java) ?: JsonObject()
                TrackingState(
                    shouldTrack = payload.bool("should_track"),
                    jobId = payload.stringOrNull("job_id"),
                    status = payload.stringOrNull("status"),
                    reason = payload.stringOrNull("reason"),
                )
            }
        }
    }

    private fun JsonObject.bool(name: String): Boolean {
        val value = get(name) ?: return false
        return if (value.isJsonNull) false else runCatching { value.asBoolean }.getOrDefault(false)
    }

    private fun JsonObject.stringOrNull(name: String): String? {
        val value = get(name) ?: return null
        return if (value.isJsonNull) null else runCatching { value.asString }.getOrNull()?.takeIf { it.isNotBlank() }
    }
}
