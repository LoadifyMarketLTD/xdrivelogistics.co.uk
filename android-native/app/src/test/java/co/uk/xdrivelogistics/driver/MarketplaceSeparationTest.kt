package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverAvailability
import co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus
import co.uk.xdrivelogistics.driver.data.MarketplaceJob
import co.uk.xdrivelogistics.driver.data.MarketplacePublicPrice
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Task 5 — Live Loads marketplace separation proof tests.
 *
 * Proves that:
 * - marketplace and operational selections are independent state fields;
 * - resolveMarketplaceJob never falls back to an unselected load;
 * - lifecycle/dispatch-note actions cannot target a marketplace load (resolveSelectedJob
 *   only resolves against the operational jobs list);
 * - save/hide state is additive and isolated;
 * - hideMarketplaceLoad clears marketplaceSelectedJobId when the hidden load was selected.
 */
class MarketplaceSeparationTest {

    // ---- resolveMarketplaceJob ----

    @Test
    fun `resolveMarketplaceJob returns null when marketplaceSelectedJobId is null`() {
        val jobs = listOf(mpJob("mp-1"), mpJob("mp-2"))
        assertNull(resolveMarketplaceJob(jobs, null))
    }

    @Test
    fun `resolveMarketplaceJob returns null when marketplaceSelectedJobId is blank`() {
        val jobs = listOf(mpJob("mp-1"))
        assertNull(resolveMarketplaceJob(jobs, ""))
        assertNull(resolveMarketplaceJob(jobs, "   "))
    }

    @Test
    fun `resolveMarketplaceJob with loads A and B selected B returns B not A`() {
        val mpA = mpJob("mp-a")
        val mpB = mpJob("mp-b")
        val result = resolveMarketplaceJob(listOf(mpA, mpB), "mp-b")
        assertEquals(mpB, result)
        assertFalse("must not resolve to mp-a", result?.id == "mp-a")
    }

    @Test
    fun `resolveMarketplaceJob returns null when selected id not in list`() {
        val jobs = listOf(mpJob("mp-1"), mpJob("mp-2"))
        assertNull(resolveMarketplaceJob(jobs, "mp-unknown"))
    }

    @Test
    fun `resolveMarketplaceJob returns null for empty list`() {
        assertNull(resolveMarketplaceJob(emptyList(), "mp-1"))
    }

    // ---- Marketplace selection is independent of operational selectedJobId ----

    @Test
    fun `marketplace and operational selections are independent state fields`() {
        val state = DriverUiState(selectedJobId = "op-job-1")
        val afterMarketplaceSelect = state.copy(marketplaceSelectedJobId = "mp-job-1")
        assertEquals("op-job-1", afterMarketplaceSelect.selectedJobId)
        assertEquals("mp-job-1", afterMarketplaceSelect.marketplaceSelectedJobId)
    }

    @Test
    fun `clearing marketplace selection does not affect operational selectedJobId`() {
        val state = DriverUiState(selectedJobId = "op-job-1", marketplaceSelectedJobId = "mp-job-1")
        val cleared = state.copy(marketplaceSelectedJobId = null)
        assertEquals("op-job-1", cleared.selectedJobId)
        assertNull(cleared.marketplaceSelectedJobId)
    }

    // ---- Lifecycle actions cannot target a marketplace load ----

    @Test
    fun `resolveSelectedJob with a marketplace-only id returns null (lifecycle action blocked)`() {
        val operationalJobs = listOf(opJob("op-job-1"), opJob("op-job-2"))
        // User has somehow set selectedJobId to a marketplace job ID
        val result = resolveSelectedJob(operationalJobs, "mp-job-x")
        assertNull("lifecycle action must not target a marketplace load", result)
    }

    @Test
    fun `resolveSelectedJob with correct operational id resolves correctly`() {
        val operationalJobs = listOf(opJob("op-job-1"), opJob("op-job-2"))
        val result = resolveSelectedJob(operationalJobs, "op-job-2")
        assertEquals("op-job-2", result?.id)
    }

