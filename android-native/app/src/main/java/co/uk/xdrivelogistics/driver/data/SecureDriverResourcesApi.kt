package co.uk.xdrivelogistics.driver.data

import android.util.Base64
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class DriverResourceBundle(
    val profile: DriverProfile,
    val documents: List<DriverDocument>,
    val notifications: List<DriverNotification>,
    val returnJourney: DriverReturnJourney?,
    val invoices: List<DriverInvoice>,
    val nearbyDrivers: List<NearbyDriver>,
    val jobSearchPreferences: Map<String, String>,
)

class SecureDriverResourcesApi(
    private val xdriveBaseUrl: String,
    private val installationId: String,
) {
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .callTimeout(25, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .build()

    suspend fun load(session: DriverSession): Result<DriverResourceBundle> = networkResult {
        val root = executeJson(getRequest(session.accessToken), "Failed to load driver resources.")
        val resources = root.getAsJsonObject("resources") ?: error("Driver resources response is incomplete.")
        val profileRow = resources.getAsJsonObject("profile") ?: error("Driver profile is missing.")
        val profile = DriverProfile(
            driverId = profileRow.string("driver_id"),
            companyId = profileRow.string("company_id"),
            vehicleId = profileRow.nullableString("vehicle_id"),
            displayName = profileRow.string("display_name"),
            email = profileRow.string("email").ifBlank { session.email },
            vehicleLabel = profileRow.string("vehicle_label"),
            vehicleRegistration = profileRow.string("vehicle_registration"),
        )
        require(profile.driverId.isNotBlank() && profile.companyId.isNotBlank()) { "Driver profile fields are incomplete." }

        DriverResourceBundle(
            profile = profile,
            documents = resources.array("documents").mapObjects { row ->
                DriverDocument(
                    id = row.string("id"),
                    docType = row.string("doc_type"),
                    status = row.string("status"),
                    createdAt = row.nullableString("created_at"),
                    expiryDate = row.nullableString("expiry_date"),
                    isVehicleDocument = row.booleanOrNull("is_vehicle_document") == true,
                )
            },
            notifications = resources.array("notifications").mapObjects { row ->
                DriverNotification(
                    id = row.string("id"),
                    title = row.string("title").ifBlank { row.string("type").ifBlank { "Alert" } },
                    body = row.string("body"),
                    type = row.string("type"),
                    readAt = row.nullableString("read_at"),
                    createdAt = row.nullableString("created_at"),
                )
            },
            returnJourney = resources.get("return_journey")?.takeUnless { it.isJsonNull }?.asJsonObject?.let { row ->
                DriverReturnJourney(row.string("id"), row.string("from_location"), row.string("to_location"), row.nullableString("available_date"))
            },
            invoices = resources.array("invoices").mapObjects { row ->
                DriverInvoice(
                    id = row.string("id"),
                    invoiceNumber = row.string("invoice_number").ifBlank { row.string("id").take(8).uppercase() },
                    status = row.string("payment_status").ifBlank { row.string("status") },
                    amount = row.doubleOrNull("total") ?: row.doubleOrNull("amount"),
                    currency = row.string("currency").ifBlank { "GBP" },
                    clientName = row.string("client_name"),
                    dueDate = row.nullableString("due_date"),
                )
            },
            nearbyDrivers = resources.array("nearby_drivers").mapObjects { row ->
                NearbyDriver(
                    driverId = row.string("driver_id"),
                    driverName = row.string("driver_name").ifBlank { "Driver" },
                    vehicleLabel = row.string("vehicle_label").ifBlank { "Vehicle TBC" },
                    lat = row.doubleOrNull("lat"),
                    lng = row.doubleOrNull("lng"),
                    recordedAt = row.nullableString("recorded_at"),
                )
            },
            jobSearchPreferences = buildMap {
                resources.array("job_search_preferences").mapObjects { row -> row }.forEach { row ->
                    val jobId = row.string("job_id")
                    val state = row.string("state")
                    if (jobId.isNotBlank() && state.isNotBlank()) put(jobId, state)
                }
            },
        )
    }

    suspend fun markNotificationRead(session: DriverSession, notificationId: String): Result<Unit> =
        action(session, JsonObject().apply { addProperty("action", "mark_notification_read"); addProperty("notificationId", notificationId) })

    suspend fun deleteNotification(session: DriverSession, notificationId: String): Result<Unit> =
        action(session, JsonObject().apply { addProperty("action", "delete_notification"); addProperty("notificationId", notificationId) })

    suspend fun saveReturnJourney(session: DriverSession, fromLocation: String, toLocation: String, availableDate: String): Result<Unit> =
        action(session, JsonObject().apply {
            addProperty("action", "save_return_journey")
            addProperty("fromLocation", fromLocation)
            addProperty("toLocation", toLocation)
            if (availableDate.isNotBlank()) addProperty("availableDate", availableDate)
        })

    suspend fun setJobSearchPreference(session: DriverSession, jobId: String, state: String?): Result<Unit> =
        action(session, JsonObject().apply {
            addProperty("action", "set_job_preference")
            addProperty("jobId", jobId)
            if (state == null) add("state", null) else addProperty("state", state)
        })

    suspend fun uploadComplianceDocument(
        session: DriverSession,
        docType: String,
        isVehicleDocument: Boolean,
        fileName: String,
        mimeType: String,
        bytes: ByteArray,
    ): Result<Unit> {
        require(bytes.isNotEmpty()) { "Selected document is empty." }
        require(bytes.size <= 10 * 1024 * 1024) { "Document must be 10 MB or smaller." }
        val normalizedMime = mimeType.substringBefore(';').trim().lowercase()
        require(normalizedMime in setOf("application/pdf", "image/jpeg", "image/png", "image/webp")) { "Use a PDF, JPG, PNG or WEBP document." }
        return action(session, JsonObject().apply {
            addProperty("action", "upload_document")
            addProperty("docType", docType)
            addProperty("isVehicleDocument", isVehicleDocument)
            addProperty("fileName", fileName)
            addProperty("mimeType", normalizedMime)
            addProperty("base64", Base64.encodeToString(bytes, Base64.NO_WRAP))
        })
    }

    private suspend fun action(session: DriverSession, body: JsonObject): Result<Unit> = networkResult {
        val request = baseRequest(session.accessToken)
            .addHeader("Content-Type", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        val payload = executeJson(request, "Driver action failed.")
        if (payload.get("ok")?.takeUnless { it.isJsonNull }?.asBoolean != true) error("Driver action was not acknowledged.")
    }

    private fun getRequest(accessToken: String): Request = baseRequest(accessToken).get().build()

    private fun baseRequest(accessToken: String): Request.Builder {
        require(xdriveBaseUrl.isNotBlank()) { "XDRIVE_BASE_URL is missing." }
        require(installationId.isNotBlank()) { "Native installation identity is missing." }
        return Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/resources")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("X-XDrive-Installation-Id", installationId)
            .addHeader("Accept", "application/json")
    }

    private fun executeJson(request: Request, fallback: String): JsonObject = http.newCall(request).execute().use { response ->
        val raw = response.body?.string().orEmpty()
        if (!response.isSuccessful) {
            val message = runCatching { gson.fromJson(raw, JsonObject::class.java)?.get("error")?.asString }.getOrNull().orEmpty().ifBlank { fallback }
            if ((response.code == 401 || response.code == 403) && message.isBindingMessage()) throw DeviceSessionException(response.code, message)
            throw IllegalStateException("HTTP ${response.code}: $message")
        }
        if (raw.isBlank()) JsonObject() else gson.fromJson(raw, JsonObject::class.java) ?: JsonObject()
    }

    private fun String.isBindingMessage(): Boolean {
        val lower = lowercase()
        return "native device" in lower || "mobile session" in lower || "revoked or replaced" in lower || "device identity" in lower
    }
    private suspend fun <T> networkResult(block: () -> T): Result<T> = withContext(Dispatchers.IO) { runCatching(block) }
    private fun JsonObject.array(name: String): JsonArray = getAsJsonArray(name) ?: JsonArray()
    private fun <T> JsonArray.mapObjects(block: (JsonObject) -> T): List<T> = buildList {
        for (index in 0 until size()) {
            val element = get(index)
            if (element is JsonObject) add(block(element))
        }
    }
    private fun JsonObject.string(name: String): String = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asString }.getOrDefault("") } ?: ""
    private fun JsonObject.nullableString(name: String): String? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asString }.getOrNull() }
    private fun JsonObject.doubleOrNull(name: String): Double? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asDouble }.getOrNull() }
    private fun JsonObject.booleanOrNull(name: String): Boolean? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asBoolean }.getOrNull() }
}
