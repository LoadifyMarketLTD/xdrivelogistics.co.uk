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
) {
    fun statusKey(): String = currentStatus.ifBlank { status }.lowercase()

    fun driverStatusKey(): String = when (statusKey()) {
        "assigned", "accepted" -> "allocated"
        "arrived_pickup" -> "on_site_pickup"
        "collected" -> "loaded"
        "on_route_delivery" -> "in_transit"
        "arrived_delivery" -> "on_site_delivery"
        else -> statusKey()
    }

    fun isInProgress(): Boolean = driverStatusKey() in listOf(
        "on_my_way",
        "on_site_pickup",
        "loaded",
        "in_transit",
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

    fun hasPod(): Boolean = podPhotos.isNotEmpty() || deliveryPhotos.isNotEmpty()

    fun isPosted(): Boolean = driverStatusKey() == "posted"

    fun routeLabel(): String = "${pickupLocation.ifBlank { "Pickup" }} -> ${deliveryLocation.ifBlank { "Delivery" }}"

    fun statusLabel(): String = when (driverStatusKey()) {
        "allocated" -> "Allocated"
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

    fun canMoveNext(): Boolean = nextStatus().isNotBlank() && (nextStatus() != "delivered" || hasPod())
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
