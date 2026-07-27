package co.uk.xdrivelogistics.driver.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AvailabilityNormalizationTest {
    @Test
    fun `sparse server slots normalize to deterministic seven-day three-slot grid`() {
        val normalized = normalizeAvailabilitySlots(
            listOf(
                DriverAvailabilitySlot(dayOfWeek = 0, slot = "AM", available = true),
                DriverAvailabilitySlot(dayOfWeek = 6, slot = "EVENING", available = true),
            ),
        )

        assertEquals(21, normalized.size)
        assertEquals((0..6).flatMap { day -> listOf("$day:AM", "$day:PM", "$day:EVENING") }, normalized.map { "${it.dayOfWeek}:${it.slot}" })
        assertTrue(normalized.first { it.dayOfWeek == 0 && it.slot == "AM" }.available)
        assertTrue(normalized.first { it.dayOfWeek == 6 && it.slot == "EVENING" }.available)
        assertFalse(normalized.first { it.dayOfWeek == 0 && it.slot == "PM" }.available)
    }

    @Test
    fun `normalized availability keeps explicit slot changes scoped to the target pair`() {
        val normalized = normalizeAvailabilitySlots(
            listOf(
                DriverAvailabilitySlot(dayOfWeek = 2, slot = "AM", available = true),
                DriverAvailabilitySlot(dayOfWeek = 2, slot = "PM", available = false),
                DriverAvailabilitySlot(dayOfWeek = 2, slot = "EVENING", available = true),
            ),
        )

        assertTrue(normalized.first { it.dayOfWeek == 2 && it.slot == "AM" }.available)
        assertFalse(normalized.first { it.dayOfWeek == 2 && it.slot == "PM" }.available)
        assertTrue(normalized.first { it.dayOfWeek == 2 && it.slot == "EVENING" }.available)
    }
}
