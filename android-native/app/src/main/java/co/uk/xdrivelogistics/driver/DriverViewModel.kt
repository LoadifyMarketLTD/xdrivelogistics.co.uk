package co.uk.xdrivelogistics.driver

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.DriverAvailability
import co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus
import co.uk.xdrivelogistics.driver.data.DriverBid
import co.uk.xdrivelogistics.driver.data.DriverDocument
import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DriverNotification
import co.uk.xdrivelogistics.driver.data.DriverProfile
import co.uk.xdrivelogistics.driver.data.DriverReturnJourney
import co.uk.xdrivelogistics.driver.data.DriverInvoice
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.MarketplaceJob
import co.uk.xdrivelogistics.driver.data.MobileApiException
import co.uk.xdrivelogistics.driver.data.MobileApiHttpException
import co.uk.xdrivelogistics.driver.data.NearbyDriver
import co.uk.xdrivelogistics.driver.data.SessionStore
import co.uk.xdrivelogistics.driver.jobs.DriverLifecycleTransitions
import co.uk.xdrivelogistics.driver.offline.MobileLifecycleCommand
import co.uk.xdrivelogistics.driver.offline.MobileMutationKind
import co.uk.xdrivelogistics.driver.offline.MobileOfflineQueue
import co.uk.xdrivelogistics.driver.offline.MobileOfflineQueueStore
import co.uk.xdrivelogistics.driver.offline.MobileQueueItem
import co.uk.xdrivelogistics.driver.offline.MobileQueueState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.util.Locale

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
    val marketplaceJobs: List<MarketplaceJob> = emptyList(),
    val documents: List<DriverDocument> = emptyList(),
    val bids: List<DriverBid> = emptyList(),
    val notifications: List<DriverNotification> = emptyList(),
    val returnJourney: DriverReturnJourney? = null,
    val invoices: List<DriverInvoice> = emptyList(),
    val nearbyDrivers: List<NearbyDriver> = emptyList(),
    val jobSearchPreferences: Map<String, String> = emptyMap(),
    val selectedTab: DriverTab = DriverTab.NEARBY,
    val selectedJobId: String? = null,
    val jobSyncStates: Map<String, DriverJobSyncState> = emptyMap(),
    val availability: DriverAvailability? = null,
    val message: String = "",
    val error: String = "",
)

data class DriverJobSyncState(
    val state: MobileQueueState,
    val targetStatus: String,
    val lastError: String = "",
)

class DriverViewModel(application: Application) : AndroidViewModel(application) {
    private val sessionStore = SessionStore(application.applicationContext)
    private val activeJobSelectionStore = ActiveJobSelectionStore(application.applicationContext)
    private val queueStore = MobileOfflineQueueStore(application.applicationContext)
    private val mutationQueue = MobileOfflineQueue()
    private val api = ApiClient(
        xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
        supabaseUrl = BuildConfig.SUPABASE_URL,
        supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
    )

    private val _uiState = MutableStateFlow(DriverUiState())
    val uiState: StateFlow<DriverUiState> = _uiState.asStateFlow()
    private var liveRefreshJob: kotlinx.coroutines.Job? = null

