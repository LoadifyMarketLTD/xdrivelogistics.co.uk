package co.uk.xdrivelogistics.driver.nativepreview.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import co.uk.xdrivelogistics.driver.nativepreview.data.DriverRepository
import co.uk.xdrivelogistics.driver.nativepreview.model.NativeAlert
import co.uk.xdrivelogistics.driver.nativepreview.model.NativeBooking
import co.uk.xdrivelogistics.driver.nativepreview.model.NativeQuote
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class DriverModulesState(
    val loading: Boolean = false,
    val quotes: List<NativeQuote> = emptyList(),
    val bookings: List<NativeBooking> = emptyList(),
    val upcoming: List<NativeBooking> = emptyList(),
    val completed: List<NativeBooking> = emptyList(),
    val alerts: List<NativeAlert> = emptyList(),
    val error: String? = null
)

class DriverModulesViewModel(
    private val repo: DriverRepository
) : ViewModel() {
    private val _state = MutableStateFlow(DriverModulesState())
    val state: StateFlow<DriverModulesState> = _state.asStateFlow()

    fun load() {
        if (_state.value.loading) return
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)

            val quotes = async { repo.quotes() }
            val active = async { repo.bookings("active") }
            val upcoming = async { repo.bookings("upcoming") }
            val completed = async { repo.bookings("completed") }
            val alerts = async { repo.alerts() }

            val qr = quotes.await()
            val ar = active.await()
            val ur = upcoming.await()
            val cr = completed.await()
            val alr = alerts.await()

            _state.value = DriverModulesState(
                loading = false,
                quotes = qr.getOrDefault(emptyList()),
                bookings = ar.getOrDefault(emptyList()),
                upcoming = ur.getOrDefault(emptyList()),
                completed = cr.getOrDefault(emptyList()),
                alerts = alr.getOrDefault(emptyList()),
                error = listOf(qr, ar, ur, cr, alr)
                    .firstNotNullOfOrNull { it.exceptionOrNull()?.message }
            )
        }
    }

    fun alertAction(id: String, action: String) {
        viewModelScope.launch {
            val result = repo.alertAction(id, action)
            if (result.isFailure) {
                _state.value = _state.value.copy(error = result.exceptionOrNull()?.message)
                return@launch
            }
            val alerts = repo.alerts()
            _state.value = _state.value.copy(
                alerts = alerts.getOrDefault(_state.value.alerts),
                error = alerts.exceptionOrNull()?.message
            )
        }
    }

    fun clear() {
        _state.value = DriverModulesState()
    }
}
