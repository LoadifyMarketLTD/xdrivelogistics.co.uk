package co.uk.xdrivelogistics.driver.data

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
    val payloadKg: Double? = null,
    val palletsCapacity: Int? = null,
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
) {
    fun statusKey(): String = currentStatus.ifBlank { status }.lowercase()
    fun driverStatusKey(): String = when (statusKey()) {
        "assigned", "accepted" -> "allocated"
        "arrived_pickup" -> "on_site_pickup"
        "collected" -> "loaded"
        "on_route_delivery", "on_my_way_to_delivery" -> "in_transit"
        "arrived_delivery" -> "on_site_delivery"
        else -> statusKey()
    }
    fun isInProgress(): Boolean = driverStatusKey() in listOf("on_my_way", "on_site_pickup", "loaded", "in_transit", "on_site_delivery", "in_progress")
    fun isActive(): Boolean = driverStatusKey() !in listOf("delivered", "completed", "cancelled", "canceled", "invoiced", "paid")
    fun hasPod(): Boolean = deliveryPhotos.isNotEmpty() || podPhotos.isNotEmpty()
    fun hasCollectionProof(): Boolean = !collectionPhotoUrl.isNullOrBlank()
    fun hasDeliveryConfirmation(): Boolean = !podRequired || (hasPod() && !deliverySignatureData.isNullOrBlank() && clientSignatureName.isNotBlank())
    fun isPosted(): Boolean = driverStatusKey() == "posted"
    fun routeLabel(): String = "${pickupLocation.ifBlank { "Pickup" }} -> ${deliveryLocation.ifBlank { "Delivery" }}"
    fun statusLabel(): String = when (driverStatusKey()) {
        "allocated" -> "Allocated"
        "awarded" -> "Awarded"
        "on_my_way" -> "On My Way to Collection"
        "on_site_pickup" -> "Arrived at Collection"
        "loaded" -> "Loaded"
        "in_transit" -> "On My Way to Delivery"
        "on_site_delivery" -> "Arrived at Delivery"
        "delivered" -> "Delivered (POD)"
        "completed" -> "Completed"
        else -> driverStatusKey().split('_').joinToString(" ") { part -> part.replaceFirstChar { it.uppercase() } }
    }
    fun nextStatus(): String = when (driverStatusKey()) {
        "allocated", "awarded" -> "on_my_way"
        "on_my_way" -> "on_site_pickup"
        "on_site_pickup" -> "loaded"
        "loaded" -> "in_transit"
        "in_transit" -> "on_site_delivery"
        "on_site_delivery" -> "delivered"
        "delivered" -> "completed"
        else -> ""
    }
    fun nextActionLabel(): String = when (nextStatus()) {
        "on_my_way" -> "On My Way to Collection"
        "on_site_pickup" -> "Arrived at Collection"
        "loaded" -> "Loaded / Collected"
        "in_transit" -> "On My Way to Delivery"
        "on_site_delivery" -> "Arrived at Delivery"
        "delivered" -> "Mark as Delivered"
        "completed" -> "Complete Job"
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
    val baseAmount: Double? = null,
    val additionalExtrasGbp: Double = 0.0,
    val collectWithinMinutes: Int? = null,
    val quotedVehicleId: String? = null,
    val quotedVehicleLabel: String? = null,
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
    val mode: String = "going_home",
    val goAnywhere: Boolean = false,
    val viaLocation: String = "",
    val journeyEta: String? = null,
    val capacityStatus: String = "",
    val weightAvailableKg: Double? = null,
    val palletSpaceAvailable: Int? = null,
    val status: String = "available",
)

data class DriverInvoice(
    val id: String,
    val invoiceNumber: String,
    val status: String,
    val amount: Double?,
    val currency: String,
    val clientName: String,
    val dueDate: String?,
)

data class NearbyDriver(
    val driverId: String,
    val driverName: String,
    val vehicleLabel: String,
    val lat: Double?,
    val lng: Double?,
    val recordedAt: String?,
)

data class DriverAlertPreferences(
    val pushEnabled: Boolean = true,
    val soundEnabled: Boolean = true,
    val headsUpEnabled: Boolean = true,
    val marketplaceEnabled: Boolean = true,
    val quoteEnabled: Boolean = true,
    val bookingEnabled: Boolean = true,
    val operationalEnabled: Boolean = true,
)

data class DriverSearchDefaults(
    val values: Map<String, String> = emptyMap(),
)

data class MarketCluster(
    val latitude: Double,
    val longitude: Double,
    val count: Int,
)

data class DriverMarketIntelligence(
    val radiusMiles: Int = 30,
    val competition: String = "quiet",
    val clusters: List<MarketCluster> = emptyList(),
    val ppmVisible: Boolean = false,
    val ppmMedian: Double? = null,
    val ppmLow: Double? = null,
    val ppmHigh: Double? = null,
    val ppmSampleCount: Int = 0,
)

data class DriverCollectionPass(
    val jobId: String,
    val passCode: String,
    val issuedAt: String?,
    val expiresAt: String?,
    val verifiedAt: String?,
)
