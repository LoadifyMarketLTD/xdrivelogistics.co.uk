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
)

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