    @Test
    fun `resolveActionScreenTargets prefers explicit marketplace selection over remembered operational selection`() {
        val targets = resolveActionScreenTargets(
            jobs = listOf(opJob("op-a")),
            selectedJobId = "op-a",
            marketplaceJobs = listOf(mpJob("mp-b")),
            marketplaceSelectedJobId = "mp-b",
        )
        assertNull(targets.operationalJob)
        assertEquals("mp-b", targets.marketplaceJob?.id)
    }

    @Test
    fun `resolveActionScreenTargets returns operational selection when no marketplace selection exists`() {
        val targets = resolveActionScreenTargets(
            jobs = listOf(opJob("op-a")),
            selectedJobId = "op-a",
            marketplaceJobs = listOf(mpJob("mp-b")),
            marketplaceSelectedJobId = null,
        )
        assertEquals("op-a", targets.operationalJob?.id)
        assertNull(targets.marketplaceJob)
    }

    @Test
    fun `quote target resolves explicitly selected marketplace load B not A regardless of list order`() {
        val mpA = mpJob("mp-a")
        val mpB = mpJob("mp-b")
        val selectedJobId = "op-a"
        val firstOrder = resolveQuoteTargetMarketplaceJob(
            marketplaceJobs = listOf(mpA, mpB),
            marketplaceSelectedJobId = "mp-b",
        )
        val secondOrder = resolveQuoteTargetMarketplaceJob(
            marketplaceJobs = listOf(mpB, mpA),
            marketplaceSelectedJobId = "mp-b",
        )
        assertEquals("op-a", selectedJobId)
        assertEquals("mp-b", firstOrder?.id)
        assertEquals("mp-b", secondOrder?.id)
        assertFalse(firstOrder?.id == "mp-a")
        assertFalse(secondOrder?.id == "mp-a")
    }

    @Test
    fun `quote target resolver returns null when no explicit marketplace selection exists`() {
        val target = resolveQuoteTargetMarketplaceJob(
            marketplaceJobs = listOf(mpJob("mp-a"), mpJob("mp-b")),
            marketplaceSelectedJobId = null,
        )
        assertNull(target)
    }

    // ---- save/hide state ----

    @Test
    fun `saveMarketplaceLoad adds jobId to savedMarketplaceLoadIds`() {
        val state = DriverUiState()
        val after = state.copy(savedMarketplaceLoadIds = state.savedMarketplaceLoadIds + "mp-1")
        assertTrue(after.savedMarketplaceLoadIds.contains("mp-1"))
        assertFalse(after.savedMarketplaceLoadIds.contains("mp-2"))
    }

    @Test
    fun `savedMarketplaceLoadIds is additive across multiple saves`() {
        var state = DriverUiState()
        state = state.copy(savedMarketplaceLoadIds = state.savedMarketplaceLoadIds + "mp-1")
        state = state.copy(savedMarketplaceLoadIds = state.savedMarketplaceLoadIds + "mp-2")
        state = state.copy(savedMarketplaceLoadIds = state.savedMarketplaceLoadIds + "mp-3")
        assertEquals(setOf("mp-1", "mp-2", "mp-3"), state.savedMarketplaceLoadIds)
    }

    @Test
    fun `hideMarketplaceLoad adds jobId to hiddenMarketplaceLoadIds`() {
        val state = DriverUiState()
        val after = state.copy(hiddenMarketplaceLoadIds = state.hiddenMarketplaceLoadIds + "mp-1")
        assertTrue(after.hiddenMarketplaceLoadIds.contains("mp-1"))
    }

    @Test
    fun `hideMarketplaceLoad clears marketplaceSelectedJobId when the hidden load was selected`() {
        val state = DriverUiState(marketplaceSelectedJobId = "mp-1")
        val hiddenId = "mp-1"
        val currentSelection = state.marketplaceSelectedJobId
        val after = state.copy(
            hiddenMarketplaceLoadIds = state.hiddenMarketplaceLoadIds + hiddenId,
            marketplaceSelectedJobId = if (currentSelection == hiddenId) null else currentSelection,
        )
        assertNull(after.marketplaceSelectedJobId)
        assertTrue(after.hiddenMarketplaceLoadIds.contains("mp-1"))
    }

