package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.jobs.DriverLifecycleTransitions
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DriverLifecycleTransitionsTest {
    @Test
    fun `transition guard enforces exact canonical sequence`() {
        assertTrue(DriverLifecycleTransitions.isValidTransition("allocated", "accepted"))
        assertTrue(DriverLifecycleTransitions.isValidTransition("accepted", "on_my_way_to_pickup"))
        assertTrue(DriverLifecycleTransitions.isValidTransition("loaded", "on_my_way_to_delivery"))
        assertFalse(DriverLifecycleTransitions.isValidTransition("awarded", "accepted"))
        assertFalse(DriverLifecycleTransitions.isValidTransition("allocated", "on_my_way_to_pickup"))
        assertFalse(DriverLifecycleTransitions.isValidTransition("on_site_pickup", "on_site_delivery"))
    }

    @Test
    fun `mobile actions map only mutation statuses`() {
        assertEquals("accept", DriverLifecycleTransitions.mobileActionFor("accepted"))
        assertEquals("on-my-way-delivery", DriverLifecycleTransitions.mobileActionFor("on_my_way_to_delivery"))
        assertEquals("delivered", DriverLifecycleTransitions.mobileActionFor("delivered"))
        assertEquals(null, DriverLifecycleTransitions.mobileActionFor("allocated"))
    }
}
