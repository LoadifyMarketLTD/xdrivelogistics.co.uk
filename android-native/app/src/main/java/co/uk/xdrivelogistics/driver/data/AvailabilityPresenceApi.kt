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

data class AvailabilityPresence(
    val active: Boolean,
    val visibility: String = "private",
    val availableUntil: String? = null,
    val recordedAt: String? = null,
)

/**
 * Native pre-award availability client.
 *
 * This deliberately does not use TrackingService and does not publish into
 * driver_locations. Availability is opt-in, time-limited and handled only by
 * the XDrive server projection created for driver_availability_presence.
 */
class AvailabilityPresenceApi(
    private val xdriveBaseUrl: String,
) {
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun load(session: DriverSession): Result<AvailabilityPresence> = networkResult {
        val payload = requestJson(
            path = "/api/driver/availability-presence",
            accessToken = session.accessToken,
            method = "GET",
        )
        val active = payload.bool("active")
        val presence = payload.objectOrNull("presence")
        AvailabilityPresence(
            active = active,
            visibility = presence?.string("visibility").orEmpty().ifBlank { "private" },
            availableUntil = if (active) presence?.nullableString("available_until") else null,
            recordedAt = if (active) presence?.nullableString("recorded_at") else null,
        )
    }

    suspend fun start(
        session: DriverSession,
        lat: Double,
        lng: Double,
        visibility: String,
        hours: Int,
    ): Result<AvailabilityPresence> = networkResult {
        require(visibility in setOf("private", "fleet", "exchange")) { "Unsupported availability visibility." }
        require(hours in setOf(1, 4, 8)) { "Availability duration must be 1, 4 or 8 hours." }
        require(lat in -90.0..90.0 && lng in -180.0..180.0) { "Invalid location." }

        val body = JsonObject().apply {
            addProperty("lat", lat)
            addProperty("lng", lng)
            addProperty("visibility", visibility)
            addProperty("hours", hours)
        }
        val payload = requestJson(
            path = "/api/driver/availability-presence",
            accessToken = session.accessToken,
            method = "POST",
            body = body,
        )
        if (!payload.bool("ok")) error("Availability request was not acknowledged.")
        AvailabilityPresence(
            active = true,
            visibility = payload.string("visibility").ifBlank { visibility },
            availableUntil = payload.nullableString("available_until"),
            recordedAt = null,
        )
    }

    /** Refreshes coordinates only; server preserves visibility and available_until. */
    suspend fun refreshLocation(
        session: DriverSession,
        lat: Double,
        lng: Double,
    ): Result<String?> = networkResult {
        require(lat in -90.0..90.0 && lng in -180.0..180.0) { "Invalid location." }
        val body = JsonObject().apply {
            addProperty("lat", lat)
            addProperty("lng", lng)
        }
        val payload = requestJson(
            path = "/api/driver/availability-presence",
            accessToken = session.accessToken,
            method = "PUT",
            body = body,
        )
        if (!payload.bool("ok")) error("Availability refresh was not acknowledged.")
        payload.nullableString("available_until")
    }

    suspend fun stop(session: DriverSession): Result<Unit> = networkResult {
        val payload = requestJson(
            path = "/api/driver/availability-presence",
            accessToken = session.accessToken,
            method = "DELETE",
        )
        if (!payload.bool("ok")) error("Availability stop was not acknowledged.")
        Unit
    }

    private fun requestJson(
        path: String,
        accessToken: String,
        method: String,
        body: JsonObject? = null,
    ): JsonObject {
        require(xdriveBaseUrl.isNotBlank()) { "XDRIVE_BASE_URL is missing." }
        val builder = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}$path")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Accept", "application/json")

        when (method) {
            "GET" -> builder.get()
            "DELETE" -> builder.delete()
            "POST" -> builder
                .addHeader("Content-Type", "application/json")
                .post(gson.toJson(body ?: JsonObject()).toRequestBody(jsonMediaType))
            "PUT" -> builder
                .addHeader("Content-Type", "application/json")
                .put(gson.toJson(body ?: JsonObject()).toRequestBody(jsonMediaType))
            else -> error("Unsupported HTTP method")
        }

        return http.newCall(builder.build()).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = runCatching {
                    gson.fromJson(raw, JsonObject::class.java)?.get("error")?.asString
                }.getOrNull()
                throw IllegalStateException(message ?: "Availability request failed (${response.code}).")
            }
            if (raw.isBlank()) JsonObject() else gson.fromJson(raw, JsonObject::class.java) ?: JsonObject()
        }
    }

    private suspend fun <T> networkResult(block: () -> T): Result<T> =
        withContext(Dispatchers.IO) { runCatching(block) }

    private fun JsonObject.string(name: String): String {
        val value = get(name) ?: return ""
        return if (value.isJsonNull) "" else runCatching { value.asString }.getOrDefault("")
    }

    private fun JsonObject.nullableString(name: String): String? {
        val value = get(name) ?: return null
        return if (value.isJsonNull) null else runCatching { value.asString }.getOrNull()
    }

    private fun JsonObject.bool(name: String): Boolean {
        val value = get(name) ?: return false
        return if (value.isJsonNull) false else runCatching { value.asBoolean }.getOrDefault(false)
    }

    private fun JsonObject.objectOrNull(name: String): JsonObject? {
        val value = get(name) ?: return null
        if (value.isJsonNull || !value.isJsonObject) return null
        return value.asJsonObject
    }
}
