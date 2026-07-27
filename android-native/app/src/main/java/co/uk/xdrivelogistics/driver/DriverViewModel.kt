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
import co.uk.xdrivelogistics.driver.offline.PodPendingStore
import co.uk.xdrivelogistics.driver.offline.PodStorageException
import co.uk.xdrivelogistics.driver.offline.PodSubmissionStore
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
    /** Job IDs for which POD evidence has been uploaded but not yet finalised by the server. */
    val pendingPodJobIds: Set<String> = emptySet(),
    /** Job IDs whose POD submission has been blocked after too many failed finalisation attempts. */
    val blockedPodJobIds: Set<String> = emptySet(),
    /** The Live Loads marketplace job the user has selected for quoting/saving/hiding. Independent of operational selectedJobId. */
    val marketplaceSelectedJobId: String? = null,
    /** Marketplace job IDs the driver has saved (bookmarked) for later review. */
    val savedMarketplaceLoadIds: Set<String> = emptySet(),
    /** Marketplace job IDs the driver has hidden; filtered from the Live Loads list. */
    val hiddenMarketplaceLoadIds: Set<String> = emptySet(),
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
    private val podPendingStore = PodPendingStore(application.applicationContext)
    private val podSubmissionStore = PodSubmissionStore(application.applicationContext)
    private val mutationQueue = MobileOfflineQueue()
    private val api = ApiClient(
        xdriveBaseUrl = BuildConfig.XDRIVE_BASE_URL,
        supabaseUrl = BuildConfig.SUPABASE_URL,
        supabaseAnonKey = BuildConfig.SUPABASE_ANON_KEY,
    )

    private val _uiState = MutableStateFlow(DriverUiState())
    val uiState: StateFlow<DriverUiState> = _uiState.asStateFlow()
    private var liveRefreshJob: kotlinx.coroutines.Job? = null
    private var availabilityMutationLock = AvailabilityMutationLock()

    init {
        mutationQueue.restore(queueStore.readAll())
        queueStore.saveQuarantinedItems(mutationQueue.quarantinedSnapshot())
        viewModelScope.launch {
            sessionStore.session.collectLatest { persisted ->
                if (persisted == null) {
                    _uiState.value = DriverUiState()
                    return@collectLatest
                }

                // When a different owner's session replaces the current one directly (without an
                // intermediate null), clear all owner-scoped state before loading the new data.
                val previousOwnerId = _uiState.value.session?.userId
                if (ownerChanged(previousOwnerId, persisted.userId)) {
                    _uiState.value = _uiState.value.copy(
                        selectedJobId = null,
                        jobs = emptyList(),
                        jobSyncStates = emptyMap(),
                        availability = null,
                        pendingPodJobIds = emptySet(),
                        blockedPodJobIds = emptySet(),
                        marketplaceSelectedJobId = null,
                        marketplaceJobs = emptyList(),
                        savedMarketplaceLoadIds = emptySet(),
                        hiddenMarketplaceLoadIds = emptySet(),
                    )
                }

                _uiState.value = _uiState.value.copy(
                    isAuthenticated = true,
                    session = persisted,
                    error = "",
                )
                refreshDriverData()
                recoverPendingPodUploads(persisted)
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
        _uiState.value = _uiState.value.copy(
            selectedJobId = jobId,
            marketplaceSelectedJobId = null,
        )
        _uiState.value.session?.let { session ->
            activeJobSelectionStore.saveSelectedJobId(session.userId, jobId)
        }
    }

    /** Selects a Live Loads marketplace job for quoting/saving/hiding. Does not affect operational [selectedJobId]. */
    fun selectMarketplaceLoad(jobId: String) {
        _uiState.value = _uiState.value.copy(marketplaceSelectedJobId = jobId)
    }

    /** Clears the marketplace selection without affecting the operational job selection. */
    fun clearMarketplaceSelection() {
        _uiState.value = _uiState.value.copy(marketplaceSelectedJobId = null)
    }

    /** Saves a marketplace load to the driver's bookmarked list. */
    fun saveMarketplaceLoad(jobId: String) {
        _uiState.value = _uiState.value.copy(
            savedMarketplaceLoadIds = _uiState.value.savedMarketplaceLoadIds + jobId,
        )
    }

    /**
     * Hides a marketplace load from the Live Loads list.
     * If the hidden job was the current marketplace selection, the selection is cleared.
     */
    fun hideMarketplaceLoad(jobId: String) {
        val currentSelection = _uiState.value.marketplaceSelectedJobId
        _uiState.value = _uiState.value.copy(
            hiddenMarketplaceLoadIds = _uiState.value.hiddenMarketplaceLoadIds + jobId,
            marketplaceSelectedJobId = if (currentSelection == jobId) null else currentSelection,
        )
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
                        // Guard: discard stale responses from a previous owner's session.
                        if (!shouldApplyAvailabilityResponse(_uiState.value.session, session)) return@onSuccess
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
                        if (!shouldApplyAvailabilityResponse(_uiState.value.session, session)) return@onFailure
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
                if (!shouldApplyAvailabilityResponse(_uiState.value.session, session)) return@onFailure
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
            // Dispatch notes must only target operational assigned jobs, not marketplace loads.
            val selectedJob = resolveSelectedJob(_uiState.value.jobs, _uiState.value.selectedJobId)
            if (selectedJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a job first.")
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
            api.sendQuickNote(session.accessToken, selectedJob.id, note.trim(), important)
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

    /**
     * Register or refresh the FCM push notification device token.
     * Call this after successfully acquiring a token from FirebaseMessaging.getInstance().token.
     * Full FCM integration requires Firebase Messaging SDK and google-services.json in the project.
     */
    fun registerDeviceToken(token: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            api.registerDeviceToken(session, token)
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
            val selectedJob = resolveSelectedJob(_uiState.value.jobs, _uiState.value.selectedJobId)
            if (selectedJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a job first.")
                return@launch
            }
            val jobId = selectedJob.id

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
                                mutationKey = "lifecycle:${session.userId}:${profile.driverId}:$jobId:${command.action?.name ?: nextStatus}",
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
            // Quote actions are Live Loads marketplace actions; resolve via marketplaceSelectedJobId only.
            val marketplaceJob = resolveQuoteTargetMarketplaceJob(
                marketplaceJobs = _uiState.value.marketplaceJobs,
                marketplaceSelectedJobId = _uiState.value.marketplaceSelectedJobId,
            )
            if (marketplaceJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a Live Load first.")
                return@launch
            }
            if (!marketplaceJob.canQuote) {
                _uiState.value = _uiState.value.copy(error = marketplaceJob.quoteWarning ?: "Your account does not permit bidding on this job.")
                return@launch
            }
            val amount = amountText.trim().toDoubleOrNull()
            if (amount == null || amount <= 0.0) {
                _uiState.value = _uiState.value.copy(error = "Enter a valid quote amount.")
                return@launch
            }
            val jobId = marketplaceJob.id
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
                            mutationKey = bidMutationKey(
                                ownerUserId = session.userId,
                                jobId = jobId,
                                bidKey = bidKey,
                            ),
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
            val selectedJob = resolveSelectedJob(_uiState.value.jobs, _uiState.value.selectedJobId)
            if (selectedJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a job first.")
                return@launch
            }

            if (!podSubmissionStore.isStorageAvailable) {
                _uiState.value = _uiState.value.copy(
                    error = "Device secure storage is unavailable. Cannot safely persist evidence before upload.",
                )
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")

            val isCollection = selectedJob.needsCollectionProof()
            val kind = if (isCollection) "collection" else "photos"
            val safeName = fileName.ifBlank { "pod.jpg" }.replace("[^a-zA-Z0-9._-]".toRegex(), "_")
            val ext = safeName.substringAfterLast('.', "jpg")

            // Generate stable per-evidence identifiers before any network call.
            val nonce = java.util.UUID.randomUUID().toString().replace("-", "").take(16)
            val evidenceId = "ev-${session.userId.take(8)}-$nonce"
            val podKey = podSubmissionStore.getForOwnerJob(session.userId, selectedJob.id)?.podKey
                ?: "pod-${selectedJob.id.take(8)}-${session.userId.take(8)}-$nonce"

            // Compute SHA-256 fingerprint for idempotency conflict detection.
            val sha256 = computeSha256Hex(bytes)

            // Write bytes to app-private durable storage BEFORE any network call or store write.
            // This ensures the file survives process death and can be re-uploaded on recovery.
            val durableDir = java.io.File(getApplication<Application>().filesDir, "pod/${session.userId}/${selectedJob.id}")
            val durableFile = java.io.File(durableDir, "$evidenceId.$ext")
            try {
                durableDir.mkdirs()
                durableFile.writeBytes(bytes)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Failed to write evidence to device storage: ${e.message}",
                )
                return@launch
            }

            // Compute initial payload fingerprint from stable identifiers before first network call.
            val initialFingerprint = computeSha256Hex(("$podKey|$evidenceId|$sha256").toByteArray())

            // Record the evidence intent before any network call (crash safety).
            val evidenceRecord = PodSubmissionStore.EvidenceRecord(
                evidenceId = evidenceId,
                localUri = durableFile.absolutePath,
                sha256Hex = sha256,
                mimeType = mimeType,
                byteSize = bytes.size.toLong(),
                kind = kind,
            )
            val existingRecord = podSubmissionStore.getForOwnerJob(session.userId, selectedJob.id)
            val submissionFingerprint: String
            if (existingRecord == null) {
                submissionFingerprint = initialFingerprint
                try {
                    podSubmissionStore.recordSubmission(
                        PodSubmissionStore.PodSubmissionRecord(
                            podKey = podKey,
                            payloadFingerprint = initialFingerprint,
                            ownerUserId = session.userId,
                            driverId = profile.driverId,
                            jobId = selectedJob.id,
                            recipientName = "",
                            signatureDataUri = null,
                            notes = null,
                            evidence = listOf(evidenceRecord),
                        )
                    )
                } catch (e: PodStorageException) {
                    durableFile.delete()
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Failed to persist evidence record: ${e.message}",
                    )
                    return@launch
                }
            } else {
                // Append (or deterministically replace same evidenceId) into the existing record.
                // Never upload evidence that is absent from the persisted submission.
                val updatedEvidence = existingRecord.evidence.filter { it.evidenceId != evidenceId } + evidenceRecord
                val updatedFingerprint = computeSha256Hex(
                    (existingRecord.podKey + "|" +
                        updatedEvidence.sortedBy { it.evidenceId }
                            .joinToString("|") { "${it.evidenceId}:${it.sha256Hex}" } +
                        "|" + existingRecord.recipientName).toByteArray()
                )
                submissionFingerprint = updatedFingerprint
                try {
                    podSubmissionStore.recordSubmission(
                        existingRecord.copy(evidence = updatedEvidence, payloadFingerprint = updatedFingerprint)
                    )
                } catch (e: PodStorageException) {
                    durableFile.delete()
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Failed to append evidence record: ${e.message}",
                    )
                    return@launch
                }
            }

            // Phase 1: obtain server-issued signed upload URL.
            api.initPodEvidenceUpload(
                session = session,
                jobId = selectedJob.id,
                podKey = podKey,
                evidenceId = evidenceId,
                fileName = safeName,
                mimeType = mimeType,
                byteSize = bytes.size.toLong(),
                kind = kind,
                sha256Hex = sha256,
                payloadFingerprint = submissionFingerprint,
            ).onFailure { error ->
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = error.friendlyDriverMessage("Failed to initialise evidence upload."),
                )
                return@launch
            }.onSuccess { initResult ->
                try {
                    podSubmissionStore.markEvidenceInitiated(session.userId, selectedJob.id, evidenceId)
                } catch (e: PodStorageException) {
                    runCatching { podSubmissionStore.markBlocked(session.userId, selectedJob.id) }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Failed to persist upload state. Evidence is safe; retry from the job.",
                        blockedPodJobIds = _uiState.value.blockedPodJobIds + selectedJob.id,
                    )
                    return@launch
                }

                // Phase 2: upload bytes to the signed URL.
                api.uploadEvidenceBytes(initResult.signedUrl, bytes, mimeType)
                    .onFailure { error ->
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = error.friendlyDriverMessage("Failed to upload evidence."),
                        )
                        return@launch
                    }
                    .onSuccess {
                        try {
                            podSubmissionStore.markEvidenceUploaded(
                                session.userId,
                                selectedJob.id,
                                evidenceId,
                                initResult.path,
                            )
                        } catch (e: PodStorageException) {
                            // Upload succeeded but state write failed — block for manual retry.
                            // Recovery can safely re-init/re-upload with the same evidence ID and key.
                            runCatching { podSubmissionStore.markBlocked(session.userId, selectedJob.id) }
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                error = "Evidence uploaded but state could not be saved. Manual retry required.",
                                blockedPodJobIds = _uiState.value.blockedPodJobIds + selectedJob.id,
                            )
                            return@launch
                        }

                        if (isCollection) {
                            // Phase 3 (collection): finalise immediately — no recipient step.
                            api.finaliseCollectionProof(
                                session = session,
                                jobId = selectedJob.id,
                                podKey = podKey,
                                collectionPath = initResult.path,
                            ).onSuccess {
                                try {
                                    podSubmissionStore.clearSubmission(session.userId, selectedJob.id)
                                } catch (e: PodStorageException) {
                                    // Non-fatal: record will be retried on restart and server is idempotent.
                                }
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    message = "Collection proof uploaded.",
                                )
                                refreshDriverData()
                            }.onFailure { error ->
                                _uiState.value = _uiState.value.copy(
                                    isLoading = false,
                                    error = error.friendlyDriverMessage("Failed to submit collection proof."),
                                )
                            }
                        } else {
                            // Phase 3 (delivery): wait for recipient confirmation.
                            val newPending = _uiState.value.pendingPodJobIds + selectedJob.id
                            _uiState.value = _uiState.value.copy(
                                isLoading = false,
                                message = "Evidence uploaded. Enter recipient name to confirm POD.",
                                pendingPodJobIds = newPending,
                            )
                        }
                    }
            }
        }
    }

    /**
     * Resume any in-progress POD submissions that were interrupted by an app crash
     * or killed-process restart. Called once per session restore.
     *
     * For records in READY_TO_FINALISE state (upload succeeded, server call not confirmed),
     * retries [finalisePod]. Records in PENDING state (upload not confirmed) are left
     * for the user to re-trigger; after [PodSubmissionStore.MAX_ATTEMPTS] finalisation
     * failures the record is quarantined.
     *
     * Legacy [PodPendingStore] records from the old direct-PATCH workflow are also
     * retried for backward compatibility during the transition period.
     */
    private suspend fun recoverPendingPodUploads(session: DriverSession) {
        // New server-mediated submissions.
        for (rec in podSubmissionStore.pendingForOwner(session.userId)) {
            // Surface blocked records in UI; do not silently delete or retry them.
            if (rec.state == PodSubmissionStore.SubmissionState.BLOCKED) {
                _uiState.value = _uiState.value.copy(
                    blockedPodJobIds = _uiState.value.blockedPodJobIds + rec.jobId,
                )
                continue
            }

            if (rec.state == PodSubmissionStore.SubmissionState.READY_TO_FINALISE &&
                rec.recipientName.isNotBlank()
            ) {
                try {
                    podSubmissionStore.incrementAttemptCount(session.userId, rec.jobId)
                } catch (e: PodStorageException) {
                    // Non-fatal: continue with best-effort retry.
                }
                val photoPaths = rec.evidence
                    .filter { it.kind == "photos" && it.storagePath != null }
                    .mapNotNull { it.storagePath }
                val documentPaths = rec.evidence
                    .filter { it.kind == "documents" && it.storagePath != null }
                    .mapNotNull { it.storagePath }

                api.finalisePod(
                    session = session,
                    jobId = rec.jobId,
                    podKey = rec.podKey,
                    recipientName = rec.recipientName,
                    signatureDataUri = rec.signatureDataUri,
                    photoPaths = photoPaths,
                    documentPaths = documentPaths,
                    notes = rec.notes,
                    payloadFingerprint = rec.payloadFingerprint,
                ).onSuccess {
                    try {
                        podSubmissionStore.clearSubmission(session.userId, rec.jobId)
                    } catch (e: PodStorageException) {
                        // Non-fatal: server confirmed; record will be retried but server is idempotent.
                    }
                }
                // On failure, leave record. After MAX_ATTEMPTS, block (never silently delete).
                val updated = podSubmissionStore.getForOwnerJob(session.userId, rec.jobId)
                if ((updated?.attemptCount ?: 0) >= PodSubmissionStore.MAX_ATTEMPTS) {
                    try {
                        podSubmissionStore.markBlocked(session.userId, rec.jobId)
                    } catch (e: PodStorageException) {
                        // Best-effort; record remains for next session.
                    }
                    _uiState.value = _uiState.value.copy(
                        blockedPodJobIds = _uiState.value.blockedPodJobIds + rec.jobId,
                    )
                }
                continue
            }

            // For PENDING evidence (PENDING_UPLOAD or UPLOAD_INITIATED), re-upload from the
            // durable local file if it still exists and its integrity can be verified.
            for (ev in rec.evidence) {
                if (ev.state != PodSubmissionStore.EvidenceState.PENDING_UPLOAD &&
                    ev.state != PodSubmissionStore.EvidenceState.UPLOAD_INITIATED
                ) continue

                val localFile = java.io.File(ev.localUri)
                if (!localFile.exists() || localFile.length() != ev.byteSize) continue

                val bytes = try { localFile.readBytes() } catch (e: Exception) { continue }
                val actualSha256 = computeSha256Hex(bytes)
                if (actualSha256 != ev.sha256Hex) continue

                // File verified; re-initiate upload (signed URL may have expired).
                api.initPodEvidenceUpload(
                    session = session,
                    jobId = rec.jobId,
                    podKey = rec.podKey,
                    evidenceId = ev.evidenceId,
                    fileName = "${ev.evidenceId}.${ev.mimeType.substringAfter('/')}",
                    mimeType = ev.mimeType,
                    byteSize = ev.byteSize,
                    kind = ev.kind,
                    sha256Hex = ev.sha256Hex,
                    payloadFingerprint = rec.payloadFingerprint,
                ).onSuccess { initResult ->
                    val initiatedOk = runCatching {
                        podSubmissionStore.markEvidenceInitiated(session.userId, rec.jobId, ev.evidenceId)
                    }
                    if (initiatedOk.isFailure) {
                        runCatching { podSubmissionStore.markBlocked(session.userId, rec.jobId) }
                        _uiState.value = _uiState.value.copy(
                            blockedPodJobIds = _uiState.value.blockedPodJobIds + rec.jobId,
                        )
                        return@onSuccess
                    }

                    api.uploadEvidenceBytes(initResult.signedUrl, bytes, ev.mimeType)
                        .onSuccess {
                            val uploadedOk = runCatching {
                                podSubmissionStore.markEvidenceUploaded(
                                    session.userId, rec.jobId, ev.evidenceId, initResult.path,
                                )
                            }
                            if (uploadedOk.isFailure) {
                                runCatching { podSubmissionStore.markBlocked(session.userId, rec.jobId) }
                                _uiState.value = _uiState.value.copy(
                                    blockedPodJobIds = _uiState.value.blockedPodJobIds + rec.jobId,
                                )
                            }
                        }
                }
            }

            // Jobs that have all evidence uploaded (but no recipient name yet) are surfaced
            // in UI via pendingPodJobIds so the driver can complete the flow.
            val refreshed = podSubmissionStore.getForOwnerJob(session.userId, rec.jobId) ?: rec
            if (refreshed.state != PodSubmissionStore.SubmissionState.READY_TO_FINALISE ||
                refreshed.recipientName.isBlank()
            ) {
                val allUploaded = refreshed.evidence.all {
                    it.state == PodSubmissionStore.EvidenceState.UPLOADED
                }
                if (allUploaded) {
                    _uiState.value = _uiState.value.copy(
                        pendingPodJobIds = _uiState.value.pendingPodJobIds + rec.jobId,
                    )
                }
            }
        }
    }

    fun confirmDeliveryRecipientForSelectedJob(recipientName: String) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val profile = _uiState.value.profile ?: return@launch
            val selectedJob = resolveSelectedJob(_uiState.value.jobs, _uiState.value.selectedJobId)
            if (selectedJob == null) {
                _uiState.value = _uiState.value.copy(error = "Select a job first.")
                return@launch
            }

            val hasPendingEvidence = selectedJob.id in _uiState.value.pendingPodJobIds
            if (!hasPendingEvidence && !selectedJob.hasPod()) {
                _uiState.value = _uiState.value.copy(error = "Upload the signed POD evidence before confirming the recipient.")
                return@launch
            }

            val cleanName = recipientName.trim()
            if (cleanName.isBlank()) {
                _uiState.value = _uiState.value.copy(error = "Enter the recipient name.")
                return@launch
            }

            _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")

            // Obtain the pending submission record so we can call finalisePod with the
            // evidence paths and the stable podKey.
            val submission = podSubmissionStore.getForOwnerJob(session.userId, selectedJob.id)

            if (submission != null) {
                // New server-mediated path.
                val photoPaths = submission.evidence
                    .filter { it.kind == "photos" && it.storagePath != null }
                    .mapNotNull { it.storagePath }
                val documentPaths = submission.evidence
                    .filter { it.kind == "documents" && it.storagePath != null }
                    .mapNotNull { it.storagePath }

                if (photoPaths.isEmpty() && documentPaths.isEmpty()) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "No uploaded evidence found. Re-upload the POD photo.",
                    )
                    return@launch
                }

                // Compute canonical payload fingerprint from stable identifiers only.
                // Uses podKey + sorted(evidenceId:sha256Hex) pairs + recipientName.
                // Never derived from server-issued storage paths so recovery can reproduce it.
                val evidencePairs = submission.evidence
                    .sortedBy { it.evidenceId }
                    .joinToString("|") { "${it.evidenceId}:${it.sha256Hex}" }
                val fingerprintInput = "${submission.podKey}|$evidencePairs|$cleanName"
                val fingerprint = computeSha256Hex(fingerprintInput.toByteArray())

                // Persist the recipient name and fingerprint so crash recovery can retry.
                try {
                    podSubmissionStore.recordSubmission(
                        submission.copy(
                            recipientName = cleanName,
                            payloadFingerprint = fingerprint,
                            state = PodSubmissionStore.SubmissionState.READY_TO_FINALISE,
                        )
                    )
                } catch (e: PodStorageException) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Failed to persist POD confirmation record: ${e.message}",
                    )
                    return@launch
                }

                api.finalisePod(
                    session = session,
                    jobId = selectedJob.id,
                    podKey = submission.podKey,
                    recipientName = cleanName,
                    signatureDataUri = submission.signatureDataUri,
                    photoPaths = photoPaths,
                    documentPaths = documentPaths,
                    notes = submission.notes,
                    payloadFingerprint = fingerprint,
                ).onSuccess {
                    try {
                        podSubmissionStore.clearSubmission(session.userId, selectedJob.id)
                    } catch (e: PodStorageException) {
                        // Non-fatal: server confirmed; record will be retried but server is idempotent.
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Recipient and signed POD evidence confirmed.",
                        pendingPodJobIds = _uiState.value.pendingPodJobIds - selectedJob.id,
                    )
                    refreshDriverData()
                }.onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to confirm delivery evidence."),
                    )
                }
            } else if (selectedJob.hasPod()) {
                // Fallback: job already has server-confirmed POD (podGenerated=true or photos set).
                // The server's /pod endpoint is idempotent; submitting existing photo paths with a
                // new key is safe for legacy jobs that were confirmed through the old direct-PATCH path.
                val nonce = java.util.UUID.randomUUID().toString().replace("-", "").take(16)
                val fallbackKey = "pod-legacy-${selectedJob.id.take(8)}-$nonce"
                val fallbackPaths = (selectedJob.deliveryPhotos + selectedJob.podPhotos).distinct().sorted()
                val fallbackFingerprint = computeSha256Hex(
                    ("$fallbackKey|${fallbackPaths.joinToString("|")}|$cleanName").toByteArray()
                )
                api.finalisePod(
                    session = session,
                    jobId = selectedJob.id,
                    podKey = fallbackKey,
                    recipientName = cleanName,
                    signatureDataUri = null,
                    photoPaths = selectedJob.deliveryPhotos,
                    documentPaths = selectedJob.podPhotos,
                    payloadFingerprint = fallbackFingerprint,
                ).onSuccess {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        message = "Recipient and signed POD evidence confirmed.",
                        pendingPodJobIds = _uiState.value.pendingPodJobIds - selectedJob.id,
                    )
                    refreshDriverData()
                }.onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = error.friendlyDriverMessage("Failed to confirm delivery evidence."),
                    )
                }
            } else {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "No POD evidence found. Upload the signed photo first.",
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
            val (nextLock, statusAccepted) = claimAvailabilityStatusLock(availabilityMutationLock, newStatus)
            if (!statusAccepted) {
                _uiState.value = _uiState.value.copy(error = "Availability update already in progress.")
                return@launch
            }
            availabilityMutationLock = nextLock
            _uiState.value = _uiState.value.copy(error = "", message = "")
            api.updateAvailabilityStatus(session, newStatus)
                .onSuccess { updated ->
                    if (shouldApplyAvailabilityResponse(_uiState.value.session, session)) {
                        _uiState.value = _uiState.value.copy(
                            availability = updated,
                            message = "Availability set to ${newStatus.label}.",
                        )
                    }
                }
                .onFailure { error ->
                    if (shouldApplyAvailabilityResponse(_uiState.value.session, session)) {
                        _uiState.value = _uiState.value.copy(
                            error = error.friendlyDriverMessage("Failed to update availability."),
                        )
                    }
                }
            availabilityMutationLock = releaseAvailabilityStatusLock(availabilityMutationLock, newStatus)
        }
    }

    fun toggleAvailabilitySlot(dayOfWeek: Int, slot: String, available: Boolean) {
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            val (nextLock, slotAccepted) = claimAvailabilitySlotLock(availabilityMutationLock, dayOfWeek, slot)
            if (!slotAccepted) {
                _uiState.value = _uiState.value.copy(error = "Slot update already in progress.")
                return@launch
            }
            availabilityMutationLock = nextLock
            _uiState.value = _uiState.value.copy(error = "", message = "")
            api.updateAvailabilitySlot(session, dayOfWeek, slot, available)
                .onSuccess { updated ->
                    if (shouldApplyAvailabilityResponse(_uiState.value.session, session)) {
                        _uiState.value = _uiState.value.copy(availability = updated)
                    }
                }
                .onFailure { error ->
                    if (shouldApplyAvailabilityResponse(_uiState.value.session, session)) {
                        _uiState.value = _uiState.value.copy(
                            error = error.friendlyDriverMessage("Failed to update slot."),
                        )
                    }
                }
            availabilityMutationLock = releaseAvailabilitySlotLock(availabilityMutationLock, dayOfWeek, slot)
        }
    }
}

