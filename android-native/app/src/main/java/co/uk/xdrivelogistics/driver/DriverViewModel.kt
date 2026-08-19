package co.uk.xdrivelogistics.driver

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.DriverBid
import co.uk.xdrivelogistics.driver.data.DriverDocument
import co.uk.xdrivelogistics.driver.data.DriverInvoice
import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverNotification
import co.uk.xdrivelogistics.driver.data.DriverPodUpload
import co.uk.xdrivelogistics.driver.data.DriverProfile
import co.uk.xdrivelogistics.driver.data.DriverReturnJourney
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.NearbyDriver
import co.uk.xdrivelogistics.driver.data.SecureDriverCommercialApi
import co.uk.xdrivelogistics.driver.data.SessionStore
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
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

enum class ActionEntryMode {
    DETAILS,
    QUOTE,
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
    val pendingPodJobId: String? = null,
    val pendingPodPhotoUris: List<String> = emptyList(),
    val pendingPodDocumentUris: List<String> = emptyList(),
    val selectedTab: DriverTab = DriverTab.NEARBY,
    val selectedJobId: String? = null,
    val actionEntryMode: ActionEntryMode = ActionEntryMode.DETAILS,
    val isSubmittingQuote: Boolean = false,
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
    private val commercialApi = SecureDriverCommercialApi(
        xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
    )

