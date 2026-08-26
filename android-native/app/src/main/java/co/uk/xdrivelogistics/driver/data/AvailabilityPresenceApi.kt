package co.uk.xdrivelogistics.driver.data

import co.uk.xdrivelogistics.driver.XDriveDriverApp
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class AvailabilityPresence(
    val active: Boolean,
    val visibility: String = "private",
    val availableUntil: String? = null,
    val recordedAt: String? = null,
)

class AvailabilityPresenceApi(
    private val xdriveBaseUrl: String,
    private val installationId: String,
) {
    constructor(xdriveBaseUrl: String) : this(
        xdriveBaseUrl,
        DeviceInstallationIdentity(XDriveDriverApp.instance.applicationContext).installationId,
    )

    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun load(session: DriverSession): Result<AvailabilityPresence> = networkResult {
        val payload = requestJson("/api/driver/availability-presence", session.accessToken, "GET")
        val active = payload.bool("active")
        val presence = payload.objectOrNull("presence")
        AvailabilityPresence(active, presence?.string("visibility").orEmpty().ifBlank { "private" }, if (active) presence?.nullableString("available_until") else null, if (active) presence?.nullableString("recorded_at") else null)
    }

    suspend fun start(session: DriverSession, lat: Double, lng: Double, visibility: String, hours: Int): Result<AvailabilityPresence> = networkResult {
        require(visibility in setOf("private", "fleet", "exchange")) { "Unsupported availability visibility." }
        require(hours in setOf(1, 4, 8)) { "Availability duration must be 1, 4 or 8 hours." }
        require(lat in -90.0..90.0 && lng in -180.0..180.0) { "Invalid location." }
        val body = JsonObject().apply { addProperty("lat", lat); addProperty("lng", lng); addProperty("visibility", visibility); addProperty("hours", hours) }
        val payload = requestJson("/api/driver/availability-presence", session.accessToken, "POST", body)
        if (!payload.bool("ok")) error("Availability request was not acknowledged.")
        AvailabilityPresence(true, payload.string("visibility").ifBlank { visibility }, payload.nullableString("available_until"), null)
    }

    suspend fun refreshLocation(session: DriverSession, lat: Double, lng: Double): Result<String?> = networkResult {
        require(lat in -90.0..90.0 && lng in -180.0..180.0) { "Invalid location." }
        val body = JsonObject().apply { addProperty("lat", lat); addProperty("lng", lng) }
        val payload = requestJson("/api/driver/availability-presence", session.accessToken, "PUT", body)
        if (!payload.bool("ok")) error("Availability refresh was not acknowledged.")
        payload.nullableString("available_until")
    }

    suspend fun stop(session: DriverSession): Result<Unit> = networkResult {
        val payload = requestJson("/api/driver/availability-presence", session.accessToken, "DELETE")
        if (!payload.bool("ok")) error("Availability stop was not acknowledged.")
        Unit
    }

    private fun requestJson(path: String, accessToken: String, method: String, body: JsonObject? = null): JsonObject {
        require(xdriveBaseUrl.isNotBlank()) { "XDRIVE_BASE_URL is missing." }
        require(installationId.isNotBlank()) { "Native installation identity is missing." }
        val builder = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}$path")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("X-XDrive-Installation-Id", installationId)
            .addHeader("Accept", "application/json")
        when (method) {
            "GET" -> builder.get()
            "DELETE" -> builder.delete()
            "POST" -> builder.addHeader("Content-Type", "application/json").post(gson.toJson(body ?: JsonObject()).toRequestBody(jsonMediaType))
            "PUT" -> builder.addHeader("Content-Type", "application/json").put(gson.toJson(body ?: JsonObject()).toRequestBody(jsonMediaType))
            else -> error("Unsupported HTTP method")
        }
        return http.newCall(builder.build()).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = runCatching { gson.fromJson(raw, JsonObject::class.java)?.get("error")?.asString }.getOrNull().orEmpty().ifBlank { "Availability request failed (${response.code})." }
                if ((response.code == 401 || response.code == 403) && message.isBindingMessage()) throw DeviceSessionException(response.code, message)
                throw IllegalStateException("HTTP ${response.code}: $message")
            }
            if (raw.isBlank()) JsonObject() else gson.fromJson(raw, JsonObject::class.java) ?: JsonObject()
        }
    }

    private fun String.isBindingMessage(): Boolean {
        val lower = lowercase()
        return "native device" in lower || "mobile session" in lower || "revoked or replaced" in lower || "device identity" in lower
    }
    private suspend fun <T> networkResult(block: () -> T): Result<T> = withContext(Dispatchers.IO) { runCatching(block) }
    private fun JsonObject.string(name: String) = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asString }.getOrDefault("") } ?: ""
    private fun JsonObject.nullableString(name: String) = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asString }.getOrNull() }
    private fun JsonObject.bool(name: String) = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asBoolean }.getOrDefault(false) } ?: false
    private fun JsonObject.objectOrNull(name: String): JsonObject? = get(name)?.takeIf { it.isJsonObject }?.asJsonObject
}
