package co.uk.xdrivelogistics.driver

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.DeviceInstallationIdentity
import co.uk.xdrivelogistics.driver.data.DriverAlertPreferences
import co.uk.xdrivelogistics.driver.data.DriverBid
import co.uk.xdrivelogistics.driver.data.DriverDocument
import co.uk.xdrivelogistics.driver.data.DriverInvoice
import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverNotification
import co.uk.xdrivelogistics.driver.data.DriverProfile
import co.uk.xdrivelogistics.driver.data.DriverReturnJourney
import co.uk.xdrivelogistics.driver.data.DriverSearchDefaults
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.NearbyDriver
import co.uk.xdrivelogistics.driver.data.SecureDriverCommercialApi
import co.uk.xdrivelogistics.driver.data.SecureDriverMutationApi
import co.uk.xdrivelogistics.driver.data.SecureDriverResourcesApi
import co.uk.xdrivelogistics.driver.data.SessionStore
import co.uk.xdrivelogistics.driver.data.isDeviceSessionRevoked
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

enum class DriverTab { NEARBY, QUOTES, BOOKINGS, JOBS, SMARTPAY, ACTION, MESSAGES, PROFILE }
enum class ActionEntryMode { DETAILS, QUOTE }

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
    val returnJourneys: List<DriverReturnJourney> = emptyList(),
    val invoices: List<DriverInvoice> = emptyList(),
    val nearbyDrivers: List<NearbyDriver> = emptyList(),
    val jobSearchPreferences: Map<String, String> = emptyMap(),
    val alertPreferences: DriverAlertPreferences = DriverAlertPreferences(),
    val searchDefaults: DriverSearchDefaults = DriverSearchDefaults(),
    val selectedTab: DriverTab = DriverTab.NEARBY,
    val selectedJobId: String? = null,
    val actionEntryMode: ActionEntryMode = ActionEntryMode.DETAILS,
    val isSubmittingQuote: Boolean = false,
    val message: String = "",
    val error: String = "",
)

