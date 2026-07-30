package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LiveLoadsComponentsTest {
    @Test
    fun `route helper selects same job and opens action tab`() {
        var selectedJob: String? = null
        var selectedTab: DriverTab? = null

        routeToLiveLoadDetails(
            jobId = "job-live-1",
            onJobSelected = { selectedJob = it },
            onTabChange = { selectedTab = it },
        )

        assertEquals("job-live-1", selectedJob)
        assertEquals(DriverTab.ACTION, selectedTab)
    }

    @Test
    fun `live load card data includes visible hierarchy fields`() {
        val job = DriverJob(
            id = "live-load-12345678",
            status = "posted",
            currentStatus = "posted",
            pickupLocation = "Leeds LS1",
            deliveryLocation = "Bristol BS1",
            pickupDatetime = "2026-07-31T09:15:00Z",
            deliveryDatetime = "2026-07-31T14:45:00Z",
            clientName = "Acme Freight",
            clientPhone = "",
            vehicleType = "Luton Van",
            cargoType = "General freight",
            budgetAmount = 180.0,
            loadDetails = """{"pallets":"6","weight":"1200"}""",
        )

        val card = job.toLiveLoadCardData()

        assertTrue(card.companyAndReference.contains("Acme Freight"))
        assertTrue(card.companyAndReference.contains("REF"))
        assertEquals("Luton Van", card.vehicleType)
        assertEquals("Leeds LS1", card.pickupLine)
        assertEquals("Bristol BS1", card.deliveryLine)
        assertTrue(card.freightSummary.contains("General freight"))
        assertTrue(card.freightSummary.contains("6 pallets"))
        assertTrue(card.freightSummary.contains("1200 kg"))
    }
}
