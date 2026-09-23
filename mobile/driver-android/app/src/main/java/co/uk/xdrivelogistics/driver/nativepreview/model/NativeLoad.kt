package co.uk.xdrivelogistics.driver.nativepreview.model

data class NativeLoad(
    val id: String,
    val reference: String,
    val companyName: String,
    val memberId: String?,
    val memberPhone: String?,
    val memberType: String?,
    val pickupArea: String,
    val deliveryArea: String,
    val pickupAt: String?,
    val deliveryAt: String?,
    val vehicleLabel: String?,
    val pallets: Double?,
    val weightKg: Double?,
    val cargoLabel: String?,
    val distanceToPickupMiles: Double?,
    val pickupEtaMinutes: Double?,
    val jobDistanceMiles: Double?,
    val jobDistanceMinutes: Double?,
    val budgetAmount: Double?,
    val currency: String,
    val serviceMode: String?,
    val paymentTerms: String?,
    val publicQuoteNotes: String?,
    val handlingRequirements: List<String>,
    val postedAt: String?
)