internal fun resolveSelectedJobId(
    currentSelectedJobId: String?,
    rememberedSelectedJobId: String?,
    jobs: List<DriverJob>,
): String? {
    // Only actionable (non-terminal) jobs are valid selection targets.
    val actionable = jobs.filter { it.isActive() }.map { it.id }.toSet()
    return when {
        !currentSelectedJobId.isNullOrBlank() && currentSelectedJobId in actionable -> currentSelectedJobId
        !rememberedSelectedJobId.isNullOrBlank() && rememberedSelectedJobId in actionable -> rememberedSelectedJobId
        else -> null
    }
}

/**
 * Returns the explicitly selected [DriverJob] from [jobs] whose ID equals [selectedJobId],
 * or null when [selectedJobId] is null/blank or no match is found.
 * Never falls back to the first job or any other implicit candidate.
 */
internal fun resolveSelectedJob(jobs: List<DriverJob>, selectedJobId: String?): DriverJob? {
    if (selectedJobId.isNullOrBlank()) return null
    return jobs.firstOrNull { it.id == selectedJobId }
}

/** Returns an error message when no job is selected, null when a valid selection is present. */
internal fun noJobSelectedError(selectedJobId: String?): String? =
    if (selectedJobId.isNullOrBlank()) "Select a job first." else null

