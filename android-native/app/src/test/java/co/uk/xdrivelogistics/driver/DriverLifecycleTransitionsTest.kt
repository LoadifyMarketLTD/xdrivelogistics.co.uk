package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.jobs.DriverLifecycleTransitions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DriverLifecycleTransitionsTest {
    @Test
    fun `transition guard allows only adjacent canonical moves`() {
        val sequence = listOf(
            "posted",
            "quoted",
            "awarded",
            "allocated",
            "accepted",
            "on_my_way_to_pickup",
            "on_site_pickup",
            "loaded",
            "on_my_way_to_delivery",
            "on_site_delivery",
            "delivered",
        )

        for (index in 0 until sequence.lastIndex) {
            val current = sequence[index]
            val next = sequence[index + 1]
            val expected = current !in setOf("posted", "quoted", "awarded")
            assertEquals(
                "Unexpected transition validation for $current -> $next",
                expected,
                DriverLifecycleTransitions.isValidTransition(current, next),
            )
        }

        // Explicit regression: no awarded -> accepted skip.
        assertFalse(DriverLifecycleTransitions.isValidTransition("awarded", "accepted"))

        // Every non-adjacent transition must be rejected.
        for (fromIndex in sequence.indices) {
            for (toIndex in sequence.indices) {
                val from = sequence[fromIndex]
                val to = sequence[toIndex]
                if (toIndex == fromIndex + 1 && from !in setOf("posted", "quoted", "awarded")) continue
                assertFalse(
                    "Skip/invalid transition should be rejected: $from -> $to",
                    DriverLifecycleTransitions.isValidTransition(from, to),
                )
            }
        }
    }

    @Test
    fun `mobile actions map only mutation statuses`() {
        assertEquals("accept", DriverLifecycleTransitions.mobileActionFor("accepted"))
        assertEquals("on-my-way-delivery", DriverLifecycleTransitions.mobileActionFor("on_my_way_to_delivery"))
        assertEquals("delivered", DriverLifecycleTransitions.mobileActionFor("delivered"))
        assertEquals(null, DriverLifecycleTransitions.mobileActionFor("allocated"))
    }
}
