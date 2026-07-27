package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.MarketplaceJob
import co.uk.xdrivelogistics.driver.data.MarketplacePublicPrice
import co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus
import co.uk.xdrivelogistics.driver.data.DriverAvailabilitySlot
import co.uk.xdrivelogistics.driver.data.DriverAvailability
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MarketplaceJobModelTest {

    // ---- distanceSortKey ----

    @Test
    fun `distanceSortKey returns distanceFromCurrentDeliveryMiles when present`() {
        val job = marketplaceJob(distanceFromCurrentDeliveryMiles = 5.0, distanceToPickupMiles = 20.0)
        assertEquals(5.0, job.distanceSortKey(), 0.001)
    }

    @Test
    fun `distanceSortKey falls back to distanceToPickupMiles`() {
        val job = marketplaceJob(distanceFromCurrentDeliveryMiles = null, distanceToPickupMiles = 15.0, journeyDistanceMiles = 50.0)
        assertEquals(15.0, job.distanceSortKey(), 0.001)
    }

    @Test
    fun `distanceSortKey falls back to journeyDistanceMiles`() {
        val job = marketplaceJob(distanceFromCurrentDeliveryMiles = null, distanceToPickupMiles = null, journeyDistanceMiles = 42.0)
        assertEquals(42.0, job.distanceSortKey(), 0.001)
    }

    @Test
    fun `distanceSortKey returns MAX_VALUE when all null`() {
        val job = marketplaceJob(distanceFromCurrentDeliveryMiles = null, distanceToPickupMiles = null, journeyDistanceMiles = null)
        assertEquals(Double.MAX_VALUE, job.distanceSortKey(), 0.0)
    }

    // ---- vehicleLabel ----

    @Test
    fun `vehicleLabel capitalises each word of underscore-separated vehicle type`() {
        val job = marketplaceJob(vehicleType = "luton_van")
        assertEquals("Luton Van", job.vehicleLabel())
    }

    @Test
    fun `vehicleLabel returns empty string when vehicleType is null`() {
        val job = marketplaceJob(vehicleType = null)
        assertEquals("", job.vehicleLabel())
    }

    // ---- cargoSummary ----

    @Test
    fun `cargoSummary includes freightType pallets and weight`() {
        val job = marketplaceJob(freightType = "Pallets", pallets = 3, weightKg = 500.0)
        val summary = job.cargoSummary()
        assertTrue(summary.contains("Pallets"))
        assertTrue(summary.contains("3 pal"))
        assertTrue(summary.contains("500 kg"))
    }

    @Test
    fun `cargoSummary returns empty string when all fields absent`() {
        val job = marketplaceJob(freightType = null, pallets = null, weightKg = null)
        assertEquals("", job.cargoSummary())
    }

    // ---- canQuote ----

    @Test
    fun `canQuote false is preserved from model`() {
        val job = marketplaceJob(canQuote = false, quoteWarning = "Not eligible")
        assertFalse(job.canQuote)
        assertEquals("Not eligible", job.quoteWarning)
    }

    // ---- destinationPriority ----

    @Test
    fun `destinationPriority true is preserved`() {
        val job = marketplaceJob(destinationPriority = true)
        assertTrue(job.destinationPriority)
    }

    // ---- DriverAvailabilityStatus fromKey ----

    @Test
    fun `DriverAvailabilityStatus fromKey resolves known values`() {
        assertEquals(DriverAvailabilityStatus.AVAILABLE, DriverAvailabilityStatus.fromKey("available"))
        assertEquals(DriverAvailabilityStatus.BUSY, DriverAvailabilityStatus.fromKey("busy"))
        assertEquals(DriverAvailabilityStatus.OFFLINE, DriverAvailabilityStatus.fromKey("offline"))
    }

    @Test
    fun `DriverAvailabilityStatus fromKey defaults to OFFLINE for unknown value`() {
        assertEquals(DriverAvailabilityStatus.OFFLINE, DriverAvailabilityStatus.fromKey("unknown_status"))
    }

    // ---- DriverAvailability slot lookup ----

    @Test
    fun `DriverAvailability slot can be found by day and period`() {
        val availability = DriverAvailability(
            status = DriverAvailabilityStatus.AVAILABLE,
            slots = listOf(
                DriverAvailabilitySlot(dayOfWeek = 0, slot = "AM", available = true),
                DriverAvailabilitySlot(dayOfWeek = 0, slot = "PM", available = false),
                DriverAvailabilitySlot(dayOfWeek = 1, slot = "EVENING", available = true),
            ),
        )
        val mondayAm = availability.slots.firstOrNull { it.dayOfWeek == 0 && it.slot == "AM" }
        assertTrue(mondayAm?.available == true)

        val mondayPm = availability.slots.firstOrNull { it.dayOfWeek == 0 && it.slot == "PM" }
        assertFalse(mondayPm?.available == true)

        val tuesdayEvening = availability.slots.firstOrNull { it.dayOfWeek == 1 && it.slot == "EVENING" }
        assertTrue(tuesdayEvening?.available == true)
    }

    // ---- Helpers ----

    private fun marketplaceJob(
        id: String = "job-1",
        publicReference: String = "XDL-00000001",
        vehicleType: String? = "luton_van",
        freightType: String? = null,
        pallets: Int? = null,
        weightKg: Double? = null,
        journeyDistanceMiles: Double? = null,
        distanceToPickupMiles: Double? = null,
        distanceFromCurrentDeliveryMiles: Double? = null,
        canQuote: Boolean = true,
        quoteWarning: String? = null,
        destinationPriority: Boolean = false,
        hasProposedPrice: Boolean = false,
        proposedPriceGbp: Double? = null,
    ) = MarketplaceJob(
        id = id,
        publicReference = publicReference,
        posterCompanyName = null,
        pickupAddressSummary = "SW1",
        pickupPostcode = "SW1A",
        pickupCollectionFrom = null,
        deliveryAddressSummary = "E1",
        deliveryPostcode = "E1",
        deliveryFrom = null,
        vehicleType = vehicleType,
        pallets = pallets,
        weightKg = weightKg,
        freightType = freightType,
        journeyDistanceMiles = journeyDistanceMiles,
        distanceToPickupMiles = distanceToPickupMiles,
        distanceFromCurrentDeliveryMiles = distanceFromCurrentDeliveryMiles,
        publicPrice = MarketplacePublicPrice(visible = false, amount = null, currency = null),
        hasProposedPrice = hasProposedPrice,
        proposedPriceGbp = proposedPriceGbp,
        canQuote = canQuote,
        canSave = true,
        quoteWarning = quoteWarning,
        destinationPriority = destinationPriority,
        internationalEligibilityRequired = false,
    )
}
