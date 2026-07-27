package co.uk.xdrivelogistics.driver.data

import co.uk.xdrivelogistics.driver.jobs.DriverLifecycleTransitions
import co.uk.xdrivelogistics.driver.jobs.CanonicalDriverLifecycleStatus

data class DriverSession(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val email: String,
)

data class DriverProfile(
    val driverId: String,
    val companyId: String,
    val vehicleId: String? = null,
    val displayName: String = "",
    val email: String = "",
    val vehicleLabel: String = "",
    val vehicleRegistration: String = "",
)

data class DriverJob(
    val id: String,
    val status: String,
    val currentStatus: String,
    val pickupLocation: String,
    val deliveryLocation: String,
    val pickupDatetime: String?,
    val deliveryDatetime: String?,
    val clientName: String,
    val clientPhone: String,
    val vehicleType: String,
    val cargoType: String,
    val budgetAmount: Double?,
    val loadDetails: String,
    val pickupPostcode: String = "",
    val deliveryPostcode: String = "",
    val distanceMiles: Double? = null,
    val pickupDistanceFromActiveDeliveryMiles: Double? = null,
    val deliveryPhotos: List<String> = emptyList(),
    val podPhotos: List<String> = emptyList(),
    val collectionPhotoUrl: String? = null,
    val deliverySignatureData: String? = null,
    val clientSignatureName: String = "",
    val podRequired: Boolean = true,
    val pallets: Int? = null,
    val weightKg: Double? = null,
    val specialRequirements: String = "",
    val accessRestrictions: String = "",
    val estimatedDurationMinutes: Int? = null,
    val collectionContactName: String? = null,
    val collectionContactPhone: String? = null,
    val deliveryContactName: String? = null,
    val deliveryContactPhone: String? = null,
) {
    fun statusKey(): String = currentStatus.lowercase().trim()

    fun driverStatusKey(): String = CanonicalDriverLifecycleStatus
        .fromRaw(statusKey())
        ?.wireValue
        ?: ""

    fun isInProgress(): Boolean = driverStatusKey() in listOf(
        "accepted",
        "on_my_way_to_pickup",
        "on_site_pickup",
        "loaded",
        "on_my_way_to_delivery",
        "on_site_delivery",
        "in_progress",
    )

    fun isActive(): Boolean = driverStatusKey() !in listOf(
        "delivered",
        "completed",
        "cancelled",
        "canceled",
        "invoiced",
        "paid",
    )

    fun hasPod(): Boolean = deliveryPhotos.isNotEmpty() || podPhotos.isNotEmpty()

    fun hasCollectionProof(): Boolean = !collectionPhotoUrl.isNullOrBlank()

    fun hasDeliveryConfirmation(): Boolean = !podRequired || (
        hasPod() &&
            !deliverySignatureData.isNullOrBlank() &&
            clientSignatureName.isNotBlank()
        )

    fun isPosted(): Boolean = driverStatusKey() == "posted"

    fun routeLabel(): String = "${pickupLocation.ifBlank { "Pickup" }} -> ${deliveryLocation.ifBlank { "Delivery" }}"

    fun statusLabel(): String = when (driverStatusKey()) {
        "allocated" -> "Allocated"
        "accepted" -> "Accepted"
        "awarded" -> "Awarded"
        "on_my_way_to_pickup" -> "On My Way to Collection"
        "on_site_pickup" -> "Arrived at Collection"
        "loaded" -> "Loaded"
        "on_my_way_to_delivery" -> "On My Way to Delivery"
        "on_site_delivery" -> "Arrived at Delivery"
        "delivered" -> "Delivered (POD)"
        "completed" -> "Completed"
        else -> driverStatusKey().split('_').joinToString(" ") { part ->
            part.replaceFirstChar { it.uppercase() }
        }
    }

    fun nextStatus(): String = DriverLifecycleTransitions.nextStatus(driverStatusKey())?.wireValue.orEmpty()

    fun nextActionLabel(): String = when (nextStatus()) {
        "accepted" -> "Accept Job"
        "on_my_way_to_pickup" -> "On My Way to Collection"
        "on_site_pickup" -> "Arrived at Collection"
        "loaded" -> "Loaded / Collected"
        "on_my_way_to_delivery" -> "On My Way to Delivery"
        "on_site_delivery" -> "Arrived at Delivery"
        "delivered" -> "Mark as Delivered"
        else -> "No further action"
    }

    fun needsCollectionProof(): Boolean = nextStatus() == "loaded"

    fun blockingRequirementFor(next: String = nextStatus()): String? = when (next) {
        "loaded" -> if (hasCollectionProof()) null else "Take or upload a collection photo before marking the job Loaded."
        "delivered" -> when {
            !podRequired -> null
            !hasPod() -> "Upload a signed POD or delivery photo before marking the job Delivered."
            clientSignatureName.isBlank() -> "Enter and save the recipient name before marking the job Delivered."
            deliverySignatureData.isNullOrBlank() -> "Confirm the signed POD evidence before marking the job Delivered."
            else -> null
        }
        else -> null
    }

    fun canMoveNext(): Boolean = nextStatus().isNotBlank() && blockingRequirementFor() == null
}

