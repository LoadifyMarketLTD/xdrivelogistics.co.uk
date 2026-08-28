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
    val returnJourneys: List<DriverReturnJourney>,
    val invoices: List<DriverInvoice>,
    val nearbyDrivers: List<NearbyDriver>,
    val jobSearchPreferences: Map<String, String>,
    val alertPreferences: DriverAlertPreferences,
    val searchDefaults: DriverSearchDefaults,
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
            payloadKg = profileRow.doubleOrNull("payload_kg"),
            palletsCapacity = profileRow.intOrNull("pallets_capacity"),
        )
        require(profile.driverId.isNotBlank() && profile.companyId.isNotBlank()) { "Driver profile fields are incomplete." }

        fun parseJourney(row: JsonObject): DriverReturnJourney = DriverReturnJourney(
            id = row.string("id"),
            fromLocation = row.string("from_postcode").ifBlank { row.string("from_location") },
            toLocation = row.string("to_postcode").ifBlank { row.string("to_location") },
            availableDate = row.nullableString("available_from") ?: row.nullableString("available_date"),
            mode = row.string("journey_mode").ifBlank { "going_home" },
            goAnywhere = row.booleanOrNull("go_anywhere") == true,
            viaLocation = row.string("via_location"),
            journeyEta = row.nullableString("journey_eta"),
            capacityStatus = row.string("capacity_status"),
            weightAvailableKg = row.doubleOrNull("weight_available_kg"),
            palletSpaceAvailable = row.intOrNull("pallet_space_available"),
            status = row.string("status").ifBlank { "available" },
        )

        val journeys = resources.array("return_journeys").mapObjects(::parseJourney)
        val activeJourney = resources.get("return_journey")?.takeUnless { it.isJsonNull }?.asJsonObject?.let(::parseJourney)
        val alertRow = resources.getAsJsonObject("alert_preferences") ?: JsonObject()
        val searchDefaultsRow = resources.getAsJsonObject("search_filter_defaults") ?: JsonObject()

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
            returnJourney = activeJourney,
            returnJourneys = journeys,
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
            alertPreferences = DriverAlertPreferences(
                pushEnabled = alertRow.booleanOrNull("push_enabled") ?: true,
                soundEnabled = alertRow.booleanOrNull("sound_enabled") ?: true,
                headsUpEnabled = alertRow.booleanOrNull("heads_up_enabled") ?: true,
                marketplaceEnabled = alertRow.booleanOrNull("marketplace_enabled") ?: true,
                quoteEnabled = alertRow.booleanOrNull("quote_enabled") ?: true,
                bookingEnabled = alertRow.booleanOrNull("booking_enabled") ?: true,
                operationalEnabled = alertRow.booleanOrNull("operational_enabled") ?: true,
            ),
            searchDefaults = DriverSearchDefaults(
                values = buildMap {
                    for ((key, element) in searchDefaultsRow.entrySet()) {
                        if (!element.isJsonNull) put(key, runCatching { element.asString }.getOrDefault(element.toString()))
                    }
                },
            ),
        )
    }

    suspend fun markNotificationRead(session: DriverSession, notificationId: String): Result<Unit> =
        action(session, JsonObject().apply { addProperty("action", "mark_notification_read"); addProperty("notificationId", notificationId) })

    suspend fun deleteNotification(session: DriverSession, notificationId: String): Result<Unit> =
        action(session, JsonObject().apply { addProperty("action", "delete_notification"); addProperty("notificationId", notificationId) })

    suspend fun saveReturnJourney(
        session: DriverSession,
        mode: String,
        goAnywhere: Boolean,
        fromLocation: String,
        toLocation: String,
        viaLocation: String,
        availableDate: String,
        journeyEta: String,
        capacityStatus: String,
        weightAvailableKg: Double?,
        palletSpaceAvailable: Int?,
    ): Result<Unit> = action(session, JsonObject().apply {
        addProperty("action", "save_return_journey")
        addProperty("mode", mode)
        addProperty("goAnywhere", goAnywhere)
        addProperty("fromLocation", fromLocation)
        addProperty("toLocation", toLocation)
        addProperty("viaLocation", viaLocation)
        if (availableDate.isNotBlank()) addProperty("availableDate", availableDate)
        if (journeyEta.isNotBlank()) addProperty("journeyEta", journeyEta)
        addProperty("capacityStatus", capacityStatus)
        if (weightAvailableKg != null) addProperty("weightAvailableKg", weightAvailableKg)
        if (palletSpaceAvailable != null) addProperty("palletSpaceAvailable", palletSpaceAvailable)
    })

    suspend fun saveAlertPreferences(session: DriverSession, preferences: DriverAlertPreferences): Result<Unit> =
        action(session, JsonObject().apply {
            addProperty("action", "save_alert_preferences")
            addProperty("pushEnabled", preferences.pushEnabled)
            addProperty("soundEnabled", preferences.soundEnabled)
            addProperty("headsUpEnabled", preferences.headsUpEnabled)
            addProperty("marketplaceEnabled", preferences.marketplaceEnabled)
            addProperty("quoteEnabled", preferences.quoteEnabled)
            addProperty("bookingEnabled", preferences.bookingEnabled)
            addProperty("operationalEnabled", preferences.operationalEnabled)
        })

    suspend fun saveSearchDefaults(session: DriverSession, values: Map<String, String>): Result<Unit> =
        action(session, JsonObject().apply {
            addProperty("action", "save_search_filter_defaults")
            val filters = JsonObject()
            values.forEach { (key, value) -> filters.addProperty(key, value) }
            add("filters", filters)
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
        for (index in 0 until size()) get(index).takeIf { it.isJsonObject }?.asJsonObject?.let { add(block(it)) }
    }
    private fun JsonObject.string(name: String): String = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asString }.getOrDefault("") } ?: ""
    private fun JsonObject.nullableString(name: String): String? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asString }.getOrNull() }
    private fun JsonObject.doubleOrNull(name: String): Double? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asDouble }.getOrNull() }
    private fun JsonObject.intOrNull(name: String): Int? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asInt }.getOrNull() }
    private fun JsonObject.booleanOrNull(name: String): Boolean? = get(name)?.takeUnless { it.isJsonNull }?.let { runCatching { it.asBoolean }.getOrNull() }
}
