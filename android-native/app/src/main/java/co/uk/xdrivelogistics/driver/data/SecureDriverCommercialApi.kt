package co.uk.xdrivelogistics.driver.data

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

data class DriverPodUpload(
    val objectPath: String,
    val kind: String,
)

/**
 * Security boundary for Android commercial/Marketplace and execution traffic.
 *
 * Pre-award job rows must never be read directly from Supabase because the
 * underlying jobs table contains execution-only addresses, contacts and refs.
 * Critical driver mutations also stay behind XDrive server boundaries so the
 * native app shares the same lifecycle, POD and storage contract as web.
 */
class SecureDriverCommercialApi(
    private val xdriveBaseUrl: String,
) {
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val http = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun loadDriverBids(session: DriverSession): Result<List<DriverBid>> = networkResult {
        val payload = getJson("/api/driver/mobile/bids", session.accessToken)
        val rows = payload.getAsJsonArray("bids") ?: JsonArray()
        buildList {
            for (index in 0 until rows.size()) {
                val row = rows[index].asJsonObject
                add(
                    DriverBid(
                        id = row.string("id"),
                        jobId = row.string("jobId"),
                        amount = row.doubleOrNull("amount"),
                        currency = row.string("currency").ifBlank { "GBP" },
                        status = row.string("status").ifBlank { "submitted" },
                        message = row.string("message"),
                        createdAt = row.nullableString("createdAt"),
                        pickupLocation = row.string("pickupLocation").ifBlank { "Collection area" },
                        deliveryLocation = row.string("deliveryLocation").ifBlank { "Delivery area" },
                        pickupDatetime = row.nullableString("pickupDatetime"),
                        clientName = row.string("clientName"),
                    )
                )
            }
        }
    }

    suspend fun loadDriverJobs(session: DriverSession): Result<List<DriverJob>> = networkResult {
        val assignedPayload = getJson("/api/driver/mobile/jobs?scope=all&limit=100", session.accessToken)
        val assignedRows = assignedPayload.getAsJsonArray("jobs") ?: JsonArray()
        val assigned = buildList {
            for (index in 0 until assignedRows.size()) {
                add(mapAssignedJob(assignedRows[index].asJsonObject))
            }
        }

        val nearbyPayload = getJson("/api/driver/mobile/nearby-jobs?limit=100", session.accessToken)
        val nearbyRows = nearbyPayload.getAsJsonArray("jobs") ?: JsonArray()
        val nearby = buildList {
            for (index in 0 until nearbyRows.size()) {
                add(mapMarketplaceJob(nearbyRows[index].asJsonObject))
            }
        }

        val assignedIds = assigned.mapTo(mutableSetOf()) { it.id }
        return@networkResult (assigned + nearby.filterNot { it.id in assignedIds })
            .sortedWith(compareBy<DriverJob> { it.isPosted() }.thenBy { it.pickupDatetime ?: "" })
    }

    suspend fun submitJobQuote(
        session: DriverSession,
        jobId: String,
        amount: Double,
        message: String,
    ): Result<Unit> = networkResult {
        requireBaseUrl()
        val body = JsonObject().apply {
            addProperty("jobId", jobId)
            addProperty("amount", amount)
            addProperty("message", message.ifBlank { "Submitted from XDrive Driver Android" })
        }
        postJson(
            path = "/api/driver/mobile/bids",
            accessToken = session.accessToken,
            body = body,
            fallbackError = "Failed to submit quote.",
        )
    }

    suspend fun moveDriverJob(
        session: DriverSession,
        jobId: String,
        nextStatus: String,
        collectionPhotoUrl: String? = null,
    ): Result<Unit> = networkResult {
        val action = when (nextStatus.trim().lowercase()) {
            "on_my_way" -> "on-my-way-pickup"
            "on_site_pickup" -> "arrived-pickup"
            "loaded" -> "loaded"
            "in_transit" -> "on-my-way-delivery"
            "on_site_delivery" -> "arrived-delivery"
            "delivered" -> "delivered"
            "completed" -> "completed"
            else -> throw IllegalArgumentException("Unsupported driver lifecycle status: $nextStatus")
        }
        val body = JsonObject().apply {
            collectionPhotoUrl?.trim()?.takeIf { it.isNotBlank() }?.let {
                addProperty("collectionPhotoUrl", it)
            }
        }
        postJson(
            path = "/api/driver/mobile/jobs/$jobId/$action",
            accessToken = session.accessToken,
            body = body,
            fallbackError = "Failed to update job status.",
        )
    }

    suspend fun uploadPodEvidence(
        session: DriverSession,
        jobId: String,
        fileName: String,
        mimeType: String,
        bytes: ByteArray,
    ): Result<DriverPodUpload> = networkResult {
        requireBaseUrl()
        require(bytes.isNotEmpty()) { "Selected POD file is empty." }

        val normalizedType = mimeType.substringBefore(';').trim().lowercase()
        val kind = when (normalizedType) {
            "image/jpeg", "image/png", "image/webp" -> "photo"
            "application/pdf" -> "document"
            else -> throw IllegalArgumentException("POD files must be JPEG, PNG, WebP or PDF.")
        }
        val safeName = fileName
            .replace(Regex("[^a-zA-Z0-9._-]"), "_")
            .replace(Regex("_+"), "_")
            .take(120)
            .ifBlank { if (kind == "photo") "pod-photo.jpg" else "pod-document.pdf" }

        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/jobs/$jobId/pod-upload?kind=$kind")
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Accept", "application/json")
            .addHeader("X-File-Name", safeName)
            .post(bytes.toRequestBody(normalizedType.toMediaType()))
            .build()

        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw IllegalStateException(extractError(raw, "Failed to upload POD evidence."))
            }
            val payload = runCatching { gson.fromJson(raw, JsonObject::class.java) }.getOrNull()
                ?: throw IllegalStateException("POD upload response was invalid.")
            val objectPath = payload.string("objectPath")
            val responseKind = payload.string("kind")
            if (objectPath.isBlank() || responseKind !in setOf("photo", "document")) {
                throw IllegalStateException("POD upload response is missing the stored object path.")
            }
            DriverPodUpload(objectPath = objectPath, kind = responseKind)
        }
    }

    suspend fun savePod(
        session: DriverSession,
        jobId: String,
        recipientName: String,
        signatureData: String,
        photoUris: List<String>,
        documentUris: List<String>,
    ): Result<Unit> = networkResult {
        val body = JsonObject().apply {
            addProperty("recipientName", recipientName.trim())
            addProperty("signatureData", signatureData.trim())
            add("photoUris", gson.toJsonTree(photoUris.distinct()))
            add("documentUris", gson.toJsonTree(documentUris.distinct()))
        }
        postJson(
            path = "/api/driver/mobile/jobs/$jobId/pod",
            accessToken = session.accessToken,
            body = body,
            fallbackError = "Failed to save POD evidence.",
        )
    }

    private fun mapAssignedJob(row: JsonObject): DriverJob {
        val lifecycleStatus = row.string("lifecycleStatus").ifBlank { row.string("status") }
        val currentStatus = row.string("currentStatus").ifBlank { row.string("status") }
        return DriverJob(
            id = row.string("id"),
            status = lifecycleStatus,
            currentStatus = currentStatus,
            pickupLocation = row.string("pickupLocation"),
            deliveryLocation = row.string("deliveryLocation"),
            pickupDatetime = row.nullableString("pickupTime"),
            deliveryDatetime = row.nullableString("deliveryTime"),
            clientName = row.string("clientName"),
            clientPhone = row.string("clientPhone"),
            vehicleType = row.string("vehicleType").ifBlank { row.string("vehicleRequirement") },
            cargoType = row.string("cargoType"),
            budgetAmount = row.doubleOrNull("budgetAmount"),
            loadDetails = row.string("loadDetails").ifBlank { row.string("requirements") },
            pickupPostcode = row.string("pickupPostcode"),
            deliveryPostcode = row.string("deliveryPostcode"),
            distanceMiles = row.doubleOrNull("distanceMiles"),
            deliveryPhotos = row.stringArray("deliveryPhotos"),
            podPhotos = row.stringArray("podPhotos"),
            collectionPhotoUrl = row.nullableString("collectionPhotoUrl"),
            deliverySignatureData = row.get("deliverySignatureData")
                ?.takeUnless { it.isJsonNull }
                ?.let { element ->
                    if (element.isJsonPrimitive && element.asJsonPrimitive.isString) element.asString else gson.toJson(element)
                },
            clientSignatureName = row.string("clientSignatureName"),
            podRequired = row.booleanOrNull("podRequired") ?: true,
        )
    }

    private fun mapMarketplaceJob(row: JsonObject): DriverJob {
        val pickup = row.getAsJsonObject("pickup")
        val delivery = row.getAsJsonObject("delivery")
        val price = row.getAsJsonObject("publicPrice")
        val poster = row.getAsJsonObject("poster")
        val proposed = row.doubleOrNull("proposedPriceGbp") ?: price?.doubleOrNull("amount")
        val marketplaceStatus = row.string("status").ifBlank { "posted" }
        val safeDetails = buildList {
            row.doubleOrNull("weightKg")?.let { add("Weight: ${it.toInt()} kg") }
            row.doubleOrNull("pallets")?.let { add("Pallets: ${it.toInt()}") }
            row.string("notesSummary").takeIf { it.isNotBlank() }?.let(::add)
            if (row.booleanOrNull("directDeliveryRequired") == true) add("Direct delivery")
        }.joinToString(" · ")
        return DriverJob(
            id = row.string("id"),
            status = marketplaceStatus,
            currentStatus = marketplaceStatus,
            pickupLocation = pickup?.string("addressSummary").orEmpty().ifBlank { "Collection area" },
            deliveryLocation = delivery?.string("addressSummary").orEmpty().ifBlank { "Delivery area" },
            pickupDatetime = pickup?.nullableString("collectionFrom"),
            deliveryDatetime = delivery?.nullableString("deliveryFrom"),
            clientName = poster?.string("name").orEmpty(),
            clientPhone = "",
            vehicleType = row.string("vehicleType"),
            cargoType = row.string("freightType"),
            budgetAmount = proposed,
            loadDetails = safeDetails,
            pickupPostcode = pickup?.string("postcode").orEmpty(),
            deliveryPostcode = delivery?.string("postcode").orEmpty(),
            distanceMiles = row.doubleOrNull("journeyDistanceMiles"),
            pickupDistanceFromActiveDeliveryMiles = row.doubleOrNull("distanceFromCurrentDeliveryMiles")
                ?: row.doubleOrNull("distanceToPickupMiles"),
            podRequired = true,
        )
    }

    private fun getJson(path: String, accessToken: String): JsonObject {
        requireBaseUrl()
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}$path")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Accept", "application/json")
            .get()
            .build()
        return http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, "XDrive request failed."))
            runCatching { gson.fromJson(raw, JsonObject::class.java) }.getOrNull() ?: JsonObject()
        }
    }

    private fun postJson(
        path: String,
        accessToken: String,
        body: JsonObject,
        fallbackError: String,
    ) {
        requireBaseUrl()
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}$path")
            .addHeader("Authorization", "Bearer $accessToken")
            .addHeader("Content-Type", "application/json")
            .addHeader("Accept", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, fallbackError))
        }
    }

    private fun requireBaseUrl() {
        require(xdriveBaseUrl.isNotBlank()) { "XDRIVE_BASE_URL is missing." }
    }

    private suspend fun <T> networkResult(block: () -> T): Result<T> =
        withContext(Dispatchers.IO) { runCatching(block) }

    private fun extractError(rawBody: String, fallback: String): String = runCatching {
        if (rawBody.isBlank()) fallback else {
            val json = gson.fromJson(rawBody, JsonObject::class.java)
            json.get("error")?.asString ?: json.get("message")?.asString ?: fallback
        }
    }.getOrDefault(fallback)

    private fun JsonObject.string(name: String): String {
        val value = get(name) ?: return ""
        return if (value.isJsonNull) "" else runCatching { value.asString }.getOrDefault("")
    }

    private fun JsonObject.nullableString(name: String): String? {
        val value = get(name) ?: return null
        return if (value.isJsonNull) null else runCatching { value.asString }.getOrNull()
    }

    private fun JsonObject.doubleOrNull(name: String): Double? {
        val value = get(name) ?: return null
        return if (value.isJsonNull) null else runCatching { value.asDouble }.getOrNull()
    }

    private fun JsonObject.booleanOrNull(name: String): Boolean? {
        val value = get(name) ?: return null
        return if (value.isJsonNull) null else runCatching { value.asBoolean }.getOrNull()
    }

    private fun JsonObject.stringArray(name: String): List<String> {
        val array = getAsJsonArray(name) ?: return emptyList()
        return buildList {
            for (index in 0 until array.size()) {
                array[index].takeUnless { it.isJsonNull }?.asString?.takeIf { it.isNotBlank() }?.let(::add)
            }
        }
    }
}