data class DriverDocument(
    val id: String,
    val docType: String,
    val status: String,
    val createdAt: String?,
    val expiryDate: String? = null,
    val isVehicleDocument: Boolean = false,
)

data class DriverBid(
    val id: String,
    val jobId: String,
    val amount: Double?,
    val currency: String,
    val status: String,
    val message: String,
    val createdAt: String?,
    val pickupLocation: String,
    val deliveryLocation: String,
    val pickupDatetime: String?,
    val clientName: String,
)

data class DriverNotification(
    val id: String,
    val title: String,
    val body: String,
    val type: String,
    val readAt: String?,
    val createdAt: String?,
)

data class DriverReturnJourney(
    val id: String,
    val fromLocation: String,
    val toLocation: String,
    val availableDate: String?,
)

data class DriverInvoice(
    val id: String,
    val invoiceNumber: String,
    val status: String,
    val amount: Double?,
    val currency: String,
    val clientName: String,
    val dueDate: String?,
    val netAmount: Double? = null,
    val vatAmount: Double? = null,
    val paymentStatus: String? = null,
    val issuedAt: String? = null,
)

data class NearbyDriver(
    val driverId: String,
    val driverName: String,
    val vehicleLabel: String,
    val lat: Double?,
    val lng: Double?,
    val recordedAt: String?,
)

data class DriverPreferences(
    val notifyTracked: Boolean = false,
    val emailNotifications: Boolean = false,
)

enum class DriverAvailabilityStatus(val key: String, val label: String) {
    AVAILABLE("available", "Available"),
    BUSY("busy", "Busy"),
    OFFLINE("offline", "Offline");

    companion object {
        fun fromKey(key: String): DriverAvailabilityStatus =
            entries.firstOrNull { it.key == key } ?: OFFLINE
    }
}

data class DriverAvailabilitySlot(
    val dayOfWeek: Int,
    val slot: String,
    val available: Boolean,
)

data class DriverAvailability(
    val status: DriverAvailabilityStatus,
    val slots: List<DriverAvailabilitySlot>,
)

data class MarketplacePublicPrice(
    val visible: Boolean,
    val amount: Double?,
    val currency: String?,
)

data class MarketplaceJob(
    val id: String,
    val publicReference: String,
    val posterCompanyName: String?,
    val pickupAddressSummary: String,
    val pickupPostcode: String,
    val pickupCollectionFrom: String?,
    val deliveryAddressSummary: String,
    val deliveryPostcode: String,
    val deliveryFrom: String?,
    val vehicleType: String?,
    val pallets: Int?,
    val weightKg: Double?,
    val freightType: String?,
    val journeyDistanceMiles: Double?,
    val distanceToPickupMiles: Double?,
    val distanceFromCurrentDeliveryMiles: Double?,
    val publicPrice: MarketplacePublicPrice,
    val hasProposedPrice: Boolean,
    val proposedPriceGbp: Double?,
    val canQuote: Boolean,
    val canSave: Boolean,
    val quoteWarning: String?,
    val destinationPriority: Boolean,
    val internationalEligibilityRequired: Boolean,
) {
    fun distanceSortKey(): Double =
        distanceFromCurrentDeliveryMiles ?: distanceToPickupMiles ?: journeyDistanceMiles ?: Double.MAX_VALUE

    fun shortDistanceLabel(): String {
        val d = distanceFromCurrentDeliveryMiles ?: distanceToPickupMiles ?: journeyDistanceMiles
        return if (d != null) "%.1f mi".format(d) else ""
    }

    fun vehicleLabel(): String = vehicleType?.split('_')
        ?.joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
        ?: ""

    fun cargoSummary(): String = buildString {
        if (!freightType.isNullOrBlank()) append(freightType)
        if (pallets != null && pallets > 0) {
            if (isNotEmpty()) append(" • ")
            append("$pallets pal")
        }
        if (weightKg != null && weightKg > 0) {
            if (isNotEmpty()) append(" • ")
            append("${weightKg.toInt()} kg")
        }
    }
}
