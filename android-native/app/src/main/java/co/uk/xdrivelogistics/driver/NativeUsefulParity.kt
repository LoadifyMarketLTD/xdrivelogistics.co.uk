package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.DriverNotification
import co.uk.xdrivelogistics.driver.data.NearbyDriver

data class NearbyDriverDisplayRow(
    val driverId: String,
    val driverName: String,
    val vehicleLabel: String,
    val lastSeenLabel: String,
)

/**
 * Native uses the backend-authoritative readAt field rather than the Expo
 * preview's local notificationsSeenAt timestamp. This keeps the unread badge
 * consistent across devices and sessions.
 */
internal fun unreadUpdatesCount(notifications: List<DriverNotification>): Int =
    notifications.count { it.readAt.isNullOrBlank() }

internal fun unreadUpdatesLabel(unreadCount: Int): String = when {
    unreadCount <= 0 -> "Updates"
    unreadCount > 99 -> "Updates 99+"
    else -> "Updates $unreadCount"
}

/**
 * The native resources endpoint already supplies nearby-driver data. For the
 * UI we intentionally expose only identity, vehicle and recency. Raw latitude
 * and longitude remain out of the rendered row.
 */
internal fun nearbyDriverDisplayRows(drivers: List<NearbyDriver>): List<NearbyDriverDisplayRow> =
    drivers
        .asSequence()
        .filter { it.driverId.isNotBlank() }
        .distinctBy { it.driverId }
        .map { driver ->
            NearbyDriverDisplayRow(
                driverId = driver.driverId,
                driverName = driver.driverName.ifBlank { "Driver" },
                vehicleLabel = driver.vehicleLabel.ifBlank { "Vehicle TBC" },
                lastSeenLabel = driver.recordedAt?.takeIf { it.isNotBlank() } ?: "Last seen unavailable",
            )
        }
        .toList()
