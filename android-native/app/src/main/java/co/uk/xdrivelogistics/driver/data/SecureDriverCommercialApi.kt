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

/**
 * Security boundary for Android commercial/Marketplace reads.
 *
 * Pre-award job rows must never be read directly from Supabase because the
 * underlying jobs table contains execution-only addresses, contacts and refs.
 * This client consumes only XDrive server projections: quote-safe Marketplace
 * loads plus assignment-gated execution jobs and quote history.
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
        val request = Request.Builder()
            .url("${xdriveBaseUrl.trimEnd('/')}/api/driver/mobile/bids")
            .addHeader("Authorization", "Bearer ${session.accessToken}")
            .addHeader("Content-Type", "application/json")
            .addHeader("Accept", "application/json")
            .post(gson.toJson(body).toRequestBody(jsonMediaType))
            .build()
        http.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw IllegalStateException(extractError(raw, "Failed to submit quote."))
        }
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
                ?.let { gson.toJson(it) },
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
        val safeDetails = buildList {
            row.doubleOrNull("weightKg")?.let { add("Weight: ${it.toInt()} kg") }
            row.doubleOrNull("pallets")?.let { add("Pallets: ${it.toInt()}") }
            row.string("notesSummary").takeIf { it.isNotBlank() }?.let(::add)
            if (row.booleanOrNull("directDeliveryRequired") == true) add("Direct delivery")
        }.joinToString(" · ")
        return DriverJob(
            id = row.string("id"),
            status = "posted",
            currentStatus = "posted",
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