    init {
        mutationQueue.restore(queueStore.readAll())
        queueStore.saveQuarantinedItems(mutationQueue.quarantinedSnapshot())
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
        _uiState.value.session?.let { session ->
            activeJobSelectionStore.saveSelectedJobId(session.userId, jobId)
        }
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
                flushQueuedMutations(session, profile)
                val documents = api.loadDriverDocuments(session, profile).getOrDefault(emptyList())
                val preferences = api.loadJobSearchPreferences(session, profile.driverId).getOrDefault(emptyMap())
                val bids = api.loadDriverBids(session, profile).getOrDefault(emptyList())
                val notifications = api.loadDriverNotifications(session).getOrDefault(emptyList())
                val returnJourney = api.loadReturnJourney(session, profile.driverId).getOrNull()
                val invoices = api.loadDriverInvoices(session, profile.companyId).getOrDefault(emptyList())
                val nearbyDrivers = api.loadNearbyDrivers(session, profile.companyId).getOrDefault(emptyList())
                val marketplaceJobs = api.loadNearbyMarketplaceJobs(session).getOrDefault(emptyList())
                val availability = api.loadAvailability(session).getOrNull()
                api.loadAssignedJobs(session, profile)
                    .onSuccess { jobs ->
                        val rememberedSelection = activeJobSelectionStore.readSelectedJobId(session.userId)
                        val selectedJobId = resolveSelectedJobId(
                            currentSelectedJobId = _uiState.value.selectedJobId,
                            rememberedSelectedJobId = rememberedSelection,
                            jobs = jobs,
                        )
                        if (selectedJobId == null) activeJobSelectionStore.clearSelectedJobId(session.userId)
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            session = session,
                            profile = profile,
                            jobs = jobs,
                            marketplaceJobs = marketplaceJobs,
                            documents = documents,
                            bids = bids,
                            notifications = notifications,
                            returnJourney = returnJourney,
                            invoices = invoices,
                            nearbyDrivers = nearbyDrivers,
                            jobSearchPreferences = preferences,
                            selectedJobId = selectedJobId,
                            jobSyncStates = jobSyncStatesForOwner(session.userId),
                            availability = availability ?: _uiState.value.availability,
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
            val profile = _uiState.value.profile ?: run {
                _uiState.value = _uiState.value.copy(error = "Driver profile is unavailable. Refresh and try again.")
                return@launch
            }
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

            if (selectedJob.isPosted()) {
                _uiState.value = _uiState.value.copy(
                    error = "Submit a quote and wait for the customer to award the job before starting work.",
                )
                return@launch
            }

            selectedJob.blockingRequirementFor(nextStatus)?.let { requirement ->
                _uiState.value = _uiState.value.copy(error = requirement)
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

            api.updateJobStatus(session, jobId, nextStatus)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Status moved to $nextStatus.",
                    )
                    refreshDriverData()
                }
                .onFailure { error ->
                    if (error is MobileApiException && error.retryable) {
                        val endpoint = DriverLifecycleTransitions.mobileActionFor(nextStatus)
                        val command = endpoint?.let { MobileLifecycleCommand.fromEndpointAndStatus(it, nextStatus) }
                        if (command != null) {
                            mutationQueue.enqueue(
                                ownerUserId = session.userId,
                                driverId = profile.driverId,
                                jobId = jobId,
                                command = command,
                                mutationKey = "lifecycle:${session.userId}:${profile.driverId}:$jobId:${command.action.name}",
                            )
                            persistQueueAndSyncState(session.userId)
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                message = "No stable connection. Action queued securely and will retry automatically.",
                            )
                            return@onFailure
                        }
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to update job status."),
                    )
                }
        }
    }

    private suspend fun flushQueuedMutations(session: DriverSession, profile: DriverProfile) {
        var keepFlushing = true
        while (keepFlushing) {
            val item = mutationQueue.nextProcessable(ownerUserId = session.userId, leaseDurationMs = 45_000L)
                ?: break
            if (item.driverId != profile.driverId || item.ownerUserId != session.userId) {
                mutationQueue.markFailure(
                    itemId = item.id,
                    retryable = false,
                    message = "Queued item ownership mismatch.",
                )
                persistQueueAndSyncState(session.userId)
                continue
            }
            when (item.command.inferredKind()) {
                MobileMutationKind.LIFECYCLE -> {
                    val nextStatus = item.command.targetStatus.orEmpty()
                    api.updateJobStatus(session, item.jobId, nextStatus)
                        .onSuccess {
                            mutationQueue.markSynced(item.id)
                            mutationQueue.pruneSynced(maxAgeMs = 7L * 24L * 60L * 60L * 1000L)
                        }
                        .onFailure { error ->
                            val retryable = (error as? MobileApiException)?.retryable == true
                            mutationQueue.markFailure(
                                itemId = item.id,
                                retryable = retryable,
                                message = error.message.orEmpty(),
                            )
                            if (retryable) keepFlushing = false
                        }
                }
                MobileMutationKind.BID -> {
                    val bid = item.command.bid
                    if (bid == null) {
                        mutationQueue.markFailure(item.id, retryable = false, message = "Queued bid payload is missing.")
                    } else {
                        api.submitJobQuote(
                            session = session,
                            jobId = item.jobId,
                            amount = bid.amount,
                            message = bid.message,
                            bidKey = bid.bidKey,
                        ).onSuccess {
                            mutationQueue.markSynced(item.id)
                            mutationQueue.pruneSynced(maxAgeMs = 7L * 24L * 60L * 60L * 1000L)
                        }.onFailure { error ->
                            val retryable = (error as? MobileApiException)?.retryable == true
                            mutationQueue.markFailure(
                                itemId = item.id,
                                retryable = retryable,
                                message = error.message.orEmpty(),
                            )
                            if (retryable) keepFlushing = false
                        }
                    }
                }
                MobileMutationKind.POD,
                null,
                -> mutationQueue.markFailure(
                    itemId = item.id,
                    retryable = false,
                    message = "Queued command type is not replayable in this build.",
                )
            }
            persistQueueAndSyncState(session.userId)
        }
    }

    private fun persistQueueAndSyncState(ownerUserId: String) {
        queueStore.saveAll(mutationQueue.snapshot())
        _uiState.value = _uiState.value.copy(jobSyncStates = jobSyncStatesForOwner(ownerUserId))
    }

    private fun jobSyncStatesForOwner(ownerUserId: String): Map<String, DriverJobSyncState> =
        deriveJobSyncStates(ownerUserId, mutationQueue.snapshot())

    fun submitQuoteForSelectedJob(amountText: String, note: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val profile = _uiState.value.profile ?: return@launch
            val selectedJobId = _uiState.value.selectedJobId
            val selectedJob = _uiState.value.jobs.firstOrNull { it.id == selectedJobId }
            val marketplaceJob = _uiState.value.marketplaceJobs.firstOrNull { it.id == selectedJobId }
            if (selectedJob == null && marketplaceJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a posted job first.")
                return@launch
            }
            val jobId = selectedJob?.id ?: marketplaceJob!!.id
            if (selectedJob != null && selectedJob.status.lowercase() != "posted") {
                _uiState.value = _uiState.value.copy(error = "Only posted jobs can be quoted.")
                return@launch
            }
            if (marketplaceJob != null && !marketplaceJob.canQuote) {
                _uiState.value = _uiState.value.copy(error = marketplaceJob.quoteWarning ?: "Your account does not permit bidding on this job.")
                return@launch
            }
            val amount = amountText.trim().toDoubleOrNull()
            if (amount == null || amount <= 0.0) {
                _uiState.value = _uiState.value.copy(error = "Enter a valid quote amount.")
                return@launch
            }
            val normalizedMessage = note.trim().ifBlank { "Submitted from XDrive Driver Android" }.take(1_000)
            val currency = "GBP"
            val bidKey = stableBidIntentKey(
                jobId = jobId,
                ownerUserId = session.userId,
                driverId = profile.driverId,
                amount = amount,
                currency = currency,
                message = normalizedMessage,
            )
            val bidCommand = MobileLifecycleCommand.createBid(
                amount = amount,
                currency = currency,
                message = normalizedMessage,
                bidKey = bidKey,
            )

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.submitJobQuote(
                session = session,
                jobId = jobId,
                amount = amount,
                message = normalizedMessage,
                bidKey = bidKey,
            )
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Quote submitted.",
                    )
                    refreshDriverData()
                }
                .onFailure { error ->
                    if (error is MobileApiException && error.retryable) {
                        mutationQueue.enqueue(
                            ownerUserId = session.userId,
                            driverId = profile.driverId,
                            jobId = jobId,
                            command = bidCommand,
                            mutationKey = "bid:${session.userId}:${jobId}:$bidKey",
                        )
                        persistQueueAndSyncState(session.userId)
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            message = "No stable connection. Quote queued securely and will retry automatically.",
                        )
                        return@onFailure
                    }
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
                        message = if (selectedJob.needsCollectionProof()) {
                    "Collection proof uploaded."
                } else {
                    "Delivery proof uploaded."
                },
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

    fun confirmDeliveryRecipientForSelectedJob(recipientName: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val profile = _uiState.value.profile ?: return@launch
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
            api.confirmDeliveryRecipient(session, profile.driverId, selectedJob, cleanName)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Recipient and signed POD evidence confirmed.",
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

    fun setAvailabilityStatus(newStatus: DriverAvailabilityStatus) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            _uiState.value = _uiState.value.copy(error = "", message = "")
            api.updateAvailabilityStatus(session, newStatus)
                .onSuccess { updated ->
                    _uiState.value = _uiState.value.copy(
                        availability = updated,
                        message = "Availability set to ${newStatus.label}.",
                    )
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        error = error.friendlyDriverMessage("Failed to update availability."),
                    )
                }
        }
    }

    fun toggleAvailabilitySlot(dayOfWeek: Int, slot: String, available: Boolean) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            _uiState.value = _uiState.value.copy(error = "", message = "")
            api.updateAvailabilitySlot(session, dayOfWeek, slot, available)
                .onSuccess { updated ->
                    _uiState.value = _uiState.value.copy(availability = updated)
                }
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        error = error.friendlyDriverMessage("Failed to update slot."),
                    )
                }
        }
    }
}

