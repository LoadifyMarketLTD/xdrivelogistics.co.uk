package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverJob
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class JobStatusTransitionTest {

    // ── normalizeDriverStatus ─────────────────────────────────────────────────

    @Test
    fun `blank status normalises to unknown, not allocated`() {
        assertEquals("unknown", normalizeDriverStatus(""))
    }

    @Test
    fun `whitespace-only status normalises to unknown`() {
        assertEquals("unknown", normalizeDriverStatus("   "))
    }

    @Test
    fun `assigned normalises to allocated`() {
        assertEquals("allocated", normalizeDriverStatus("assigned"))
    }

    @Test
    fun `accepted normalises to allocated`() {
        assertEquals("allocated", normalizeDriverStatus("accepted"))
    }

    @Test
    fun `awarded passes through unchanged`() {
        assertEquals("awarded", normalizeDriverStatus("awarded"))
    }

    @Test
    fun `arrived_pickup normalises to on_site_pickup`() {
        assertEquals("on_site_pickup", normalizeDriverStatus("arrived_pickup"))
    }

    @Test
    fun `collected normalises to loaded`() {
        assertEquals("loaded", normalizeDriverStatus("collected"))
    }

    @Test
    fun `on_route_delivery normalises to in_transit`() {
        assertEquals("in_transit", normalizeDriverStatus("on_route_delivery"))
    }

    @Test
    fun `on_my_way_to_delivery normalises to in_transit`() {
        assertEquals("in_transit", normalizeDriverStatus("on_my_way_to_delivery"))
    }

    @Test
    fun `arrived_delivery normalises to on_site_delivery`() {
        assertEquals("on_site_delivery", normalizeDriverStatus("arrived_delivery"))
    }

    @Test
    fun `on_my_way passes through unchanged`() {
        assertEquals("on_my_way", normalizeDriverStatus("on_my_way"))
    }

    @Test
    fun `unrecognised status passes through in lowercase`() {
        assertEquals("something_new", normalizeDriverStatus("something_new"))
    }

    // ── isValidTransition — blank and unknown inputs ──────────────────────────

    @Test
    fun `blank currentRaw cannot transition to on_my_way`() {
        assertFalse(isValidTransition("", "on_my_way"))
    }

    @Test
    fun `whitespace currentRaw cannot transition to on_my_way`() {
        assertFalse(isValidTransition("   ", "on_my_way"))
    }

    @Test
    fun `unknown status cannot start workflow`() {
        assertFalse(isValidTransition("unknown", "on_my_way"))
        assertFalse(isValidTransition("unknown", "on_site_pickup"))
        assertFalse(isValidTransition("unknown", "loaded"))
    }

    @Test
    fun `unrecognised status cannot start workflow`() {
        assertFalse(isValidTransition("future_status_not_yet_known", "on_my_way"))
    }

    // ── isValidTransition — canonical and alias transitions ───────────────────

    @Test
    fun `allocated can transition to on_my_way`() {
        assertTrue(isValidTransition("allocated", "on_my_way"))
    }

    @Test
    fun `awarded can transition to on_my_way`() {
        assertTrue(isValidTransition("awarded", "on_my_way"))
    }

    @Test
    fun `assigned alias normalises and can transition to on_my_way`() {
        assertTrue(isValidTransition("assigned", "on_my_way"))
    }

    @Test
    fun `accepted alias normalises and can transition to on_my_way`() {
        assertTrue(isValidTransition("accepted", "on_my_way"))
    }

    @Test
    fun `full canonical chain is valid step by step`() {
        assertTrue(isValidTransition("on_my_way", "on_site_pickup"))
        assertTrue(isValidTransition("on_site_pickup", "loaded"))
        assertTrue(isValidTransition("loaded", "in_transit"))
        assertTrue(isValidTransition("in_transit", "on_site_delivery"))
        assertTrue(isValidTransition("on_site_delivery", "delivered"))
        assertTrue(isValidTransition("delivered", "completed"))
    }

    @Test
    fun `legacy arrived_pickup alias can transition to loaded`() {
        assertTrue(isValidTransition("arrived_pickup", "loaded"))
    }

    @Test
    fun `legacy arrived_delivery alias can transition to delivered`() {
        assertTrue(isValidTransition("arrived_delivery", "delivered"))
    }

    @Test
    fun `legacy on_route_delivery alias can transition to on_site_delivery`() {
        assertTrue(isValidTransition("on_route_delivery", "on_site_delivery"))
    }

    @Test
    fun `skipping a step is never valid`() {
        assertFalse(isValidTransition("allocated", "loaded"))
        assertFalse(isValidTransition("allocated", "in_transit"))
        assertFalse(isValidTransition("on_my_way", "loaded"))
        assertFalse(isValidTransition("on_site_pickup", "in_transit"))
        assertFalse(isValidTransition("loaded", "on_site_delivery"))
    }

    @Test
    fun `going backwards is never valid`() {
        assertFalse(isValidTransition("on_my_way", "on_my_way"))
        assertFalse(isValidTransition("loaded", "on_site_pickup"))
        assertFalse(isValidTransition("delivered", "in_transit"))
    }

    // ── resolveSelectedJobId ──────────────────────────────────────────────────

    @Test
    fun `valid selectedJobId is preserved when job still in list`() {
        val jobs = listOf(job("job-a", "allocated"), job("job-b", "on_my_way"))
        assertEquals("job-b", resolveSelectedJobId("job-b", jobs))
    }

    @Test
    fun `stale selectedJobId is replaced when job removed from list`() {
        val jobs = listOf(job("job-a", "allocated"), job("job-b", "on_my_way"))
        val result = resolveSelectedJobId("job-removed", jobs)
        // Stale ID must not persist; the first available job is selected instead.
        assertFalse("stale ID must not persist", result == "job-removed")
        assertTrue("first available job must be selected", jobs.any { it.id == result })
    }

    @Test
    fun `null selectedJobId falls back to first job in list`() {
        val jobs = listOf(job("job-a", "allocated"), job("job-b", "on_my_way"))
        assertEquals("job-a", resolveSelectedJobId(null, jobs))
    }

    @Test
    fun `null selectedJobId returns null when list is empty`() {
        assertNull(resolveSelectedJobId(null, emptyList()))
    }

    @Test
    fun `stale selectedJobId returns null when list is empty`() {
        assertNull(resolveSelectedJobId("job-gone", emptyList()))
    }

    @Test
    fun `selectedJobId preserved when it is the only job in list`() {
        val jobs = listOf(job("job-only", "allocated"))
        assertEquals("job-only", resolveSelectedJobId("job-only", jobs))
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private fun job(id: String, status: String) = DriverJob(
        id = id,
        status = status,
        currentStatus = status,
        pickupLocation = "Pickup",
        deliveryLocation = "Delivery",
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
