package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverNotification
import co.uk.xdrivelogistics.driver.data.NearbyDriver
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class NativeUsefulParityTest {
    @Test
    fun `unread count uses authoritative readAt state`() {
        val notifications = listOf(
            notification("n1", null),
            notification("n2", ""),
            notification("n3", "2026-09-04T12:00:00Z"),
        )

        assertEquals(2, unreadUpdatesCount(notifications))
        assertEquals("Updates 2", unreadUpdatesLabel(unreadUpdatesCount(notifications)))
    }

    @Test
    fun `updates label caps large counts`() {
        assertEquals("Updates", unreadUpdatesLabel(0))
        assertEquals("Updates 99+", unreadUpdatesLabel(100))
    }

    @Test
    fun `nearby driver rows deduplicate and omit raw coordinates`() {
        val rows = nearbyDriverDisplayRows(
            listOf(
                NearbyDriver("driver-1", "Daniel", "Luton", 53.1, -2.4, "2026-09-04T15:00:00Z"),
                NearbyDriver("driver-1", "Duplicate", "Van", 54.0, -3.0, "2026-09-04T15:01:00Z"),
                NearbyDriver("driver-2", "", "", null, null, null),
            ),
        )

        assertEquals(2, rows.size)
        assertEquals("Daniel", rows[0].driverName)
        assertEquals("Luton", rows[0].vehicleLabel)
        assertEquals("Driver", rows[1].driverName)
        assertEquals("Vehicle TBC", rows[1].vehicleLabel)
        assertEquals("Last seen unavailable", rows[1].lastSeenLabel)
        assertFalse(rows[0].toString().contains("53.1"))
        assertFalse(rows[0].toString().contains("-2.4"))
    }

    private fun notification(id: String, readAt: String?) = DriverNotification(
        id = id,
        title = "Update",
        body = "Body",
        type = "dispatcher_message",
        readAt = readAt,
        createdAt = "2026-09-04T14:00:00Z",
    )
}
