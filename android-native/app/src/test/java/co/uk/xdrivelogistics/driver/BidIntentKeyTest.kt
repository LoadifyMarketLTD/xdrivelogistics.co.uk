package co.uk.xdrivelogistics.driver

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class BidIntentKeyTest {

    @Test
    fun `stableBidIntentKey is identical for same logical normalized payload`() {
        val keyA = stableBidIntentKey(
            jobId = "job-1",
            ownerUserId = "owner-1",
            driverId = "driver-1",
            amount = 120.0,
            currency = "gbp",
            message = "  Counter offer  ",
        )
        val keyB = stableBidIntentKey(
            jobId = "job-1",
            ownerUserId = "owner-1",
            driverId = "driver-1",
            amount = 120.00,
            currency = " GBP ",
            message = "Counter offer",
        )
        assertEquals(keyA, keyB)
    }

    @Test
    fun `stableBidIntentKey changes when job owner driver amount or message changes`() {
        val base = stableBidIntentKey(
            jobId = "job-1",
            ownerUserId = "owner-1",
            driverId = "driver-1",
            amount = 120.0,
            currency = "GBP",
            message = "Counter offer",
        )
        assertNotEquals(base, stableBidIntentKey("job-2", "owner-1", "driver-1", 120.0, "GBP", "Counter offer"))
        assertNotEquals(base, stableBidIntentKey("job-1", "owner-2", "driver-1", 120.0, "GBP", "Counter offer"))
        assertNotEquals(base, stableBidIntentKey("job-1", "owner-1", "driver-2", 120.0, "GBP", "Counter offer"))
        assertNotEquals(base, stableBidIntentKey("job-1", "owner-1", "driver-1", 121.0, "GBP", "Counter offer"))
        assertNotEquals(base, stableBidIntentKey("job-1", "owner-1", "driver-1", 120.0, "GBP", "Different note"))
    }
}