internal data class AvailabilityMutationLock(
    val statusTarget: DriverAvailabilityStatus? = null,
    val slotTargets: Set<String> = emptySet(),
)

internal fun claimAvailabilityStatusLock(
    current: AvailabilityMutationLock,
    newStatus: DriverAvailabilityStatus,
): Pair<AvailabilityMutationLock, Boolean> {
    if (current.statusTarget != null) return current to false
    return current.copy(statusTarget = newStatus) to true
}

internal fun releaseAvailabilityStatusLock(
    current: AvailabilityMutationLock,
    completedStatus: DriverAvailabilityStatus,
): AvailabilityMutationLock =
    if (current.statusTarget == completedStatus) current.copy(statusTarget = null) else current

internal fun claimAvailabilitySlotLock(
    current: AvailabilityMutationLock,
    dayOfWeek: Int,
    slot: String,
): Pair<AvailabilityMutationLock, Boolean> {
    val key = availabilitySlotTargetKey(dayOfWeek, slot)
    if (key in current.slotTargets) return current to false
    return current.copy(slotTargets = current.slotTargets + key) to true
}

internal fun releaseAvailabilitySlotLock(
    current: AvailabilityMutationLock,
    dayOfWeek: Int,
    slot: String,
): AvailabilityMutationLock =
    current.copy(slotTargets = current.slotTargets - availabilitySlotTargetKey(dayOfWeek, slot))

