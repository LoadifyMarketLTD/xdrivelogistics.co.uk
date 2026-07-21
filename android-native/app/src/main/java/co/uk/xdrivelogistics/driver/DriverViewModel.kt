package co.uk.xdrivelogistics.driver

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.DriverBid
import co.uk.xdrivelogistics.driver.data.DriverDocument
import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverNotification
import co.uk.xdrivelogistics.driver.data.DriverProfile
import co.uk.xdrivelogistics.driver.data.DriverReturnJourney
import co.uk.xdrivelogistics.driver.data.DriverInvoice
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.NearbyDriver
import co.uk.xdrivelogistics.driver.data.SessionStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class DriverTab {
    NEARBY,
    QUOTES,
    BOOKINGS,
    JOBS,
    SMARTPAY,
    ACTION,
    MESSAGES,
    PROFILE,
}

data class DriverUiState(
    val isLoading: Boolean = false,
    val isAuthenticated: Boolean = false,
    val session: DriverSession? = null,
    val profile: DriverProfile? = null,
    val jobs: List<DriverJob> = emptyList(),
    val documents: List<DriverDocument> = emptyList(),
    val bids: List<DriverBid> = emptyList(),
    val notifications: List<DriverNotification> = emptyList(),
    val returnJourney: DriverReturnJourney? = null,
    val invoices: List<DriverInvoice> = emptyList(),
    val nearbyDrivers: List<NearbyDriver> = emptyList(),
    val jobSearchPreferences: Map<String, String> = emptyMap(),
    val selectedTab: DriverTab = DriverTab.NEARBY,
    val selectedJobId: String? = null,
    val message: String = "",
    val error: String = "",
)

class DriverViewModel(application: Application) : AndroidViewModel(application) {
    private val sessionStore = SessionStore(application.applicationContext)
    private val api = ApiClient(
        xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
        supabaseUrl = BuildConfig.SUPABASE_URL,
        supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
    )

    private val _uiState = MutableStateFlow(DriverUiState())
    val uiState: StateFlow<DriverUiState> = _uiState.asStateFlow()
    private var liveRefreshJob: kotlinx.coroutines.Job? = null

    init {
        viewModelScope.launch {
            sessionStore.session.collectLatest { persisted ->
                if (persisted == null) {
                    _uiState.value = DriverUiState()
                    return@collectLatest
                }

                _uiState.value = _uiState.value.copy(
                    isAuthenticated = true,
                    session = persisted,
                    error = "",
                )
                refreshDriverData()
                startLiveRefresh(persisted)
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")

            val result = api.login(email.trim(), password)
            result
                .onSuccess { session ->
                    sessionStore.saveSession(session)
                    _uiState.value = _uiState.value.copy(message = "Login successful.")
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Login failed."),
                    )
                }
        }
    }

    fun logout() {
        viewModelScope.launch {
            liveRefreshJob?.cancel()
            sessionStore.clear()
        }
    }

    private fun startLiveRefresh(session: DriverSession) {
        liveRefreshJob?.cancel()
        liveRefreshJob = viewModelScope.launch {
            while (isActive) {
                delay(30_000L)
                val current = _uiState.value.session
                if (current?.accessToken == session.accessToken && !_uiState.value.isLoading) {
                    loadDriverDataWithSession(current, allowRefresh = true)
                }
            }
        }
    }