class DriverViewModel(application: Application) : AndroidViewModel(application) {
    private val appContext = application.applicationContext
    private val installationIdentity = DeviceInstallationIdentity(appContext)
    private val sessionStore = SessionStore(appContext)
    private val pendingJobDeepLinkStore = PendingJobDeepLinkStore(appContext)
    private val pendingAppDestinationStore = PendingAppDestinationStore(appContext)
    private val pendingStatusStore = PendingJobStatusStore(appContext)
    private val pendingPodStore = PendingPodStore(appContext)
    private val pendingQuoteStore = PendingQuoteStore(appContext)
    private val api = ApiClient(BuildConfig.XDRIVE_BASE_URL, BuildConfig.SUPABASE_URL, BuildConfig.SUPABASE_ANON_KEY)
    private val commercialApi = SecureDriverCommercialApi(BuildConfig.XDRIVE_BASE_URL, installationIdentity.installationId)
    private val mutationApi = SecureDriverMutationApi(BuildConfig.XDRIVE_BASE_URL, installationIdentity.installationId)
    private val resourcesApi = SecureDriverResourcesApi(BuildConfig.XDRIVE_BASE_URL, installationIdentity.installationId)
    private val quoteCoordinator = QuoteSubmissionCoordinator { session, _, jobId, amount, note, collectWithinMinutes, additionalExtrasGbp, vehicleId ->
        commercialApi.submitJobQuote(
            session = session,
            jobId = jobId,
            amount = amount,
            message = note,
            collectWithinMinutes = collectWithinMinutes,
            additionalExtrasGbp = additionalExtrasGbp,
            vehicleId = vehicleId,
        )
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
                _uiState.value = _uiState.value.copy(isAuthenticated = true, session = persisted, error = "")
                if (pendingStatusStore.hasPendingForUser(persisted.userId)) JobStatusSyncScheduler.schedule(appContext)
                if (pendingPodStore.hasPendingForUser(persisted.userId)) PodSyncScheduler.schedule(appContext)
                if (pendingQuoteStore.hasPendingForUser(persisted.userId)) QuoteSyncScheduler.schedule(appContext)
                refreshDriverData()
                startLiveRefresh(persisted)
            }
        }
        viewModelScope.launch {
            pendingJobDeepLinkStore.pendingJobIds.collectLatest { jobId ->
                if (jobId.isNullOrBlank()) return@collectLatest
                if (!applyPendingJobDeepLinkIfReady() && _uiState.value.session != null) refreshDriverData()
            }
        }
    }

    private fun applyPendingJobDeepLinkIfReady(): Boolean {
        val jobId = pendingJobDeepLinkStore.read() ?: return false
        if (_uiState.value.jobs.none { it.id == jobId }) return false
        _uiState.value = _uiState.value.copy(selectedJobId = jobId, selectedTab = DriverTab.ACTION, actionEntryMode = ActionEntryMode.DETAILS, error = "")
        pendingJobDeepLinkStore.clear()
        return true
    }

    private fun applyPendingAppDestinationIfReady(): Boolean {
        val destination = pendingAppDestinationStore.read() ?: return false
        val tab = when (destination) {
            PendingAppDestination.MESSAGES -> DriverTab.MESSAGES
            PendingAppDestination.PROFILE,
            PendingAppDestination.DOCUMENTS -> DriverTab.PROFILE
        }
        _uiState.value = _uiState.value.copy(selectedTab = tab, error = "")
        pendingAppDestinationStore.clear()
        return true
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            val result = api.login(email.trim(), password)
            if (result.isFailure) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = result.exceptionOrNull()?.friendlyDriverMessage("Login failed.") ?: "Login failed.")
                return@launch
            }
            runCatching { sessionStore.saveSession(result.getOrThrow()) }
                .onSuccess { _uiState.value = _uiState.value.copy(isLoading = false, message = "Login successful.", error = "") }
                .onFailure { error -> _uiState.value = _uiState.value.copy(isLoading = false, error = error.friendlyDriverMessage("This device could not be registered for driver access.")) }
        }
    }

    fun logout() {
        viewModelScope.launch {
            liveRefreshJob?.cancel()
            pendingJobDeepLinkStore.clear()
            pendingAppDestinationStore.clear()
            sessionStore.clear()
        }
    }

    private fun startLiveRefresh(session: DriverSession) {
        liveRefreshJob?.cancel()
        liveRefreshJob = viewModelScope.launch {
            while (isActive) {
                delay(30_000L)
                val current = _uiState.value.session
                if (current?.accessToken == session.accessToken && !_uiState.value.isLoading) loadDriverDataWithSession(current, allowRefresh = true)
            }
        }
    }

    fun changeTab(tab: DriverTab) {
        _uiState.value = _uiState.value.copy(selectedTab = tab, actionEntryMode = if (tab == DriverTab.ACTION) _uiState.value.actionEntryMode else ActionEntryMode.DETAILS)
    }

    fun selectJob(jobId: String) {
        _uiState.value = _uiState.value.copy(selectedJobId = jobId)
    }

    fun openActionForJob(jobId: String, mode: ActionEntryMode) {
        _uiState.value = _uiState.value.copy(selectedJobId = jobId, selectedTab = DriverTab.ACTION, actionEntryMode = mode)
    }

    fun refreshDriverData() {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            loadDriverDataWithSession(session, allowRefresh = true)
        }
    }

    private suspend fun loadDriverDataWithSession(session: DriverSession, allowRefresh: Boolean) {
        val resourcesResult = resourcesApi.load(session)
        if (resourcesResult.isFailure) {
            handleLoadFailure(session, resourcesResult.exceptionOrNull(), allowRefresh, "Failed to load driver resources.")
            return
        }
        val resources = resourcesResult.getOrThrow()

        val bidsResult = commercialApi.loadDriverBids(session)
        if (bidsResult.isFailure) {
            handleLoadFailure(session, bidsResult.exceptionOrNull(), allowRefresh, "Failed to load quotes.")
            return
        }
        val jobsResult = commercialApi.loadDriverJobs(session)
        if (jobsResult.isFailure) {
            handleLoadFailure(session, jobsResult.exceptionOrNull(), allowRefresh, "Failed to load jobs.")
            return
        }

        val jobs = jobsResult.getOrThrow()
        val visibleJobs = pendingStatusStore.optimisticJobs(session.userId, jobs)
        val visibleBids = pendingQuoteStore.optimisticBids(session.userId, visibleJobs, bidsResult.getOrThrow())
        _uiState.value = _uiState.value.copy(
            isLoading = false,
            session = session,
            profile = resources.profile,
            jobs = visibleJobs,
            documents = resources.documents,
            bids = visibleBids,
            notifications = resources.notifications,
            returnJourney = resources.returnJourney,
            returnJourneys = resources.returnJourneys,
            invoices = resources.invoices,
            nearbyDrivers = resources.nearbyDrivers,
            jobSearchPreferences = resources.jobSearchPreferences,
            alertPreferences = resources.alertPreferences,
            searchDefaults = resources.searchDefaults,
            selectedJobId = resolveSelectedJobId(_uiState.value.selectedJobId, visibleJobs),
        )
        pendingPodStore.consumeFailureForUser(session.userId)?.let { _uiState.value = _uiState.value.copy(error = it) }
        pendingQuoteStore.consumeFailureForUser(session.userId)?.let { _uiState.value = _uiState.value.copy(error = it) }
        val openedJob = applyPendingJobDeepLinkIfReady()
        if (!openedJob) applyPendingAppDestinationIfReady()
    }

    private suspend fun handleLoadFailure(session: DriverSession, error: Throwable?, allowRefresh: Boolean, fallback: String) {
        if (error.isDeviceSessionRevoked()) {
            sessionStore.clear()
            _uiState.value = DriverUiState(error = "This device session was replaced by another login. Please sign in again.")
            return
        }
        if (allowRefresh && error?.isSessionError() == true) {
            refreshAndRetry(session)
        } else {
            _uiState.value = _uiState.value.copy(isLoading = false, error = error?.friendlyDriverMessage(fallback) ?: fallback)
        }
    }

    private suspend fun refreshAndRetry(session: DriverSession) {
        api.refreshSession(session)
            .onSuccess { refreshed ->
                runCatching { sessionStore.saveSession(refreshed) }
                    .onSuccess {
                        _uiState.value = _uiState.value.copy(session = refreshed)
                        loadDriverDataWithSession(refreshed, allowRefresh = false)
                    }
                    .onFailure { error ->
                        sessionStore.clear()
                        _uiState.value = DriverUiState(error = error.friendlyDriverMessage("This device session could not be renewed. Please sign in again."))
                    }
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
            mutationApi.sendQuickNote(session, jobId, note.trim(), important)
                .onSuccess { _uiState.value = _uiState.value.copy(isLoading = false, message = "Dispatch note sent.") }
                .onFailure { error ->
                    if (error.isDeviceSessionRevoked()) {
                        sessionStore.clear()
                        _uiState.value = DriverUiState(error = "This device session was replaced by another login.")
                    } else {
                        _uiState.value = _uiState.value.copy(isLoading = false, error = error.friendlyDriverMessage("Failed to send note."))
                    }
                }
        }
    }

    fun markAlertRead(notificationId: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            resourcesApi.markNotificationRead(session, notificationId)
                .onSuccess { refreshDriverData() }
                .onFailure { _uiState.value = _uiState.value.copy(error = it.friendlyDriverMessage("Failed to mark alert read.")) }
        }
    }

    fun deleteAlert(notificationId: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            resourcesApi.deleteNotification(session, notificationId)
                .onSuccess { refreshDriverData() }
                .onFailure { _uiState.value = _uiState.value.copy(error = it.friendlyDriverMessage("Failed to delete alert.")) }
        }
    }

    fun saveAlertPreferences(preferences: DriverAlertPreferences) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            resourcesApi.saveAlertPreferences(session, preferences)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(isLoading = false, alertPreferences = preferences, message = "Alert preferences saved.")
                }
                .onFailure { _uiState.value = _uiState.value.copy(isLoading = false, error = it.friendlyDriverMessage("Failed to save alert preferences.")) }
        }
    }

    fun saveSearchDefaults(values: Map<String, String>) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            resourcesApi.saveSearchDefaults(session, values)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(isLoading = false, searchDefaults = DriverSearchDefaults(values), message = "Search defaults saved.")
                }
                .onFailure { _uiState.value = _uiState.value.copy(isLoading = false, error = it.friendlyDriverMessage("Failed to save search defaults.")) }
        }
    }

    fun saveReturnJourney(fromLocation: String, toLocation: String, availableDate: String) {
        saveReturnJourney(
            mode = "going_home",
            goAnywhere = false,
            fromLocation = fromLocation,
            toLocation = toLocation,
            viaLocation = "",
            availableDate = availableDate,
            journeyEta = "",
            capacityStatus = "",
            weightAvailableKg = null,
            palletSpaceAvailable = null,
        )
    }

    fun saveReturnJourney(
        mode: String,
        goAnywhere: Boolean,
        fromLocation: String,
        toLocation: String,
        viaLocation: String,
        availableDate: String,
        journeyEta: String,
        capacityStatus: String,
        weightAvailableKg: Double?,
        palletSpaceAvailable: Int?,
    ) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            if (!goAnywhere && fromLocation.isBlank() && toLocation.isBlank()) {
                _uiState.value = _uiState.value.copy(error = "Enter a journey location or enable Go Anywhere.")
                return@launch
            }
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            resourcesApi.saveReturnJourney(
                session = session,
                mode = mode.trim().lowercase(),
                goAnywhere = goAnywhere,
                fromLocation = fromLocation.trim(),
                toLocation = toLocation.trim(),
                viaLocation = viaLocation.trim(),
                availableDate = availableDate.trim(),
                journeyEta = journeyEta.trim(),
                capacityStatus = capacityStatus.trim(),
                weightAvailableKg = weightAvailableKg,
                palletSpaceAvailable = palletSpaceAvailable,
            ).onSuccess {
                _uiState.value = _uiState.value.copy(isLoading = false, message = "Journey saved.")
                refreshDriverData()
            }.onFailure {
                _uiState.value = _uiState.value.copy(isLoading = false, error = it.friendlyDriverMessage("Failed to save journey."))
            }
        }
    }

    fun sendLocation(lat: Double, lng: Double) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.sendLocation(session.accessToken, lat, lng)
                .onSuccess { _uiState.value = _uiState.value.copy(isLoading = false, message = "Location published.") }
                .onFailure { _uiState.value = _uiState.value.copy(isLoading = false, error = it.friendlyDriverMessage("Failed to publish location.")) }
        }
    }

    fun updatePassword(newPassword: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.updatePassword(session.accessToken, newPassword)
                .onSuccess { _uiState.value = _uiState.value.copy(isLoading = false, message = "Password updated.") }
                .onFailure { _uiState.value = _uiState.value.copy(isLoading = false, error = it.friendlyDriverMessage("Failed to update password.")) }
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
            preflightStatusUpdateRejection(selectedJob, nextStatus)?.let {
                _uiState.value = _uiState.value.copy(error = it)
                return@launch
            }
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            mutationApi.updateJobStatus(session, jobId, nextStatus)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(isLoading = false, message = "Status moved to $nextStatus.")
                    refreshDriverData()
                }
                .onFailure { error ->
                    if (error.isDeviceSessionRevoked()) {
                        sessionStore.clear()
                        return@onFailure
                    }
                    if (error.isRetryableStatusSyncFailure() || error.isStatusSessionFailure()) {
                        pendingStatusStore.enqueue(session.userId, profile.driverId, jobId, nextStatus)
                        JobStatusSyncScheduler.schedule(appContext)
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            jobs = pendingStatusStore.optimisticJobs(session.userId, _uiState.value.jobs),
                            message = "Status saved offline and will sync automatically.",
                            error = "",
                        )
                    } else {
                        _uiState.value = _uiState.value.copy(isLoading = false, error = error.friendlyDriverMessage("Failed to update job status."))
                    }
                }
        }
    }

    fun submitQuoteForSelectedJob(amountText: String, note: String) {
        submitQuoteForSelectedJob(RichQuoteInput(amountText = amountText, note = note))
    }

    fun submitQuoteForSelectedJob(
        amountText: String,
        note: String,
        collectWithinMinutes: Int?,
        additionalExtrasText: String,
        vehicleId: String?,
        vehicleLabel: String?,
    ) {
        submitQuoteForSelectedJob(
            RichQuoteInput(
                amountText = amountText,
                note = note,
                collectWithinMinutes = collectWithinMinutes,
                additionalExtrasText = additionalExtrasText,
                vehicleId = vehicleId,
                vehicleLabel = vehicleLabel,
            )
        )
    }

    private fun submitQuoteForSelectedJob(input: RichQuoteInput) {
        val quoteJobId = _uiState.value.selectedJobId
        val session = _uiState.value.session
        val profile = _uiState.value.profile
        if (_uiState.value.isSubmittingQuote) return
        if (!quoteJobId.isNullOrBlank() && _uiState.value.bids.any { it.jobId == quoteJobId }) {
            _uiState.value = _uiState.value.copy(error = "You have already quoted for this job. A driver can quote only once per job.", message = "")
            return
        }
        _uiState.value = _uiState.value.copy(isLoading = true, isSubmittingQuote = true, error = "", message = "")
        viewModelScope.launch {
            when (val outcome = quoteCoordinator.submit(quoteJobId, _uiState.value.jobs, input, session, profile)) {
                is QuoteSubmitOutcome.AlreadyInFlight,
                is QuoteSubmitOutcome.NoSession,
                is QuoteSubmitOutcome.NoProfile -> _uiState.value = _uiState.value.copy(isLoading = false, isSubmittingQuote = false)

                is QuoteSubmitOutcome.ValidationFailure -> _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isSubmittingQuote = false,
                    error = outcome.detail ?: outcome.result.toUserMessage(),
                )

                is QuoteSubmitOutcome.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false, isSubmittingQuote = false, message = "Quote submitted.")
                    refreshDriverData()
                }

                is QuoteSubmitOutcome.ApiFailure -> {
                    if (outcome.error.isDeviceSessionRevoked()) {
                        sessionStore.clear()
                        _uiState.value = DriverUiState(error = "This device session was replaced by another login.")
                        return@launch
                    }
                    if ((outcome.error.isRetryableQuoteFailure() || outcome.error.isQuoteSessionFailure()) && session != null && profile != null && !quoteJobId.isNullOrBlank()) {
                        runCatching {
                            pendingQuoteStore.enqueue(
                                userId = session.userId,
                                driverId = profile.driverId,
                                jobId = quoteJobId,
                                amount = outcome.amount,
                                note = outcome.note,
                                collectWithinMinutes = outcome.collectWithinMinutes,
                                additionalExtrasGbp = outcome.additionalExtrasGbp,
                                vehicleId = outcome.vehicleId,
                                vehicleLabel = outcome.vehicleLabel,
                            )
                            QuoteSyncScheduler.schedule(appContext)
                        }.onSuccess {
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                isSubmittingQuote = false,
                                bids = pendingQuoteStore.optimisticBids(session.userId, _uiState.value.jobs, _uiState.value.bids),
                                message = "Quote saved securely on this device. Pending sync — it has not reached the load poster yet.",
                                error = "",
                            )
                        }.onFailure { saveError ->
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                isSubmittingQuote = false,
                                error = saveError.message ?: "Failed to save quote securely on this device.",
                            )
                        }
                    } else {
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            isSubmittingQuote = false,
                            error = outcome.error.friendlyDriverMessage("Failed to submit quote."),
                        )
                    }
                }
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
            if (bytes.isEmpty()) {
                _uiState.value = _uiState.value.copy(error = "Selected POD file is empty.")
                return@launch
            }
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            runCatching {
                pendingPodStore.enqueue(session.userId, profile.driverId, selectedJob.id, selectedJob.needsCollectionProof(), fileName, mimeType, bytes)
                PodSyncScheduler.schedule(appContext)
            }.onSuccess {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    message = if (selectedJob.needsCollectionProof()) "Collection proof saved securely and will sync automatically." else "POD saved securely and will sync automatically.",
                )
            }.onFailure { error ->
                _uiState.value = _uiState.value.copy(isLoading = false, error = error.message ?: "Failed to save POD securely on this device.")
            }
        }
    }

    fun confirmDeliveryRecipientForSelectedJob(recipientName: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val selectedJob = _uiState.value.jobs.firstOrNull { it.id == _uiState.value.selectedJobId }
            if (selectedJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a job first.")
                return@launch
            }
            if (!selectedJob.hasPod()) {
                _uiState.value = _uiState.value.copy(error = "Upload the signed POD evidence before confirming the recipient.")
                return@launch
            }
            val cleanName = recipientName.trim()
            if (cleanName.isBlank()) {
                _uiState.value = _uiState.value.copy(error = "Enter the recipient name.")
                return@launch
            }
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            mutationApi.confirmDeliveryRecipient(session, selectedJob.id, cleanName)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(isLoading = false, message = "Recipient and signed POD evidence confirmed.")
                    refreshDriverData()
                }
                .onFailure { _uiState.value = _uiState.value.copy(isLoading = false, error = it.friendlyDriverMessage("Failed to confirm delivery evidence.")) }
        }
    }

    fun uploadComplianceDocument(docType: String, isVehicleDocument: Boolean, fileName: String, mimeType: String, bytes: ByteArray) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            if (bytes.isEmpty()) {
                _uiState.value = _uiState.value.copy(error = "Selected document is empty.")
                return@launch
            }
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            resourcesApi.uploadComplianceDocument(session, docType, isVehicleDocument, fileName, mimeType, bytes)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(isLoading = false, message = "$docType uploaded for review.")
                    refreshDriverData()
                }
                .onFailure { _uiState.value = _uiState.value.copy(isLoading = false, error = it.friendlyDriverMessage("Failed to upload document.")) }
        }
    }

    fun setJobSearchPreference(jobId: String, state: String?) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            resourcesApi.setJobSearchPreference(session, jobId, state)
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
                .onFailure { _uiState.value = _uiState.value.copy(isLoading = false, error = it.friendlyDriverMessage("Failed to update job preference.")) }
        }
    }
}

private fun Throwable.isSessionError(): Boolean {
    val text = message.orEmpty().lowercase()
    return "jwt" in text || "token" in text || "401" in text || "unauthorized" in text || "session" in text
}

private fun Throwable.friendlySessionMessage(): String? = if (isSessionError()) "Your session expired. Please sign in again." else null

private fun Throwable.friendlyDriverMessage(fallback: String): String {
    val text = message.orEmpty()
    val lower = text.lowercase()
    return when {
        isDeviceSessionRevoked() -> "This device session was replaced by another login. Please sign in again."
        isSessionError() -> "Your session expired. Please sign in again."
        "unable to resolve host" in lower || "no address associated with hostname" in lower -> "Connection problem. Check internet signal and refresh."
        "violates check constraint" in lower || "relation" in lower || "postgres" in lower || "sql" in lower -> "The action could not be completed. Please refresh and try again."
        "status update could not be applied" in lower -> "The status could not be updated. Please refresh and try again."
        text.isNotBlank() -> text
        else -> fallback
    }
}