internal fun availabilitySlotTargetKey(dayOfWeek: Int, slot: String): String =
    "$dayOfWeek:${slot.trim().uppercase(Locale.ROOT)}"

internal fun shouldApplyAvailabilityResponse(currentSession: DriverSession?, requestSession: DriverSession): Boolean =
    currentSession?.userId == requestSession.userId &&
        currentSession.accessToken == requestSession.accessToken

/**
 * Returns the [MarketplaceJob] from [marketplaceJobs] whose ID equals [marketplaceSelectedJobId],
 * or null when [marketplaceSelectedJobId] is null/blank or no match is found.
 * Keeps marketplace selection strictly separate from the operational job selection.
 */
internal fun resolveMarketplaceJob(
    marketplaceJobs: List<MarketplaceJob>,
    marketplaceSelectedJobId: String?,
): MarketplaceJob? {
    if (marketplaceSelectedJobId.isNullOrBlank()) return null
    return marketplaceJobs.firstOrNull { it.id == marketplaceSelectedJobId }
}

internal fun resolveQuoteTargetMarketplaceJob(
    marketplaceJobs: List<MarketplaceJob>,
    marketplaceSelectedJobId: String?,
): MarketplaceJob? = resolveMarketplaceJob(marketplaceJobs, marketplaceSelectedJobId)

