package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveLoadsComponentsTest {
    @Test
    fun `card tap opens details mode for same job`() {
        var selectedJob: String? = "job-a"
        var mode: ActionEntryMode? = null

        openLiveLoadFromCard(
            jobId = "job-live-1",
            onOpenActionForJob = { jobId, entryMode ->
                selectedJob = jobId
                mode = entryMode
            },
        )

        assertEquals("job-live-1", selectedJob)
        assertEquals(ActionEntryMode.DETAILS, mode)
    }

    @Test
    fun `quote tap for job B keeps quote target on B`() {
        var selectedJob: String? = "job-a"
        var mode: ActionEntryMode = ActionEntryMode.DETAILS
        var submittedJobId: String? = null

        openLiveLoadQuoteFlow(
            jobId = "job-b",
            onOpenActionForJob = { jobId, entryMode ->
                selectedJob = jobId
                mode = entryMode
            },
        )
        submittedJobId = selectedJob

        assertEquals("job-b", selectedJob)
        assertEquals(ActionEntryMode.QUOTE, mode)
        assertEquals("job-b", submittedJobId)
    }

    @Test
    fun `live pinned hidden filters remain consistent`() {
        val jobs = listOf(
            job("job-live"),
            job("job-pinned"),
            job("job-hidden"),
        )
        val prefs = mapOf(
            "job-pinned" to "saved",
            "job-hidden" to "deleted",
        )

        val live = filterLiveLoadsByBox(jobs, prefs, LiveLoadsBox.LIVE).map { it.id }
        val pinned = filterLiveLoadsByBox(jobs, prefs, LiveLoadsBox.PINNED).map { it.id }
        val hidden = filterLiveLoadsByBox(jobs, prefs, LiveLoadsBox.HIDDEN).map { it.id }
        val counts = liveLoadsCounts(jobs, prefs)

        assertEquals(listOf("job-live"), live)
        assertEquals(listOf("job-pinned"), pinned)
        assertEquals(listOf("job-hidden"), hidden)
        assertEquals(1, counts.first)
        assertEquals(1, counts.second)
        assertEquals(1, counts.third)
    }

    @Test
    fun `pin hide restore actions map to expected preference states`() {
        assertEquals("saved", applyLiveLoadPreferenceAction(LiveLoadPreferenceAction.PIN))
        assertEquals("deleted", applyLiveLoadPreferenceAction(LiveLoadPreferenceAction.HIDE))
        assertEquals(null, applyLiveLoadPreferenceAction(LiveLoadPreferenceAction.RESTORE))
    }

    @Test
    fun `live load card data includes visible hierarchy fields`() {
        val job = job(
            id = "live-load-12345678",
            pickupLocation = "Leeds LS1",
            deliveryLocation = "Bristol BS1",
            pickupDatetime = "2026-07-31T09:15:00Z",
            deliveryDatetime = "2026-07-31T14:45:00Z",
            clientName = "Acme Freight",
            vehicleType = "Luton Van",
            cargoType = "General freight",
            loadDetails = """{"pallets":"6","weight":"1200"}""",
        )

        val card = job.toLiveLoadCardData()

        assertTrue(card.companyName.contains("Acme Freight"))
        assertTrue(card.reference.isNotBlank())
        assertEquals("Luton Van", card.vehicleType)
        assertEquals("Leeds LS1", card.pickupLine)
        assertEquals("Bristol BS1", card.deliveryLine)
        assertTrue(card.freightSummary.contains("General freight"))
        assertTrue(card.freightSummary.contains("6 pallets"))
        assertTrue(card.freightSummary.contains("1200 kg"))
    }

    @Test
    fun `weight with existing unit is not duplicated`() {
        val job = job(id = "job-weight-unit", loadDetails = """{"weight":"1200 kg"}""")
        val card = job.toLiveLoadCardData()
        assertTrue(card.freightSummary.contains("1200 kg"))
        assertTrue(!card.freightSummary.contains("1200 kg kg"))
    }

    @Test
    fun `long and missing values render with safe fallbacks`() {
        val job = job(
            id = "job-with-long-values-001",
            pickupLocation = "A".repeat(120),
            deliveryLocation = "",
            pickupDatetime = "",
            deliveryDatetime = null,
            clientName = "Long Company ".repeat(12),
            vehicleType = "",
            cargoType = "",
            loadDetails = "",
        )

        val card = job.toLiveLoadCardData()

        assertTrue(card.companyName.isNotBlank())
        assertEquals("Vehicle TBC", card.vehicleType)
        assertEquals("Delivery location TBC", card.deliveryLine)
        assertEquals("Time TBC", card.pickupTime)
        assertEquals("Time TBC", card.deliveryTime)
        assertEquals("Freight details pending", card.freightSummary)
    }

    @Test
    fun `empty state copy matches selected box`() {
        assertEquals("No live loads.", liveLoadsEmptyState(LiveLoadsBox.LIVE, "LS1").title)
        assertEquals("No pinned loads.", liveLoadsEmptyState(LiveLoadsBox.PINNED, "LS1").title)
        assertEquals("No hidden loads.", liveLoadsEmptyState(LiveLoadsBox.HIDDEN, "LS1").title)
    }

    @Test
    fun `bottom nav labels remain in product order`() {
        assertEquals(
            listOf("Loads", "Updates", "Offers", "Runs", "More"),
            primaryBottomNavLabels(0),
        )
    }

    private fun job(
        id: String,
        pickupLocation: String = "Leeds LS1",
        deliveryLocation: String = "Bristol BS1",
        pickupDatetime: String? = "2026-07-31T09:15:00Z",
        deliveryDatetime: String? = "2026-07-31T14:45:00Z",
        clientName: String = "Acme Freight",
        vehicleType: String = "Luton Van",
        cargoType: String = "General freight",
        loadDetails: String = "",
    ) = DriverJob(
        id = id,
        status = "posted",
        currentStatus = "posted",
        pickupLocation = pickupLocation,
        deliveryLocation = deliveryLocation,
        pickupDatetime = pickupDatetime,
        deliveryDatetime = deliveryDatetime,
        clientName = clientName,
        clientPhone = "",
        vehicleType = vehicleType,
        cargoType = cargoType,
        budgetAmount = 180.0,
        loadDetails = loadDetails,
    )
}
