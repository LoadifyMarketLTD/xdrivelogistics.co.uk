package co.uk.xdrivelogistics.driver

import co.uk.xdrivelogistics.driver.data.AvailabilityPresence

data class AvailabilityPresenceUiState(
    val active: Boolean = false,
    val visibility: String = "private",
    val availableUntil: String? = null,
    val isSaving: Boolean = false,
    val message: String = "",
    val error: String = "",
) {
    companion object {
        fun from(presence: AvailabilityPresence): AvailabilityPresenceUiState = AvailabilityPresenceUiState(
            active = presence.active,
            visibility = presence.visibility,
            availableUntil = presence.availableUntil,
        )
    }
}