internal data class ActionScreenTargets(
    val operationalJob: DriverJob?,
    val marketplaceJob: MarketplaceJob?,
)

internal fun resolveActionScreenTargets(
    jobs: List<DriverJob>,
    selectedJobId: String?,
    marketplaceJobs: List<MarketplaceJob>,
    marketplaceSelectedJobId: String?,
): ActionScreenTargets {
    val marketplaceJob = resolveMarketplaceJob(marketplaceJobs, marketplaceSelectedJobId)
    if (marketplaceJob != null) {
        return ActionScreenTargets(operationalJob = null, marketplaceJob = marketplaceJob)
    }
    return ActionScreenTargets(
        operationalJob = resolveSelectedJob(jobs, selectedJobId),
        marketplaceJob = null,
    )
}

/** Returns true when a session owner change requires owner-scoped UI state to be reset. */
internal fun ownerChanged(previousOwnerId: String?, newOwnerId: String): Boolean =
    previousOwnerId != null && previousOwnerId != newOwnerId

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

internal fun stableBidIntentKey(
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

internal fun bidMutationKey(ownerUserId: String, jobId: String, bidKey: String): String =
    "bid:${ownerUserId.trim()}:${jobId.trim()}:${bidKey.trim()}"

/**
 * Compute the lowercase hex SHA-256 digest of [bytes].
 * Used for POD payload fingerprinting and evidence integrity checks.
 */
private fun computeSha256Hex(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }
