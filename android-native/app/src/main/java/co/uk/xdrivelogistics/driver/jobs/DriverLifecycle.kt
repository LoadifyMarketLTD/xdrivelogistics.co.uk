package co.uk.xdrivelogistics.driver.jobs

enum class CanonicalDriverLifecycleStatus(val wireValue: String) {
    ALLOCATED("allocated"),
    ACCEPTED("accepted"),
    ON_MY_WAY_TO_PICKUP("on_my_way_to_pickup"),
    ON_SITE_PICKUP("on_site_pickup"),
    LOADED("loaded"),
    ON_MY_WAY_TO_DELIVERY("on_my_way_to_delivery"),
    ON_SITE_DELIVERY("on_site_delivery"),
    DELIVERED("delivered"),
    ;

    companion object {
        fun fromRaw(raw: String?): CanonicalDriverLifecycleStatus? =
            when (raw.orEmpty().trim().lowercase()) {
                "allocated", "assigned", "awarded" -> ALLOCATED
                "accepted" -> ACCEPTED
                "on_my_way_to_pickup", "on_my_way" -> ON_MY_WAY_TO_PICKUP
                "on_site_pickup", "arrived_pickup" -> ON_SITE_PICKUP
                "loaded", "collected" -> LOADED
                "on_my_way_to_delivery", "in_transit", "on_route_delivery" -> ON_MY_WAY_TO_DELIVERY
                "on_site_delivery", "arrived_delivery" -> ON_SITE_DELIVERY
                "delivered" -> DELIVERED
                else -> null
            }
    }
}

object DriverLifecycleTransitions {
    fun nextStatus(currentRaw: String): CanonicalDriverLifecycleStatus? =
        when (CanonicalDriverLifecycleStatus.fromRaw(currentRaw)) {
            CanonicalDriverLifecycleStatus.ALLOCATED -> CanonicalDriverLifecycleStatus.ACCEPTED
            CanonicalDriverLifecycleStatus.ACCEPTED -> CanonicalDriverLifecycleStatus.ON_MY_WAY_TO_PICKUP
            CanonicalDriverLifecycleStatus.ON_MY_WAY_TO_PICKUP -> CanonicalDriverLifecycleStatus.ON_SITE_PICKUP
            CanonicalDriverLifecycleStatus.ON_SITE_PICKUP -> CanonicalDriverLifecycleStatus.LOADED
            CanonicalDriverLifecycleStatus.LOADED -> CanonicalDriverLifecycleStatus.ON_MY_WAY_TO_DELIVERY
            CanonicalDriverLifecycleStatus.ON_MY_WAY_TO_DELIVERY -> CanonicalDriverLifecycleStatus.ON_SITE_DELIVERY
            CanonicalDriverLifecycleStatus.ON_SITE_DELIVERY -> CanonicalDriverLifecycleStatus.DELIVERED
            CanonicalDriverLifecycleStatus.DELIVERED, null -> null
        }

    fun isValidTransition(currentRaw: String, nextRaw: String): Boolean {
        val next = CanonicalDriverLifecycleStatus.fromRaw(nextRaw) ?: return false
        return nextStatus(currentRaw) == next
    }

    fun mobileActionFor(nextStatusRaw: String): String? =
        when (CanonicalDriverLifecycleStatus.fromRaw(nextStatusRaw)) {
            CanonicalDriverLifecycleStatus.ACCEPTED -> "accept"
            CanonicalDriverLifecycleStatus.ON_MY_WAY_TO_PICKUP -> "on-my-way-pickup"
            CanonicalDriverLifecycleStatus.ON_SITE_PICKUP -> "arrived-pickup"
            CanonicalDriverLifecycleStatus.LOADED -> "loaded"
            CanonicalDriverLifecycleStatus.ON_MY_WAY_TO_DELIVERY -> "on-my-way-delivery"
            CanonicalDriverLifecycleStatus.ON_SITE_DELIVERY -> "arrived-delivery"
            CanonicalDriverLifecycleStatus.DELIVERED -> "delivered"
            CanonicalDriverLifecycleStatus.ALLOCATED, null -> null
        }
}