    fun changeTab(tab: DriverTab) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
    }

    fun selectJob(jobId: String) {
        _uiState.value = _uiState.value.copy(selectedJobId = jobId)
    }

    fun refreshDriverData() {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            loadDriverDataWithSession(session, allowRefresh = true)
        }
    }

    private suspend fun loadDriverDataWithSession(session: DriverSession, allowRefresh: Boolean) {
        api.resolveDriverProfile(session)
            .onSuccess { profile ->
                val documents = api.loadDriverDocuments(session, profile).getOrDefault(emptyList())
                val preferences = api.loadJobSearchPreferences(session, profile.driverId).getOrDefault(emptyMap())
                val bids = api.loadDriverBids(session, profile).getOrDefault(emptyList())
                val notifications = api.loadDriverNotifications(session).getOrDefault(emptyList())
                val returnJourney = api.loadReturnJourney(session, profile.driverId).getOrNull()
                val invoices = api.loadDriverInvoices(session, profile.companyId).getOrDefault(emptyList())
                val nearbyDrivers = api.loadNearbyDrivers(session, profile.companyId).getOrDefault(emptyList())
                api.loadAssignedJobs(session, profile)
                    .onSuccess { jobs ->
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            session = session,
                            profile = profile,
                            jobs = jobs,
                            documents = documents,
                            bids = bids,
                            notifications = notifications,
                            returnJourney = returnJourney,
                            invoices = invoices,
                            nearbyDrivers = nearbyDrivers,
                            jobSearchPreferences = preferences,
                            selectedJobId = _uiState.value.selectedJobId ?: jobs.firstOrNull()?.id,
                        )
                    }
                    .onFailure { error ->
                        if (allowRefresh && error.isSessionError()) {
                            refreshAndRetry(session)
                        } else {
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                profile = profile,
                                error = error.friendlyDriverMessage("Failed to load jobs."),
                            )
                        }
                    }
            }
            .onFailure { error ->
                if (allowRefresh && error.isSessionError()) {
                    refreshAndRetry(session)
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlySessionMessage() ?: error.friendlyDriverMessage("Failed to load driver profile."),
                    )
                }
            }
    }

    private suspend fun refreshAndRetry(session: DriverSession) {
        api.refreshSession(session)
            .onSuccess { refreshed ->
                sessionStore.saveSession(refreshed)
                _uiState.value = _uiState.value.copy(session = refreshed)
                loadDriverDataWithSession(refreshed, allowRefresh = false)
            }
            .onFailure {
                sessionStore.clear()
                _uiState.value = DriverUiState(error = "Your session expired. Please sign in again.")
            }
    }

    fun sendQuickNote(note: String, important: Boolean) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val jobId = _uiState.value.selectedJobId
            if (jobId.isNullOrBlank()) {
                _uiState.value = _uiState.value.copy(error = "Select a job first.")
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.sendQuickNote(session.accessToken, jobId, note.trim(), important)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Dispatch note sent.",
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to send note."),
                    )
                }
        }
    }

    fun markAlertRead(notificationId: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            api.markNotificationRead(session, notificationId)
                .onSuccess { refreshDriverData() }
                .onFailure { error -> _uiState.value = _uiState.value.copy(error = error.friendlyDriverMessage("Failed to mark alert read.")) }
        }
    }

    fun deleteAlert(notificationId: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            api.deleteNotification(session, notificationId)
                .onSuccess { refreshDriverData() }
                .onFailure { error -> _uiState.value = _uiState.value.copy(error = error.friendlyDriverMessage("Failed to delete alert.")) }
        }
    }

    fun saveReturnJourney(fromLocation: String, toLocation: String, availableDate: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val profile = _uiState.value.profile ?: return@launch
            if (fromLocation.isBlank() && toLocation.isBlank()) {
                _uiState.value = _uiState.value.copy(error = "Enter a journey location first.")
                return@launch
            }
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.saveReturnJourney(session, profile.driverId, fromLocation.trim(), toLocation.trim(), availableDate.trim())
                .onSuccess {
                    _uiState.value = _uiState.value.copy(isLoading = false, message = "Journey saved.")
                    refreshDriverData()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(isLoading = false, error = error.friendlyDriverMessage("Failed to save journey."))
                }
        }
    }

    fun sendLocation(lat: Double, lng: Double) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.sendLocation(session.accessToken, lat, lng)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Location published.",
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to publish location."),
                    )
                }
        }
    }

    fun updatePassword(newPassword: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.updatePassword(session.accessToken, newPassword)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Password updated.",
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to update password."),
                    )
                }
        }
    }

    fun moveSelectedJobTo(nextStatus: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val profile = _uiState.value.profile ?: return@launch
            val jobId = _uiState.value.selectedJobId
            if (jobId.isNullOrBlank()) {
                _uiState.value = _uiState.value.copy(error = "Select a job first.")
                return@launch
            }

            val selectedJob = _uiState.value.jobs.firstOrNull { it.id == jobId }
            if (selectedJob == null) {
                _uiState.value = _uiState.value.copy(error = "Selected job was not found.")
                return@launch
            }
            if (selectedJob.status.lowercase() == "posted" || selectedJob.currentStatus.lowercase() == "posted") {
                _uiState.value = _uiState.value.copy(error = "Submit a quote and wait for the customer to award the job before starting work.")
                return@launch
            }
            if (nextStatus == "delivered" && selectedJob.podPhotos.isEmpty() && selectedJob.deliveryPhotos.isEmpty()) {
                _uiState.value = _uiState.value.copy(error = "Upload POD before marking delivery complete.")
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            if (!isValidTransition(selectedJob.currentStatus.ifBlank { selectedJob.status }, nextStatus)) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "This job cannot move to $nextStatus from its current status.",
                )
                return@launch
            }

            api.updateJobStatus(session, profile.driverId, jobId, nextStatus)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Status moved to $nextStatus.",
                    )
                    refreshDriverData()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to update job status."),
                    )
                }
        }
    }

    fun submitQuoteForSelectedJob(amountText: String, note: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val profile = _uiState.value.profile ?: return@launch
            val selectedJob = _uiState.value.jobs.firstOrNull { it.id == _uiState.value.selectedJobId }
            if (selectedJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a posted job first.")
                return@launch
            }
            if (selectedJob.status.lowercase() != "posted") {
                _uiState.value = _uiState.value.copy(error = "Only posted jobs can be quoted.")
                return@launch
            }
            val amount = amountText.trim().toDoubleOrNull()
            if (amount == null || amount <= 0.0) {
                _uiState.value = _uiState.value.copy(error = "Enter a valid quote amount.")
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.submitJobQuote(session, profile, selectedJob.id, amount, note.trim())
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Quote submitted.",
                    )
                    refreshDriverData()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to submit quote."),
                    )
                }
        }
    }

    fun uploadPodForSelectedJob(fileName: String, mimeType: String, bytes: ByteArray) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val profile = _uiState.value.profile ?: return@launch
            val selectedJob = _uiState.value.jobs.firstOrNull { it.id == _uiState.value.selectedJobId }
            if (selectedJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a job first.")
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.uploadPodDocument(
                session = session,
                driverId = profile.driverId,
                job = selectedJob,
                fileName = fileName,
                mimeType = mimeType,
                bytes = bytes,
            )
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "POD uploaded.",
                    )
                    refreshDriverData()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to upload POD."),
                    )
                }
        }
    }

    fun uploadComplianceDocument(docType: String, isVehicleDocument: Boolean, fileName: String, mimeType: String, bytes: ByteArray) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val profile = _uiState.value.profile ?: return@launch
            if (bytes.isEmpty()) {
                _uiState.value = _uiState.value.copy(error = "Selected document is empty.")
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.uploadComplianceDocument(
                session = session,
                profile = profile,
                docType = docType,
                isVehicleDocument = isVehicleDocument,
                fileName = fileName,
                mimeType = mimeType,
                bytes = bytes,
            )
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "$docType uploaded for review.",
                    )
                    refreshDriverData()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to upload document."),
                    )
                }
        }
    }

    fun setJobSearchPreference(jobId: String, state: String?) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val profile = _uiState.value.profile ?: return@launch
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.setJobSearchPreference(session, profile.driverId, jobId, state)
                .onSuccess {
                    val next = _uiState.value.jobSearchPreferences.toMutableMap()
                    if (state == null) next.remove(jobId) else next[jobId] = state
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        jobSearchPreferences = next,
                        message = when (state) {
                            "saved" -> "Job saved."
                            "deleted" -> "Job hidden."
                            else -> "Job restored."
                        },
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to update job preference."),
                    )
                }
        }
    }
}

