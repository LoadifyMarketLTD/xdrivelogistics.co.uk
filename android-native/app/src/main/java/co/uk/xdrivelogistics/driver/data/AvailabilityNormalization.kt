package co.uk.xdrivelogistics.driver.data

import java.util.Locale

internal val availabilitySlotNames = listOf("AM", "PM", "EVENING")

internal fun normalizeAvailabilitySlots(rows: List<DriverAvailabilitySlot>): List<DriverAvailabilitySlot> {
    val normalized = linkedMapOf<String, DriverAvailabilitySlot>()
    for (day in 0..6) {
        for (slot in availabilitySlotNames) {
            normalized["$day:$slot"] = DriverAvailabilitySlot(dayOfWeek = day, slot = slot, available = false)
        }
    }

    for (slot in rows) {
        if (slot.dayOfWeek !in 0..6) continue
        val normalizedSlot = slot.slot.trim().uppercase(Locale.ROOT)
        if (normalizedSlot !in availabilitySlotNames) continue
        normalized["${slot.dayOfWeek}:$normalizedSlot"] = DriverAvailabilitySlot(
            dayOfWeek = slot.dayOfWeek,
            slot = normalizedSlot,
            available = slot.available,
        )
    }
    return normalized.values.toList()
}