    // Commercial Marketplace reads/submission go through XDrive server APIs so
    // a native client never needs pre-award SELECT access to the jobs table.
    private val quoteCoordinator = QuoteSubmissionCoordinator { session, _, jobId, amount, note ->
        commercialApi.submitJobQuote(session, jobId, amount, note)
    }

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
        _uiState.value = _uiState.value.copy(
            selectedTab = tab,
            actionEntryMode = if (tab == DriverTab.ACTION) _uiState.value.actionEntryMode else ActionEntryMode.DETAILS,
        )
    }

    fun selectJob(jobId: String) {
        _uiState.value = _uiState.value.copy(selectedJobId = jobId)
    }

    fun openActionForJob(jobId: String, mode: ActionEntryMode) {
        _uiState.value = _uiState.value.copy(
            selectedJobId = jobId,
            selectedTab = DriverTab.ACTION,
            actionEntryMode = mode,
        )
    }

    fun refreshDriverData() {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            loadDriverDataWithSession(session, allowRefresh = true)
        }
    }

    private fun mergePendingPodEvidence(jobs: List<DriverJob>): List<DriverJob> {
        val current = _uiState.value
        val pendingJobId = current.pendingPodJobId ?: return jobs
        if (current.pendingPodPhotoUris.isEmpty() && current.pendingPodDocumentUris.isEmpty()) return jobs

        return jobs.map { job ->
            if (job.id != pendingJobId) {
                job
            } else if (job.needsCollectionProof()) {
                job.copy(
                    collectionPhotoUrl = current.pendingPodPhotoUris.lastOrNull() ?: job.collectionPhotoUrl,
                )
            } else {
                job.copy(
                    deliveryPhotos = (job.deliveryPhotos + current.pendingPodPhotoUris).distinct(),
                    podPhotos = (job.podPhotos + current.pendingPodDocumentUris).distinct(),
                )
            }
        }
    }

    private fun clearPendingPodEvidence(jobId: String) {
        if (_uiState.value.pendingPodJobId != jobId) return
        _uiState.value = _uiState.value.copy(
            pendingPodJobId = null,
            pendingPodPhotoUris = emptyList(),
            pendingPodDocumentUris = emptyList(),
        )
    }

    private fun recordPendingPodEvidence(job: DriverJob, upload: DriverPodUpload) {
        val current = _uiState.value
        val sameJob = current.pendingPodJobId == job.id
        val existingPhotos = if (sameJob) current.pendingPodPhotoUris else emptyList()
        val existingDocuments = if (sameJob) current.pendingPodDocumentUris else emptyList()
        val nextPhotos = if (upload.kind == "photo") (existingPhotos + upload.objectPath).distinct() else existingPhotos
        val nextDocuments = if (upload.kind == "document") (existingDocuments + upload.objectPath).distinct() else existingDocuments

        _uiState.value = current.copy(
            pendingPodJobId = job.id,
            pendingPodPhotoUris = nextPhotos,
            pendingPodDocumentUris = nextDocuments,
        )
        _uiState.value = _uiState.value.copy(jobs = mergePendingPodEvidence(_uiState.value.jobs))
    }

    private suspend fun loadDriverDataWithSession(session: DriverSession, allowRefresh: Boolean) {
        api.resolveDriverProfile(session)
            .onSuccess { profile ->
                val documents = api.loadDriverDocuments(session, profile).getOrDefault(emptyList())
                val preferences = api.loadJobSearchPreferences(session, profile.driverId).getOrDefault(emptyMap())
                val bids = commercialApi.loadDriverBids(session).getOrDefault(emptyList())
                val notifications = api.loadDriverNotifications(session).getOrDefault(emptyList())
                val returnJourney = api.loadReturnJourney(session, profile.driverId).getOrNull()
                val invoices = api.loadDriverInvoices(session, profile.companyId).getOrDefault(emptyList())
                val nearbyDrivers = api.loadNearbyDrivers(session, profile.companyId).getOrDefault(emptyList())
                commercialApi.loadDriverJobs(session)
                    .onSuccess { jobs ->
                        val mergedJobs = mergePendingPodEvidence(jobs)
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            session = session,
                            profile = profile,
                            jobs = mergedJobs,
                            documents = documents,
                            bids = bids,
                            notifications = notifications,
                            returnJourney = returnJourney,
                            invoices = invoices,
                            nearbyDrivers = nearbyDrivers,
                            jobSearchPreferences = preferences,
                            selectedJobId = resolveSelectedJobId(_uiState.value.selectedJobId, mergedJobs),
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

            val rejection = preflightStatusUpdateRejection(selectedJob, nextStatus)
            if (rejection != null) {
                _uiState.value = _uiState.value.copy(error = rejection)
                return@launch
            }

            val collectionPhoto = if (nextStatus == "loaded") selectedJob.collectionPhotoUrl else null
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")

            commercialApi.moveDriverJob(
                session = session,
                jobId = jobId,
                nextStatus = nextStatus,
                collectionPhotoUrl = collectionPhoto,
            )
                .onSuccess {
                    if (nextStatus == "loaded") clearPendingPodEvidence(jobId)
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
        val quoteJobId = _uiState.value.selectedJobId
        if (_uiState.value.isSubmittingQuote) return
        _uiState.value = _uiState.value.copy(isLoading = true, isSubmittingQuote = true, error = "", message = "")
        viewModelScope.launch {
            val outcome = quoteCoordinator.submit(
                quoteJobId = quoteJobId,
                jobs = _uiState.value.jobs,
                amountText = amountText,
                note = note,
                session = _uiState.value.session,
                profile = _uiState.value.profile,
            )
            when (outcome) {
                is QuoteSubmitOutcome.AlreadyInFlight,
                is QuoteSubmitOutcome.NoSession,
                is QuoteSubmitOutcome.NoProfile -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, isSubmittingQuote = false)
                }
                is QuoteSubmitOutcome.ValidationFailure -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSubmittingQuote = false,
                        error = outcome.result.toUserMessage(),
                    )
                }
                is QuoteSubmitOutcome.Success -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSubmittingQuote = false,
                        message = "Quote submitted.",
                    )
                    refreshDriverData()
                }
                is QuoteSubmitOutcome.ApiFailure -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isSubmittingQuote = false,
                        error = outcome.error.friendlyDriverMessage("Failed to submit quote."),
                    )
                }
            }
        }
    }

    fun uploadPodForSelectedJob(fileName: String, mimeType: String, bytes: ByteArray) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val selectedJob = _uiState.value.jobs.firstOrNull { it.id == _uiState.value.selectedJobId }
            if (selectedJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a job first.")
                return@launch
            }
            if (selectedJob.needsCollectionProof() && mimeType.substringBefore(';').lowercase() !in setOf("image/jpeg", "image/png", "image/webp")) {
                _uiState.value = _uiState.value.copy(error = "Collection proof must be a photo.")
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            commercialApi.uploadPodEvidence(
                session = session,
                jobId = selectedJob.id,
                fileName = fileName,
                mimeType = mimeType,
                bytes = bytes,
            )
                .onSuccess { upload ->
                    recordPendingPodEvidence(selectedJob, upload)
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = if (selectedJob.needsCollectionProof()) {
                            "Collection proof uploaded."
                        } else {
                            "Delivery proof uploaded."
                        },
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to upload POD."),
                    )
                }
        }
    }

    fun confirmDeliveryRecipientForSelectedJob(recipientName: String, signatureData: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val selectedJob = _uiState.value.jobs.firstOrNull { it.id == _uiState.value.selectedJobId }
            if (selectedJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a job first.")
                return@launch
            }
            if (!selectedJob.hasPod()) {
                _uiState.value = _uiState.value.copy(error = "Upload POD evidence before confirming the recipient.")
                return@launch
            }
            val cleanName = recipientName.trim()
            if (cleanName.isBlank()) {
                _uiState.value = _uiState.value.copy(error = "Enter the recipient name.")
                return@launch
            }
            val cleanSignature = signatureData.trim()
            if (!cleanSignature.startsWith("data:image/png;base64,") && !cleanSignature.startsWith("data:image/jpeg;base64,")) {
                _uiState.value = _uiState.value.copy(error = "Capture the recipient signature before confirming POD.")
                return@launch
            }

            val current = _uiState.value
            val photoUris = if (current.pendingPodJobId == selectedJob.id) current.pendingPodPhotoUris else emptyList()
            val documentUris = if (current.pendingPodJobId == selectedJob.id) current.pendingPodDocumentUris else emptyList()

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            commercialApi.savePod(
                session = session,
                jobId = selectedJob.id,
                recipientName = cleanName,
                signatureData = cleanSignature,
                photoUris = photoUris,
                documentUris = documentUris,
            )
                .onSuccess {
                    clearPendingPodEvidence(selectedJob.id)
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Recipient signature and POD evidence confirmed.",
                    )
                    refreshDriverData()
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to confirm delivery evidence."),
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