private fun isValidTransition(currentRaw: String, next: String): Boolean {
    val current = normalizeDriverStatus(currentRaw)
    return when (next) {
        "on_my_way" -> current in listOf("allocated", "awarded")
        "on_site_pickup" -> current == "on_my_way"
        "loaded" -> current == "on_site_pickup"
        "in_transit" -> current == "loaded"
        "on_site_delivery" -> current == "in_transit"
        "delivered" -> current == "on_site_delivery"
        "completed" -> current == "delivered"
        else -> false
    }
}

private fun normalizeDriverStatus(raw: String): String =
    when (raw.lowercase().ifBlank { "assigned" }) {
        "assigned", "accepted" -> "allocated"
        "arrived_pickup" -> "on_site_pickup"
        "collected" -> "loaded"
        "on_route_delivery" -> "in_transit"
        "arrived_delivery" -> "on_site_delivery"
        else -> raw.lowercase().ifBlank { "assigned" }
    }

private fun Throwable.isSessionError(): Boolean {
    val text = message.orEmpty().lowercase()
    return "jwt" in text ||
        "token" in text ||
        "401" in text ||
        "unauthorized" in text ||
        "session" in text
}

private fun Throwable.friendlySessionMessage(): String? =
    if (isSessionError()) "Your session expired. Please sign in again." else null

private fun Throwable.friendlyDriverMessage(fallback: String): String {
    val text = message.orEmpty()
    val lower = text.lowercase()
    return when {
        isSessionError() -> "Your session expired. Please sign in again."
        "unable to resolve host" in lower || "no address associated with hostname" in lower ->
            "Connection problem. Check internet signal and refresh."
        "violates check constraint" in lower || "relation" in lower || "postgres" in lower || "sql" in lower ->
            "The action could not be completed. Please refresh and try again."
        "status update could not be applied" in lower ->
            "The status could not be updated. Please refresh and try again."
        text.isNotBlank() -> text
        else -> fallback
    }
}
