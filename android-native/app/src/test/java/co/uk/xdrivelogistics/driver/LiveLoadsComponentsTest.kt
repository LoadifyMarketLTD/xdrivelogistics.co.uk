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

    @Test
    fun `pin preference targets only the tapped job when two jobs exist`() {
        val prefs = mutableMapOf<String, String?>()

        // Simulate pinning job-two while job-one is untouched
        prefs["job-two"] = applyLiveLoadPreferenceAction(LiveLoadPreferenceAction.PIN)

        assertEquals(null, prefs["job-one"])
        assertEquals("saved", prefs["job-two"])
    }

    @Test
    fun `hide preference targets only the tapped job when two jobs exist`() {
        val prefs = mutableMapOf<String, String?>()

        prefs["job-two"] = applyLiveLoadPreferenceAction(LiveLoadPreferenceAction.HIDE)

        assertEquals(null, prefs["job-one"])
        assertEquals("deleted", prefs["job-two"])
    }

    @Test
    fun `restore preference targets only the tapped job when two jobs exist`() {
        val prefs = mutableMapOf<String, String?>()
        prefs["job-one"] = "saved"
        prefs["job-two"] = "saved"

        prefs["job-two"] = applyLiveLoadPreferenceAction(LiveLoadPreferenceAction.RESTORE)

        assertEquals("saved", prefs["job-one"])
        assertEquals(null, prefs["job-two"])
    }

    // -----------------------------------------------------------------------
    // Quote submission validation tests
    // -----------------------------------------------------------------------

    @Test
    fun `validateQuoteSubmission returns OK for valid posted job and positive amount`() {
        val jobs = listOf(job("job-a"))
        val result = validateQuoteSubmission("job-a", jobs, "120.00")
        assertEquals(QuoteValidationResult.OK, result)
    }

    @Test
    fun `validateQuoteSubmission returns NO_JOB_SELECTED when quoteJobId is null`() {
        val result = validateQuoteSubmission(null, listOf(job("job-a")), "100.00")
        assertEquals(QuoteValidationResult.NO_JOB_SELECTED, result)
    }

    @Test
    fun `validateQuoteSubmission returns NO_JOB_SELECTED when quoteJobId is not in jobs list`() {
        val result = validateQuoteSubmission("job-missing", listOf(job("job-a")), "100.00")
        assertEquals(QuoteValidationResult.NO_JOB_SELECTED, result)
    }

    @Test
    fun `validateQuoteSubmission returns JOB_NOT_POSTED for non-posted job`() {
        val allocated = job("job-alloc").copy(status = "allocated", currentStatus = "allocated")
        val result = validateQuoteSubmission("job-alloc", listOf(allocated), "100.00")
        assertEquals(QuoteValidationResult.JOB_NOT_POSTED, result)
    }

    @Test
    fun `validateQuoteSubmission returns INVALID_AMOUNT for zero amount`() {
        val result = validateQuoteSubmission("job-a", listOf(job("job-a")), "0")
        assertEquals(QuoteValidationResult.INVALID_AMOUNT, result)
    }

    @Test
    fun `validateQuoteSubmission returns INVALID_AMOUNT for negative amount`() {
        val result = validateQuoteSubmission("job-a", listOf(job("job-a")), "-50")
        assertEquals(QuoteValidationResult.INVALID_AMOUNT, result)
    }

    @Test
    fun `validateQuoteSubmission returns INVALID_AMOUNT for non-numeric amount`() {
        val result = validateQuoteSubmission("job-a", listOf(job("job-a")), "abc")
        assertEquals(QuoteValidationResult.INVALID_AMOUNT, result)
    }

    @Test
    fun `resolveQuoteJobId returns id of explicitly opened job ignoring other jobs in list`() {
        val jobs = listOf(job("job-a"), job("job-b"), job("job-c"))
        val resolved = resolveQuoteJobId("job-b", jobs)
        assertEquals("job-b", resolved)
    }

    @Test
    fun `resolveQuoteJobId returns null when quoteJobId not in jobs list`() {
        val jobs = listOf(job("job-a"), job("job-b"))
        val resolved = resolveQuoteJobId("job-missing", jobs)
        assertEquals(null, resolved)
    }

    @Test
    fun `resolveQuoteJobId returns null when quoteJobId is null`() {
        val resolved = resolveQuoteJobId(null, listOf(job("job-a")))
        assertEquals(null, resolved)
    }

    @Test
    fun `resolveQuoteJobId is not affected by which job was previously selected`() {
        // Simulates: job-a was previously selected; user then opens quote for job-b
        val previouslySelected = "job-a"
        val openedForQuote = "job-b"
        val jobs = listOf(job(previouslySelected), job(openedForQuote))

        val resolved = resolveQuoteJobId(openedForQuote, jobs)

        assertEquals(openedForQuote, resolved)
        assertTrue(resolved != previouslySelected)
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
