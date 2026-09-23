package co.uk.xdrivelogistics.driver.nativepreview.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import co.uk.xdrivelogistics.driver.nativepreview.data.LoadsRepository
import co.uk.xdrivelogistics.driver.nativepreview.model.NativeLoad
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class LoadsUiState(
    val loads: List<NativeLoad> = emptyList(),
    val loading: Boolean = false,
    val refreshing: Boolean = false,
    val source: String? = null,
    val error: String? = null,
    val quoteSubmitting: Boolean = false,
    val quoteSuccess: String? = null,
    val quoteError: String? = null,
    val savedLoadIds: Set<String> = emptySet(),
    val dismissedLoadIds: Set<String> = emptySet()
)

class LoadsViewModel(
    private val repository: LoadsRepository,
    private val authStore: co.uk.xdrivelogistics.driver.nativepreview.data.AuthStore
) : ViewModel() {
    private val _state = MutableStateFlow(LoadsUiState(savedLoadIds = authStore.readSavedLoadIds(), dismissedLoadIds = authStore.readDismissedLoadIds()))
    val state: StateFlow<LoadsUiState> = _state.asStateFlow()

    fun loadCachedOnly() {
        val cached = repository.cached()
        _state.value = if (cached != null) {
            _state.value.copy(loads = cached.loads, source = cached.source)
        } else {
            _state.value.copy(loads = emptyList(), source = null)
        }
    }

    fun load() {
        val cached = repository.cached()
        if (cached != null) {
            _state.value = _state.value.copy(
                loads = cached.loads,
                loading = false,
                refreshing = true,
                source = cached.source
            )
        } else {
            _state.value = _state.value.copy(loading = true)
        }
        refresh()
    }

    fun refresh() {
        if (_state.value.refreshing && _state.value.source == "live") return
        viewModelScope.launch {
            _state.value = _state.value.copy(
                refreshing = true,
                loading = _state.value.loads.isEmpty(),
                error = null
            )

            repository.refresh()
                .onSuccess { snapshot ->
                    _state.value = _state.value.copy(
                        loads = snapshot.loads,
                        loading = false,
                        refreshing = false,
                        source = snapshot.source,
                        error = null
                    )
                }
                .onFailure { error ->
                    _state.value = _state.value.copy(
                        loading = false,
                        refreshing = false,
                        error = error.message ?: "Loads could not be refreshed."
                    )
                }
        }
    }

    fun submitQuote(
        jobId: String,
        amount: Double,
        collectWithinMinutes: Int?,
        message: String
    ) {
        if (_state.value.quoteSubmitting) return
        viewModelScope.launch {
            _state.value = _state.value.copy(
                quoteSubmitting = true,
                quoteSuccess = null,
                quoteError = null
            )
            repository.submitQuote(jobId, amount, collectWithinMinutes, message)
                .onSuccess { bidId ->
                    _state.value = _state.value.copy(
                        quoteSubmitting = false,
                        quoteSuccess = bidId.ifBlank { "submitted" }
                    )
                }
                .onFailure { error ->
                    _state.value = _state.value.copy(
                        quoteSubmitting = false,
                        quoteError = error.message ?: "Quote could not be submitted."
                    )
                }
        }
    }

    fun clearQuoteResult() {
        _state.value = _state.value.copy(quoteSuccess = null, quoteError = null)
    }

    fun toggleSaved(loadId: String) {
        val saved = loadId !in _state.value.savedLoadIds
        authStore.setLoadSaved(loadId, saved)
        if (saved) authStore.setLoadDismissed(loadId, false)
        _state.value = _state.value.copy(
            savedLoadIds = authStore.readSavedLoadIds(),
            dismissedLoadIds = authStore.readDismissedLoadIds()
        )
    }

    fun toggleDismissed(loadId: String) {
        val dismissed = loadId !in _state.value.dismissedLoadIds
        authStore.setLoadDismissed(loadId, dismissed)
        if (dismissed) authStore.setLoadSaved(loadId, false)
        _state.value = _state.value.copy(
            savedLoadIds = authStore.readSavedLoadIds(),
            dismissedLoadIds = authStore.readDismissedLoadIds()
        )
    }

    fun clearForSignOut() {
        _state.value = LoadsUiState()
    }
}