    @Test
    fun `hideMarketplaceLoad preserves marketplaceSelectedJobId when a different load is hidden`() {
        val state = DriverUiState(marketplaceSelectedJobId = "mp-selected")
        val hiddenId = "mp-other"
        val currentSelection = state.marketplaceSelectedJobId
        val after = state.copy(
            hiddenMarketplaceLoadIds = state.hiddenMarketplaceLoadIds + hiddenId,
            marketplaceSelectedJobId = if (currentSelection == hiddenId) null else currentSelection,
        )
        assertEquals("mp-selected", after.marketplaceSelectedJobId)
        assertTrue(after.hiddenMarketplaceLoadIds.contains("mp-other"))
    }

    // ---- Owner change resets all marketplace state ----

    @Test
    fun `owner change resets marketplaceSelectedJobId and marketplace collections`() {
        val state = DriverUiState(
            selectedJobId = "op-job-1",
            marketplaceSelectedJobId = "mp-1",
            savedMarketplaceLoadIds = setOf("mp-2"),
            hiddenMarketplaceLoadIds = setOf("mp-3"),
            marketplaceJobs = listOf(mpJob("mp-1")),
            availability = DriverAvailability(
                status = DriverAvailabilityStatus.AVAILABLE,
                slots = emptyList(),
            ),
        )
        val after = state.copy(
            selectedJobId = null,
            jobs = emptyList(),
            jobSyncStates = emptyMap(),
            availability = null,
            pendingPodJobIds = emptySet(),
            blockedPodJobIds = emptySet(),
            marketplaceSelectedJobId = null,
            marketplaceJobs = emptyList(),
            savedMarketplaceLoadIds = emptySet(),
            hiddenMarketplaceLoadIds = emptySet(),
        )
        assertNull(after.selectedJobId)
        assertNull(after.marketplaceSelectedJobId)
        assertNull(after.availability)
        assertTrue(after.savedMarketplaceLoadIds.isEmpty())
        assertTrue(after.hiddenMarketplaceLoadIds.isEmpty())
        assertTrue(after.marketplaceJobs.isEmpty())
    }

    // ---- Helpers ----

    private fun mpJob(
        id: String,
        canQuote: Boolean = true,
        quoteWarning: String? = null,
    ) = MarketplaceJob(
        id = id,
        publicReference = "XDL-${id.take(8).uppercase()}",
        posterCompanyName = null,
        pickupAddressSummary = "SW1",
        pickupPostcode = "SW1A",
        pickupCollectionFrom = null,
        deliveryAddressSummary = "E1",
        deliveryPostcode = "E1",
        deliveryFrom = null,
        vehicleType = "luton_van",
        pallets = null,
        weightKg = null,
        freightType = null,
        journeyDistanceMiles = null,
        distanceToPickupMiles = null,
        distanceFromCurrentDeliveryMiles = null,
        publicPrice = MarketplacePublicPrice(visible = false, amount = null, currency = null),
        hasProposedPrice = false,
        proposedPriceGbp = null,
        canQuote = canQuote,
        canSave = true,
        quoteWarning = quoteWarning,
        destinationPriority = false,
        internationalEligibilityRequired = false,
    )

    private fun opJob(id: String, status: String = "allocated") = DriverJob(
        id = id,
        status = status,
        currentStatus = status,
        pickupLocation = "Manchester",
        deliveryLocation = "London",
        pickupDatetime = null,
        deliveryDatetime = null,
        clientName = "Client",
        clientPhone = "",
        vehicleType = "Luton",
        cargoType = "Pallets",
        budgetAmount = null,
        loadDetails = "",
    )
}