internal fun resolveSelectedJobId(
    currentSelectedJobId: String?,
    rememberedSelectedJobId: String?,
    jobs: List<DriverJob>,
): String? {
    val available = jobs.map { it.id }.toSet()
    return when {
        !currentSelectedJobId.isNullOrBlank() && currentSelectedJobId in available -> currentSelectedJobId
        !rememberedSelectedJobId.isNullOrBlank() && rememberedSelectedJobId in available -> rememberedSelectedJobId
        else -> null
    }
}

internal fun deriveJobSyncStates(
    ownerUserId: String,
    queueItems: List<MobileQueueItem>,
): Map<String, DriverJobSyncState> =
    queueItems
        .filter { it.ownerUserId == ownerUserId }
        .sortedBy { it.sequence }
        .groupBy { it.jobId }
        .mapNotNull { (jobId, items) ->
            val nextUnsynced = items.firstOrNull { it.state != MobileQueueState.SYNCED }
            nextUnsynced?.let {
                jobId to DriverJobSyncState(
                    state = it.state,
                    targetStatus = it.command.syncTargetLabel(),
                    lastError = it.lastError,
                )
            }
        }
        .toMap()

private fun isValidTransition(currentRaw: String, next: String): Boolean {
    return DriverLifecycleTransitions.isValidTransition(currentRaw, next)
}

private fun Throwable.isSessionError(): Boolean {
    if (this is MobileApiHttpException) return statusCode == 401
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
    if (this is MobileApiException) return safeUserMessage.ifBlank { fallback }
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

private fun stableBidIntentKey(
    jobId: String,
    ownerUserId: String,
    driverId: String,
    amount: Double,
    currency: String,
    message: String,
): String {
    val canonicalPayload = listOf(
        jobId.trim(),
        ownerUserId.trim(),
        driverId.trim(),
        java.math.BigDecimal.valueOf(amount).stripTrailingZeros().toPlainString(),
        currency.trim().uppercase(Locale.ROOT),
        message.trim(),
    ).joinToString("|")
    val digest = MessageDigest.getInstance("SHA-256")
        .digest(canonicalPayload.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
    return "bid_$digest"
}
