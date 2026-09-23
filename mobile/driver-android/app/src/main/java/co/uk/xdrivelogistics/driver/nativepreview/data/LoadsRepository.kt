package co.uk.xdrivelogistics.driver.nativepreview.data

import co.uk.xdrivelogistics.driver.nativepreview.model.NativeLoad
import org.json.JSONArray
import org.json.JSONObject

data class LoadsSnapshot(
    val loads: List<NativeLoad>,
    val source: String
)

class LoadsRepository(
    private val authStore: AuthStore,
    private val api: XDriveApi
) {
    fun cached(): LoadsSnapshot? {
        val raw = authStore.readLoadsCache() ?: return null
        return runCatching {
            LoadsSnapshot(parseLoads(raw), "cache")
        }.getOrNull()
    }

    suspend fun submitQuote(
        jobId: String,
        amount: Double,
        collectWithinMinutes: Int?,
        message: String
    ): Result<String> {
        val response = api.submitQuote(jobId, amount, collectWithinMinutes, message)
        if (!response.successful) {
            val error = runCatching { JSONObject(response.body).optString("error") }.getOrDefault("")
            return Result.failure(IllegalStateException(error.ifBlank { "Quote submission failed (" + response.status + ")." }))
        }
        return Result.success(
            runCatching { JSONObject(response.body).optString("bidId") }.getOrDefault("")
        )
    }

    suspend fun refresh(): Result<LoadsSnapshot> {
        val response = api.getMarketplaceLoads()
        if (!response.successful) {
            val message = runCatching {
                JSONObject(response.body).optString("error")
            }.getOrNull().orEmpty().ifBlank {
                "Loads request failed (" + response.status + ")."
            }
            return Result.failure(IllegalStateException(message))
        }

        return runCatching {
            val loads = parseLoads(response.body)
            authStore.writeLoadsCache(response.body)
            LoadsSnapshot(loads, "live")
        }
    }

    private fun parseLoads(raw: String): List<NativeLoad> {
        val root = JSONObject(raw)
        val array = root.optJSONArray("loads") ?: JSONArray()
        return buildList {
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                add(item.toNativeLoad())
            }
        }
    }

    private fun JSONObject.toNativeLoad(): NativeLoad {
        val id = optString("id")
        val member = optJSONObject("member")
        val companyName = member?.optString("name")
            ?.takeIf { it.isNotBlank() }
            ?: "Marketplace member"
        val memberId = member?.optString("memberId")
            ?.takeIf { it.isNotBlank() }
        val memberPhone = member?.optString("phone")
            ?.takeIf { it.isNotBlank() }
        val memberType = member?.optString("type")
            ?.takeIf { it.isNotBlank() }

        val vehicle = listOf(
            optString("requested_vehicle_label"),
            optString("requested_vehicle_type"),
            optString("vehicle_type")
        ).firstOrNull { it.isNotBlank() }

        val cargo = listOf(
            optString("requested_cargo_label"),
            optString("cargo_type")
        ).firstOrNull { it.isNotBlank() }

        return NativeLoad(
            id = id,
            reference = if (id.length >= 8) "XDL-" + id.take(8).uppercase() else id,
            companyName = companyName,
            memberId = memberId,
            memberPhone = memberPhone,
            memberType = memberType,
            pickupArea = optString("pickup_area").ifBlank { "Collection area TBC" },
            deliveryArea = optString("delivery_area").ifBlank { "Delivery area TBC" },
            pickupAt = optString("pickup_datetime").takeIf { it.isNotBlank() },
            deliveryAt = optString("delivery_datetime").takeIf { it.isNotBlank() },
            vehicleLabel = vehicle,
            pallets = nullableDouble("pallets"),
            weightKg = nullableDouble("weight_kg"),
            cargoLabel = cargo,
            distanceToPickupMiles = nullableDouble("distance_to_pickup_miles"),
            pickupEtaMinutes = nullableDouble("pickup_eta_minutes"),
            jobDistanceMiles = nullableDouble("distance_miles"),
            jobDistanceMinutes = nullableDouble("distance_minutes"),
            budgetAmount = nullableDouble("budget_amount"),
            currency = optString("currency").ifBlank { "GBP" },
            serviceMode = optString("service_mode").takeIf { it.isNotBlank() },
            paymentTerms = optString("payment_terms").takeIf { it.isNotBlank() },
            publicQuoteNotes = optString("public_quote_notes").takeIf { it.isNotBlank() },
            handlingRequirements = buildList {
                val requirements = optJSONArray("handling_requirements")
                if (requirements != null) for (i in 0 until requirements.length()) {
                    requirements.optString(i).takeIf { it.isNotBlank() }?.let(::add)
                }
            },
            postedAt = optString("exchange_posted_at").takeIf { it.isNotBlank() }
        )
    }

    private fun JSONObject.nullableDouble(key: String): Double? {
        if (!has(key) || isNull(key)) return null
        val value = optDouble(key, Double.NaN)
        return value.takeIf { it.isFinite() }
    }
}
