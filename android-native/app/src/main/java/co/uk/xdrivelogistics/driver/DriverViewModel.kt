package co.uk.xdrivelogistics.driver

import android.app.Application
import androidx.annotation.VisibleForTesting
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import co.uk.xdrivelogistics.driver.data.ApiClient
import co.uk.xdrivelogistics.driver.data.DriverAvailability
import co.uk.xdrivelogistics.driver.data.DriverAvailabilityStatus
import co.uk.xdrivelogistics.driver.data.DriverBid
import co.uk.xdrivelogistics.driver.data.DriverDocument
import co.uk.xdrivelogistics.driver.data.DriverJob
import co.uk.xdrivelogistics.driver.data.DispatcherMessage
import co.uk.xdrivelogistics.driver.data.DriverProfile
import co.uk.xdrivelogistics.driver.data.DriverReturnJourney
import co.uk.xdrivelogistics.driver.data.DriverInvoice
import co.uk.xdrivelogistics.driver.data.DriverSession
import co.uk.xdrivelogistics.driver.data.MarketplaceJob
import co.uk.xdrivelogistics.driver.data.MobileApiException
import co.uk.xdrivelogistics.driver.data.MobileApiHttpException
import co.uk.xdrivelogistics.driver.data.NearbyDriver
import co.uk.xdrivelogistics.driver.data.SessionRepository
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
import kotlinx.coroutines.withTimeoutOrNull
import java.security.MessageDigest
import java.util.Locale
import java.util.UUID


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
    val returnJourney: DriverReturnJourney? = null,
    val invoices: List<DriverInvoice> = emptyList(),
    val nearbyDrivers: List<NearbyDriver> = emptyList(),
    val jobSearchPreferences: Map<String, String> = emptyMap(),
    val selectedTab: DriverTab = DriverTab.NEARBY,
    val selectedJobId: String? = null,
    val jobSyncStates: Map<String, DriverJobSyncState> = emptyMap(),
    val availability: DriverAvailability? = null,
    /** Non-null when the most recent availability load or refresh failed; null on success or before first load. */
    val availabilityError: String? = null,
    /** Dispatcher messages loaded from the authenticated /api/driver/mobile/messages endpoint. */
    val dispatcherMessages: List<DispatcherMessage> = emptyList(),
    /** Server-confirmed count of unread dispatcher messages. */
    val dispatcherUnreadCount: Int = 0,
    /** Non-null when the most recent dispatcher messages load failed; null on success or before first load. */
    val dispatcherMessagesError: String? = null,
    /** True when there may be additional older messages available to paginate. */
    val dispatcherMessagesHasMore: Boolean = false,
    /** The in-progress dispatch note draft, preserved until server-confirmed success. */
    val dispatchNoteDraft: String = "",
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
    /**
     * Monotonically increasing counter that is advanced on every logout, direct owner change,
     * or session expiry. A [PendingDeepLinkCommand] whose [PendingDeepLinkCommand.authEpoch]
     * does not equal this value is stale and is discarded by [resolvePendingDeepLink] rather
     * than being routed under a different owner's session.
     *
     * The epoch starts at 0 and is never reset to 0 after the first session-null event; each
     * session end unconditionally increments it so commands from prior sessions are rejected.
     */
    val authEpoch: Long = 0L,
    /**
     * A one-shot deep-link routing command that arrived before the session or jobs were loaded
     * (cold start). Processed and cleared once [isAuthenticated] is true and the jobs list has
     * been loaded. Only [DeepLinkDestination.Job] commands are held here; all other destinations
     * route immediately.
     *
     * The command carries [PendingDeepLinkCommand.authEpoch] — a snapshot of [authEpoch] at
     * capture time. [resolvePendingDeepLink] rejects the command if its epoch does not match the
     * current [authEpoch], preventing a command captured under owner A from executing under
     * owner B's session.
     */
    val pendingDeepLink: PendingDeepLinkCommand? = null,
    /**
     * The set of [PendingDeepLinkCommand.commandId] values that have already been consumed
     * (routed) in this session. Used by [DriverViewModel.handleDeepLink] to implement
     * one-shot deduplication: if the same [commandId] arrives again after Activity recreation
     * or notification redelivery, the command is not executed a second time.
     *
     * Cleared on every session boundary (logout, owner change, expiry) together with [authEpoch].
     */
    val consumedCommandIds: Set<String> = emptySet(),
)

/**
 * An auth-epoch-scoped one-shot deep-link routing command held in [DriverUiState.pendingDeepLink].
 *
 * [authEpoch] is a snapshot of [DriverUiState.authEpoch] at the time the command was captured.
 * [resolvePendingDeepLink] validates that this epoch still matches the current state epoch before
 * routing; a mismatch means the command was captured under a different owner's session and it is
 * discarded rather than executed. Logout, direct owner replacement, and session expiry all
 * advance the epoch so stale commands cannot bind to a new session.
 *
 * [commandId] is a stable identifier derived from the delivery event (e.g. the deep-link URI
 * string) that allows [DriverViewModel.handleDeepLink] to detect and discard duplicate
 * deliveries of the same event — for example when the Activity is recreated and [onCreate] is
 * called again with the same intent, or when a push notification is re-delivered. Once a command
 * is consumed its [commandId] is added to [DriverUiState.consumedCommandIds]; any subsequent
 * delivery with the same [commandId] is a no-op.
 */
data class PendingDeepLinkCommand(
    val destination: DeepLinkDestination.Job,
    /** The [DriverUiState.authEpoch] at capture time. Must equal the current epoch to execute. */
    val authEpoch: Long,
    /**
     * Stable identity for this delivery event. Derived from the deep-link URI (or FCM message
     * ID for push-triggered routing) so that re-delivery of the same event produces the same
     * [commandId] and can be deduplicated against [DriverUiState.consumedCommandIds].
     */
    val commandId: String,
)

data class DriverJobSyncState(
    val state: MobileQueueState,
    val targetStatus: String,
    val lastError: String = "",
)

class DriverViewModel(
    application: Application,
    private val sessionStore: SessionRepository,
    /**
     * When true, [loadDriverDataWithSession] skips all network calls and immediately processes
     * any pending deep link. Intended exclusively for instrumented tests that inject a
     * [SessionRepository] fake and need deterministic session transitions without live API access.
     */
    @get:VisibleForTesting
    internal val skipDataRefreshForTesting: Boolean = false,
) : AndroidViewModel(application) {
    private val activeJobSelectionStore = ActiveJobSelectionStore(application.applicationContext)
    private val queueStore = MobileOfflineQueueStore(application.applicationContext)
    private val podPendingStore = PodPendingStore(application.applicationContext)
    private val podSubmissionStore = PodSubmissionStore(application.applicationContext)
    /** Durable store for a pending FCM unregister that must survive process death. */
    private val pendingUnregisterStore = PendingUnregisterStore(application.applicationContext)
    /** Coordinator for FCM device-token writes from both onNewToken() and registerDeviceToken(). */
    private val deviceTokenCoordinator = DeviceTokenCoordinator(application.applicationContext)
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
    /** Owner/session-scoped in-flight guard for load-more pagination requests. */
    private val loadMoreInFlight = OwnerSessionInFlightGuard()
    /** Owner/session-scoped in-flight guard that serializes mark-one and mark-all mutations. */
    private val readMutationInFlight = OwnerSessionInFlightGuard()
    /** Owner/session-scoped in-flight guard for dispatch-note send requests. */
    private val dispatchNoteInFlight = OwnerSessionInFlightGuard()
    /** Owner/session-scoped guard for FCM device-token registration calls. */
    private val deviceTokenInFlight = OwnerSessionInFlightGuard()
    /** Last successfully registered owner id for the current device token. */
    private var registeredDeviceTokenOwnerId: String? = null
    /** Last successfully registered token for the current owner. */
    private var registeredDeviceTokenValue: String? = null
    /** Operation generation of the last successfully registered token. */
    private var registeredDeviceTokenGeneration: Long = -1L
    /** Installation id associated with the last successful registration. */
    private var registeredDeviceTokenInstallationId: String? = null

    init {
        mutationQueue.restore(queueStore.readAll())
        queueStore.saveQuarantinedItems(mutationQueue.quarantinedSnapshot())
        viewModelScope.launch {
            sessionStore.session.collectLatest { persisted ->
                if (persisted == null) {
                    clearOwnerScopedMessageRequestGuards()
                    clearOwnerScopedDeviceTokenState()
                    // Advance epoch so commands captured under the previous session are
                    // rejected by resolvePendingDeepLink after this reset.
                    _uiState.value = DriverUiState(authEpoch = _uiState.value.authEpoch + 1)
                    return@collectLatest
                }

                // When a different owner's session replaces the current one directly (without an
                // intermediate null), clear all owner-scoped state before loading the new data.
                val previousOwnerId = _uiState.value.session?.userId
                if (ownerChanged(previousOwnerId, persisted.userId)) {
                    clearOwnerScopedMessageRequestGuards()
                    clearOwnerScopedDeviceTokenState()
                    _uiState.value = _uiState.value.copy(
                        selectedJobId = null,
                        jobs = emptyList(),
                        jobSyncStates = emptyMap(),
                        availability = null,
                        availabilityError = null,
                        dispatcherMessages = emptyList(),
                        dispatcherUnreadCount = 0,
                        dispatcherMessagesError = null,
                        dispatcherMessagesHasMore = false,
                        dispatchNoteDraft = "",
                        pendingPodJobIds = emptySet(),
                        blockedPodJobIds = emptySet(),
                        marketplaceSelectedJobId = null,
                        marketplaceJobs = emptyList(),
                        savedMarketplaceLoadIds = emptySet(),
                        hiddenMarketplaceLoadIds = emptySet(),
                        // Clear any pending deep link from the previous owner and advance the
                        // epoch so a re-delivered command from the previous epoch is rejected.
                        pendingDeepLink = null,
                        authEpoch = _uiState.value.authEpoch + 1,
                    )
                }

                _uiState.value = _uiState.value.copy(
                    isAuthenticated = true,
                    session = persisted,
                    error = "",
                )
                syncRegisteredDeviceTokenIfNeeded(persisted)
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
            val session = _uiState.value.session
            // Only attempt to unregister a token that was successfully registered server-side.
            // pendingTokenRegistrationStore tokens have not reached the server and require no revocation.
            val token = registeredDeviceTokenValue
            val installationId = registeredDeviceTokenInstallationId
            val generation = registeredDeviceTokenGeneration
            val unregisterSucceeded = if (
                session != null &&
                !token.isNullOrBlank() &&
                !installationId.isNullOrBlank() &&
                generation > 0L
            ) {
                withTimeoutOrNull(8_000L) {
                    unregisterDeviceTokenWithSingleRefreshRetry(
                        session = session,
                        token = token,
                        installationId = installationId,
                        generation = generation,
                    )
                } ?: false
            } else {
                true
            }
            if (
                !unregisterSucceeded &&
                session != null &&
                !token.isNullOrBlank() &&
                !installationId.isNullOrBlank() &&
                generation > 0L
            ) {
                // Append rather than overwrite: a previous failed logout for a different
                // owner/token must not be discarded.
                pendingUnregisterStore.add(
                    ownerId = session.userId,
                    token = token,
                    installationId = installationId,
                    generation = generation,
                )
            }
            clearOwnerScopedMessageRequestGuards()
            clearOwnerScopedDeviceTokenState()
            sessionStore.clear()
        }
    }

    private fun clearOwnerScopedMessageRequestGuards() {
        loadMoreInFlight.reset()
        readMutationInFlight.reset()
        dispatchNoteInFlight.reset()
    }

    private fun clearOwnerScopedDeviceTokenState() {
        deviceTokenInFlight.reset()
        registeredDeviceTokenOwnerId = null
        registeredDeviceTokenValue = null
        registeredDeviceTokenGeneration = -1L
        registeredDeviceTokenInstallationId = null
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

    /**
     * Routes an incoming push-notification job deep link to the correct destination.
     *
     * Only navigates to the job detail view when:
     * 1. There is an authenticated session (driver is logged in), and
     * 2. The job exists in the current loaded state and is active (not terminal).
     *
     * In all other cases (no session, job not found, job in a terminal state, or jobs
     * not yet loaded after a cold start) the driver is routed to the Messages tab instead,
     * preventing stale, unassigned or marketplace job IDs from being opened.
     */
    fun selectJobIfAssigned(jobId: String) {
        val currentState = _uiState.value
        if (currentState.session == null) {
            changeTab(DriverTab.MESSAGES)
            return
        }
        val job = currentState.jobs.firstOrNull { it.id == jobId && it.isActive() }
        if (job == null) {
            changeTab(DriverTab.MESSAGES)
            return
        }
        selectJob(jobId)
        changeTab(DriverTab.ACTION)
    }

    /**
     * Route a parsed [DeepLinkDestination] to the correct in-app destination.
     *
     * [commandId] is a stable identifier for this delivery event (derived from the deep-link URI
     * or FCM message ID). If [commandId] is already in [DriverUiState.consumedCommandIds] the
     * call is a no-op — this prevents duplicate routing when the Activity is recreated and
     * [onCreate] re-delivers the same intent, or when a push notification is re-delivered.
     *
     * For [DeepLinkDestination.Job] destinations: if the session or jobs list is not yet
     * available (cold start), the destination is stored as [DriverUiState.pendingDeepLink] and
     * the driver is routed to the Messages tab as a safe interim destination. The pending link
     * is consumed and re-evaluated by [processPendingDeepLinkIfReady] once data has loaded.
     *
     * All non-job destinations are routed immediately, regardless of auth state.
     */
    fun handleDeepLink(
        destination: DeepLinkDestination,
        commandId: String = UUID.randomUUID().toString(),
    ) {
        when (destination) {
            is DeepLinkDestination.Job -> {
                // Idempotency guard: don't re-execute a previously consumed command.
                if (commandId in _uiState.value.consumedCommandIds) return
                val newState = applyJobDeepLinkToState(_uiState.value, destination, commandId)
                _uiState.value = newState
                if (newState.pendingDeepLink != null) {
                    // Held pending; fall back to Messages as safe interim destination.
                    changeTab(DriverTab.MESSAGES)
                } else {
                    // Jobs loaded — consume the command immediately and route.
                    _uiState.value = _uiState.value.copy(
                        consumedCommandIds = _uiState.value.consumedCommandIds + commandId,
                    )
                    selectJobIfAssigned(destination.jobId)
                }
            }
            DeepLinkDestination.Messages -> changeTab(DriverTab.MESSAGES)
            DeepLinkDestination.Nearby -> changeTab(DriverTab.NEARBY)
            DeepLinkDestination.Documents -> changeTab(DriverTab.PROFILE)
            DeepLinkDestination.Profile -> changeTab(DriverTab.PROFILE)
        }
    }

    /**
     * Consume [DriverUiState.pendingDeepLink] if the session and jobs are now available.
     * Called after [refreshDriverData] successfully loads the jobs list.
     * The pending link is cleared before routing to prevent double-processing.
     */
    private fun processPendingDeepLinkIfReady() {
        val (newState, jobId) = resolvePendingDeepLink(_uiState.value)
        _uiState.value = newState
        jobId?.let { selectJobIfAssigned(it) }
    }


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
        // In instrumented tests with a fake SessionRepository, skip live API calls and process
        // any pending deep link immediately (jobs list stays empty; routing falls to Messages).
        if (skipDataRefreshForTesting) {
            _uiState.value = _uiState.value.copy(isLoading = false)
            processPendingDeepLinkIfReady()
            return
        }
        api.resolveDriverProfile(session)
            .onSuccess { profile ->
                flushQueuedMutations(session, profile)
                val documents = api.loadDriverDocuments(session, profile).getOrDefault(emptyList())
                val preferences = api.loadJobSearchPreferences(session, profile.driverId).getOrDefault(emptyMap())
                val bids = api.loadDriverBids(session, profile).getOrDefault(emptyList())
                val returnJourney = api.loadReturnJourney(session, profile.driverId).getOrNull()
                val invoices = api.loadDriverInvoices(session, profile.companyId).getOrDefault(emptyList())
                val nearbyDrivers = api.loadNearbyDrivers(session, profile.companyId).getOrDefault(emptyList())
                val marketplaceJobs = api.loadNearbyMarketplaceJobs(session).getOrDefault(emptyList())
                // Load dispatcher messages via the authenticated server API.
                // Never read notification_events or notifications directly via Supabase REST.
                val messagesResult = api.loadDispatcherMessages(session)
                val messagesAuthError = messagesResult.exceptionOrNull()?.takeIf { it.isSessionError() }
                if (messagesAuthError != null) {
                    if (!shouldApplyAvailabilityResponse(_uiState.value.session, session)) return@onSuccess
                    if (allowRefresh) {
                        refreshAndRetry(session)
                    } else {
                        sessionStore.clear()
                        _uiState.value = DriverUiState(authEpoch = _uiState.value.authEpoch + 1, error = "Your session expired. Please sign in again.")
                    }
                    return@onSuccess
                }
                val loadedMessages = messagesResult.getOrNull()
                val messagesLoadError: String? = if (messagesResult.isFailure) {
                    messagesResult.exceptionOrNull()?.friendlyDriverMessage("Messages could not be loaded.")
                        ?: "Messages could not be loaded."
                } else null
                val availabilityResult = api.loadAvailability(session)
                // If the availability call returned a session/auth error, route it into the
                // same guarded refresh-and-retry / expiry path used for profile and jobs errors.
                val availabilityAuthError = availabilityResult.exceptionOrNull()?.takeIf { it.isSessionError() }
                if (availabilityAuthError != null) {
                    if (!shouldApplyAvailabilityResponse(_uiState.value.session, session)) return@onSuccess
                    if (allowRefresh) {
                        refreshAndRetry(session)
                    } else {
                        // Second auth failure on the already-refreshed session: expire the session.
                        sessionStore.clear()
                        _uiState.value = DriverUiState(authEpoch = _uiState.value.authEpoch + 1, error = "Your session expired. Please sign in again.")
                    }
                    return@onSuccess
                }
                val loadedAvailability = availabilityResult.getOrNull()
                val availabilityLoadError: String? = if (availabilityResult.isFailure) {
                    availabilityResult.exceptionOrNull()?.friendlyDriverMessage("Availability could not be loaded.")
                        ?: "Availability could not be loaded."
                } else null
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
                            returnJourney = returnJourney,
                            invoices = invoices,
                            nearbyDrivers = nearbyDrivers,
                            jobSearchPreferences = preferences,
                            selectedJobId = selectedJobId,
                            jobSyncStates = jobSyncStatesForOwner(session.userId),
                            availability = loadedAvailability ?: _uiState.value.availability,
                            availabilityError = availabilityLoadError,
                            dispatcherMessages = loadedMessages?.first ?: _uiState.value.dispatcherMessages,
                            dispatcherUnreadCount = loadedMessages?.second ?: _uiState.value.dispatcherUnreadCount,
                            dispatcherMessagesError = messagesLoadError,
                            dispatcherMessagesHasMore = (loadedMessages?.first?.size ?: 0) >= 50,
                        )
                        syncRegisteredDeviceTokenIfNeeded(session)
                        // Process any deep-link that arrived before jobs were loaded (cold start).
                        processPendingDeepLinkIfReady()
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
                // Guard: if current session is no longer this owner+token, discard the
                // refreshed token. A stale A refresh must not overwrite B's session store.
                if (!shouldApplyAvailabilityResponse(_uiState.value.session, session)) return@onSuccess
                sessionStore.saveSession(refreshed)
                _uiState.value = _uiState.value.copy(session = refreshed)
                loadDriverDataWithSession(refreshed, allowRefresh = false)
            }
            .onFailure {
                // Guard: do not clear B's session if A's token refresh failed after a switch.
                if (!shouldApplyAvailabilityResponse(_uiState.value.session, session)) return@onFailure
                sessionStore.clear()
                _uiState.value = DriverUiState(authEpoch = _uiState.value.authEpoch + 1, error = "Your session expired. Please sign in again.")
            }
    }

    private suspend fun refreshSessionForOperationRetry(session: DriverSession): DriverSession? {
        val refreshResult = api.refreshSession(session)
        if (refreshResult.isSuccess) {
            if (!shouldApplyAvailabilityResponse(_uiState.value.session, session)) return null
            val refreshed = refreshResult.getOrThrow()
            sessionStore.saveSession(refreshed)
            _uiState.value = _uiState.value.copy(
                isAuthenticated = true,
                session = refreshed,
            )
            return refreshed
        }
        if (!shouldApplyAvailabilityResponse(_uiState.value.session, session)) return null
        expireSessionForRequest(session)
        return null
    }

    private suspend fun expireSessionForRequest(session: DriverSession) {
        if (!shouldApplyAvailabilityResponse(_uiState.value.session, session)) return
        sessionStore.clear()
        _uiState.value = DriverUiState(authEpoch = _uiState.value.authEpoch + 1, error = "Your session expired. Please sign in again.")
    }

    private suspend fun <T> runWithSingleRefreshRetry(
        initialSession: DriverSession,
        operation: suspend (DriverSession) -> Result<T>,
        onSuccess: (T, DriverSession) -> Unit,
        onFailure: (Throwable) -> Unit,
    ) {
        runWithSingleRefreshRetryCoordinator(
            initialSession = initialSession,
            shouldApply = { requestSession ->
                shouldApplyAvailabilityResponse(_uiState.value.session, requestSession)
            },
            operation = operation,
            refreshSession = { requestSession -> refreshSessionForOperationRetry(requestSession) },
            expireSession = { requestSession -> expireSessionForRequest(requestSession) },
            onSuccess = onSuccess,
            onFailure = onFailure,
        )
    }

    fun setDispatchNoteDraft(draft: String) {
        _uiState.value = _uiState.value.copy(dispatchNoteDraft = draft)
    }

    fun sendQuickNote(note: String, important: Boolean) {
        val session = _uiState.value.session ?: return
        if (!dispatchNoteInFlight.acquire(session)) return
        viewModelScope.launch {
            try {
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
                // Capture the job ID at request start so the draft is only cleared if the user
                // has not switched to a different job before the server responds.
                val requestJobId = selectedJob.id
                val requestNote = note.trim()

                _uiState.value = _uiState.value.copy(isLoading = true, error = "", message = "")
                runWithSingleRefreshRetry(
                    initialSession = session,
                    operation = { reqSession ->
                        api.sendQuickNote(reqSession.accessToken, requestJobId, requestNote, important)
                    },
                    onSuccess = { _, _ ->
                        val clearDraft = shouldClearDispatchDraft(requestJobId, _uiState.value.selectedJobId)
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            message = "Dispatch note sent.",
                            dispatchNoteDraft = if (clearDraft) "" else _uiState.value.dispatchNoteDraft,
                        )
                    },
                    onFailure = { error ->
                        _uiState.value = _uiState.value.copy(
                            isLoading = false,
                            error = error.friendlyDriverMessage("Failed to send note."),
                            // dispatchNoteDraft preserved on failure so the user can retry
                        )
                    },
                )
            } finally {
                dispatchNoteInFlight.release(session)
            }
        }
    }

    /**
     * Mark a single dispatcher message as read via the authenticated mobile messages API.
     * UI state is updated only after server confirmation; stale owner responses are rejected.
     * The unread count is taken from the server response, not blindly decremented locally,
     * so repeated taps or concurrent duplicate calls remain correct.
     *
     * Uses one owner/session-scoped read-mutation guard shared with mark-all so mark mutations
     * execute in deterministic order and cannot race each other.
     */
    fun markDispatcherMessageRead(messageId: String) {
        val session = _uiState.value.session ?: return
        if (!readMutationInFlight.acquire(session)) return
        viewModelScope.launch {
            try {
                runWithSingleRefreshRetry(
                    initialSession = session,
                    operation = { reqSession -> api.markDispatcherMessageRead(reqSession, messageId) },
                    onSuccess = { serverUnreadCount, _ ->
                        _uiState.value = _uiState.value.copy(
                            dispatcherMessages = applyMarkOneRead(_uiState.value.dispatcherMessages, messageId),
                            dispatcherUnreadCount = serverUnreadCount,
                            dispatcherMessagesError = null,
                        )
                    },
                    onFailure = { error ->
                        _uiState.value = _uiState.value.copy(
                            error = error.friendlyDriverMessage("Failed to mark message read."),
                        )
                    },
                )
            } finally {
                readMutationInFlight.release(session)
            }
        }
    }

    /**
     * Mark all dispatcher messages as read via the authenticated mobile messages API.
     * UI state is updated only after server confirmation; stale owner responses are rejected.
     * The unread count is taken from the server response (always 0 after mark-all).
     *
     * Uses one owner/session-scoped read-mutation guard shared with mark-one so mark mutations
     * execute in deterministic order and cannot race each other.
     */
    fun markAllDispatcherMessagesRead() {
        val session = _uiState.value.session ?: return
        if (!readMutationInFlight.acquire(session)) return
        viewModelScope.launch {
            try {
                runWithSingleRefreshRetry(
                    initialSession = session,
                    operation = { reqSession -> api.markAllDispatcherMessagesRead(reqSession) },
                    onSuccess = { serverUnreadCount, _ ->
                        _uiState.value = _uiState.value.copy(
                            dispatcherMessages = applyMarkAllRead(_uiState.value.dispatcherMessages),
                            dispatcherUnreadCount = serverUnreadCount,
                            dispatcherMessagesError = null,
                        )
                    },
                    onFailure = { error ->
                        _uiState.value = _uiState.value.copy(
                            error = error.friendlyDriverMessage("Failed to mark all messages read."),
                        )
                    },
                )
            } finally {
                readMutationInFlight.release(session)
            }
        }
    }

    /**
     * Loads the next page of dispatcher messages using the two-field (created_at, id) cursor.
     * Appends results to the existing list, deduplicating by message ID so re-delivered
     * messages or overlapping pages cannot introduce duplicate rows.
     *
     * Uses an owner/session-scoped guard acquired before launching the coroutine so two rapid
     * taps cannot race past the guard and start duplicate in-flight page requests.
     */
    fun loadMoreDispatcherMessages() {
        val session = _uiState.value.session ?: return
        if (!_uiState.value.dispatcherMessagesHasMore) return
        val lastMsg = _uiState.value.dispatcherMessages.lastOrNull() ?: return
        val requestBefore = lastMsg.createdAt
        val requestBeforeId = lastMsg.id
        if (!loadMoreInFlight.acquire(session)) return
        viewModelScope.launch {
            try {
                runWithSingleRefreshRetry(
                    initialSession = session,
                    operation = { reqSession ->
                        api.loadDispatcherMessages(
                            reqSession,
                            before = requestBefore,
                            beforeId = requestBeforeId,
                            limit = 50,
                        )
                    },
                    onSuccess = { payload, _ ->
                        val (newMessages, _) = payload
                        val existing = _uiState.value.dispatcherMessages
                        _uiState.value = _uiState.value.copy(
                            dispatcherMessages = mergeDispatcherMessages(existing, newMessages),
                            dispatcherMessagesHasMore = newMessages.size >= 50,
                            dispatcherMessagesError = null,
                        )
                    },
                    onFailure = { error ->
                        _uiState.value = _uiState.value.copy(
                            dispatcherMessagesError = error.friendlyDriverMessage("Failed to load more messages."),
                        )
                    },
                )
            } finally {
                loadMoreInFlight.release(session)
            }
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
     *
     * Routes through [DeviceTokenCoordinator] (the same coordinator used by
     * [DriverFirebaseMessagingService.onNewToken]) so there is exactly one pending-token
     * store and one generation sequence regardless of which path discovers the token first.
     */
    fun registerDeviceToken(token: String) {
        val trimmed = token.trim()
        if (trimmed.isBlank()) return
        deviceTokenCoordinator.writePendingToken(trimmed)
        viewModelScope.launch {
            val session = _uiState.value.session ?: return@launch
            syncRegisteredDeviceTokenIfNeeded(session)
        }
    }

    private suspend fun syncRegisteredDeviceTokenIfNeeded(session: DriverSession) {
        flushPendingDeviceTokenUnregisterIfNeeded(session)
        // Read the pending token record from the coordinator. This absorbs tokens written by
        // both registerDeviceToken() and DriverFirebaseMessagingService.onNewToken() so that
        // all registration paths share the same owner/session/generation validation path.
        val pending = deviceTokenCoordinator.readPending() ?: return
        val token = pending.token
        val capturedGeneration = pending.generation
        val capturedInstallationId = pending.installationId
        if (token.isBlank()) return
        // Skip if already registered for this owner, token and generation.
        if (registeredDeviceTokenOwnerId == session.userId &&
            registeredDeviceTokenValue == token &&
            registeredDeviceTokenGeneration == capturedGeneration &&
            registeredDeviceTokenInstallationId == capturedInstallationId
        ) return
        if (!deviceTokenInFlight.acquire(session)) return
        try {
            runWithSingleRefreshRetry(
                initialSession = session,
                operation = { reqSession ->
                    api.registerDeviceToken(
                        session = reqSession,
                        token = token,
                        installationId = capturedInstallationId,
                        generation = capturedGeneration,
                        platform = "android",
                        appPackage = "co.uk.xdrivelogistics.driver",
                    )
                },
                onSuccess = { _, acceptedSession ->
                    // Validate generation before committing: if onNewToken() fired a newer
                    // token during the in-flight request the generation will have advanced,
                    // so we must not overwrite the newer pending record or commit stale state.
                    val currentPending = deviceTokenCoordinator.readPending()
                    if (currentPending?.generation == capturedGeneration &&
                        shouldApplyAvailabilityResponse(_uiState.value.session, acceptedSession)
                    ) {
                        registeredDeviceTokenOwnerId = acceptedSession.userId
                        registeredDeviceTokenValue = token
                        registeredDeviceTokenGeneration = capturedGeneration
                        registeredDeviceTokenInstallationId = capturedInstallationId
                        deviceTokenCoordinator.clearPendingIfGeneration(capturedGeneration)
                    }
                },
                onFailure = {
                    // Keep pending record for the next authenticated refresh/sync attempt.
                },
            )
        } finally {
            deviceTokenInFlight.release(session)
        }
    }

    private suspend fun flushPendingDeviceTokenUnregisterIfNeeded(session: DriverSession) {
        pendingUnregisterStore.pruneExpired()
        val pendingEntries = pendingUnregisterStore.readAllForOwner(session.userId)
        for (entry in pendingEntries) {
            if (!deviceTokenInFlight.acquire(session)) break
            try {
                if (
                    unregisterDeviceTokenWithSingleRefreshRetry(
                        session = session,
                        token = entry.token,
                        installationId = entry.installationId,
                        generation = entry.generation,
                    )
                ) {
                    pendingUnregisterStore.remove(
                        ownerId = entry.ownerId,
                        token = entry.token,
                        installationId = entry.installationId,
                        generation = entry.generation,
                    )
                    if (registeredDeviceTokenOwnerId == session.userId &&
                        registeredDeviceTokenValue == entry.token &&
                        registeredDeviceTokenGeneration == entry.generation &&
                        registeredDeviceTokenInstallationId == entry.installationId
                    ) {
                        registeredDeviceTokenOwnerId = null
                        registeredDeviceTokenValue = null
                        registeredDeviceTokenGeneration = -1L
                        registeredDeviceTokenInstallationId = null
                    }
                } else {
                    pendingUnregisterStore.incrementAttemptCount(
                        ownerId = entry.ownerId,
                        token = entry.token,
                        installationId = entry.installationId,
                        generation = entry.generation,
                    )
                }
            } finally {
                deviceTokenInFlight.release(session)
            }
        }
    }

    private suspend fun unregisterDeviceTokenWithSingleRefreshRetry(
        session: DriverSession,
        token: String,
        installationId: String,
        generation: Long,
    ): Boolean {
        var success = false
        runWithSingleRefreshRetry(
            initialSession = session,
            operation = { requestSession ->
                api.unregisterDeviceToken(
                    session = requestSession,
                    token = token,
                    installationId = installationId,
                    generation = generation,
                )
            },
            onSuccess = { _, acceptedSession ->
                if (!shouldApplyAvailabilityResponse(_uiState.value.session, acceptedSession)) return@runWithSingleRefreshRetry
                success = true
            },
            onFailure = {
                success = false
            },
        )
        return success
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
                       // Targeted merge: only update status from the server response.
                       // This prevents an older status snapshot from reverting a newer
                       // concurrent slot mutation that completed while this request was in flight.
                       _uiState.value = _uiState.value.copy(
                           availability = applyAvailabilityStatusResult(_uiState.value.availability, updated),
                           availabilityError = null,
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
                       // Targeted merge: only update the specific slot confirmed by the server.
                       // This prevents an older AM snapshot from reverting a newer PM result
                       // when both mutations were in flight concurrently.
                       _uiState.value = _uiState.value.copy(
                           availability = applyAvailabilitySlotResult(
                               current = _uiState.value.availability,
                               serverResponse = updated,
                               dayOfWeek = dayOfWeek,
                               slot = slot,
                           ),
                           availabilityError = null,
                       )
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

/**
 * Targeted merge: applies only the status from [serverResponse], preserving [current] slots.
 * An older status response cannot revert a newer concurrent slot mutation that completed while
 * this request was in flight, because the slot list is taken from the current confirmed state.
 */
internal fun applyAvailabilityStatusResult(
    current: DriverAvailability?,
    serverResponse: DriverAvailability,
): DriverAvailability = DriverAvailability(
    status = serverResponse.status,
    slots = current?.slots ?: serverResponse.slots,
)

/**
 * Targeted merge: applies only the server-confirmed value for [dayOfWeek]/[slot] from
 * [serverResponse], preserving the current status and all other slot values from [current].
 * An older AM response cannot revert a newer PM result that completed while this request was
 * in flight, because only the specific slot key is updated.
 */
internal fun applyAvailabilitySlotResult(
    current: DriverAvailability?,
    serverResponse: DriverAvailability,
    dayOfWeek: Int,
    slot: String,
): DriverAvailability {
    val normalizedSlot = slot.trim().uppercase(Locale.ROOT)
    val serverSlot = serverResponse.slots.firstOrNull {
        it.dayOfWeek == dayOfWeek && it.slot.equals(normalizedSlot, ignoreCase = true)
    }
    val baseSlots = current?.slots ?: serverResponse.slots
    val mergedSlots = if (serverSlot != null) {
        baseSlots.map { s ->
            if (s.dayOfWeek == dayOfWeek && s.slot.equals(normalizedSlot, ignoreCase = true)) serverSlot else s
        }
    } else {
        baseSlots
    }
    return DriverAvailability(
        status = current?.status ?: serverResponse.status,
        slots = mergedSlots,
    )
}

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

internal fun Throwable.isSessionError(): Boolean {
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

// ── Dispatcher message state reducers ────────────────────────────────────────

/**
 * Marks a single dispatcher message as read (copy with read=true, status="read").
 * Returns a new list; other messages are unchanged.
 */
internal fun applyMarkOneRead(messages: List<DispatcherMessage>, messageId: String): List<DispatcherMessage> =
    messages.map { if (it.id == messageId) it.copy(read = true, status = "read") else it }

/**
 * Marks all dispatcher messages as read.
 */
internal fun applyMarkAllRead(messages: List<DispatcherMessage>): List<DispatcherMessage> =
    messages.map { it.copy(read = true, status = "read") }

/**
 * Appends [newMessages] to [existing], deduplicating by message ID so re-delivered
 * messages or overlapping pages cannot introduce duplicate rows.
 * The relative ordering within each list is preserved.
 */
internal fun mergeDispatcherMessages(
    existing: List<DispatcherMessage>,
    newMessages: List<DispatcherMessage>,
): List<DispatcherMessage> {
    val existingIds = existing.mapTo(HashSet()) { it.id }
    return existing + newMessages.filter { it.id !in existingIds }
}

// ── Dispatcher request coordination helpers ──────────────────────────────────

private data class SessionScope(val ownerId: String, val accessToken: String)

private fun DriverSession.scope(): SessionScope = SessionScope(ownerId = userId, accessToken = accessToken)

/**
 * Owner/session-scoped in-flight guard used by dispatcher-message operations.
 *
 * - `acquire` succeeds only when no request is active.
 * - `release` only clears the lock when called by the same owner+token scope.
 * - `reset` force-clears all state (used on logout / direct owner switch A→B).
 */
internal class OwnerSessionInFlightGuard {
    private var activeScope: SessionScope? = null

    @Synchronized
    fun acquire(session: DriverSession): Boolean {
        if (activeScope != null) return false
        activeScope = session.scope()
        return true
    }

    @Synchronized
    fun release(session: DriverSession) {
        if (activeScope == session.scope()) {
            activeScope = null
        }
    }

    @Synchronized
    fun reset() {
        activeScope = null
    }

    @Synchronized
    fun isActive(): Boolean = activeScope != null
}

/**
 * Shared production refresh-once coordinator used by operation-level auth retry flows.
 */
internal suspend fun <T> runWithSingleRefreshRetryCoordinator(
    initialSession: DriverSession,
    shouldApply: (DriverSession) -> Boolean,
    operation: suspend (DriverSession) -> Result<T>,
    refreshSession: suspend (DriverSession) -> DriverSession?,
    expireSession: suspend (DriverSession) -> Unit,
    onSuccess: (T, DriverSession) -> Unit,
    onFailure: (Throwable) -> Unit,
) {
    var requestSession = initialSession
    var didRefresh = false
    while (true) {
        if (!shouldApply(requestSession)) return
        val result = operation(requestSession)
        if (result.isSuccess) {
            if (!shouldApply(requestSession)) return
            onSuccess(result.getOrThrow(), requestSession)
            return
        }

        val error = result.exceptionOrNull() ?: IllegalStateException("Operation failed.")
        if (!shouldApply(requestSession)) return
        if (error.isSessionError()) {
            if (!didRefresh) {
                val refreshed = refreshSession(requestSession) ?: return
                requestSession = refreshed
                didRefresh = true
                continue
            }
            expireSession(requestSession)
            return
        }
        onFailure(error)
        return
    }
}

// ── Dispatch-note job identity guard ─────────────────────────────────────────

/**
 * Returns true only when [currentSelectedJobId] matches [requestJobId] (i.e. the
 * user has not switched to a different job or deselected the job between request
 * start and server response arrival). The draft should only be cleared when true.
 */
internal fun shouldClearDispatchDraft(requestJobId: String, currentSelectedJobId: String?): Boolean =
    requestJobId == currentSelectedJobId

/**
 * Compute the next [DriverUiState] after a [DeepLinkDestination.Job] deep-link is handled.
 *
 * If the session is not yet authenticated or the jobs list has not yet loaded (cold start),
 * the destination is stored in [DriverUiState.pendingDeepLink] as a [PendingDeepLinkCommand]
 * that captures the current [DriverUiState.authEpoch] and the provided [commandId]. Otherwise
 * the state is returned unchanged and the caller should proceed to route immediately via
 * [selectJobIfAssigned].
 *
 * [commandId] is the stable delivery identity for this event. It is stored in the command so
 * that [resolvePendingDeepLink] can record it in [DriverUiState.consumedCommandIds] when the
 * command is consumed, enabling one-shot deduplication across Activity recreation.
 *
 * Extracted from [DriverViewModel.handleDeepLink] for unit-testability.
 */
internal fun applyJobDeepLinkToState(
    state: DriverUiState,
    destination: DeepLinkDestination.Job,
    commandId: String,
): DriverUiState = if (!state.isAuthenticated || state.jobs.isEmpty()) {
    state.copy(pendingDeepLink = PendingDeepLinkCommand(destination, state.authEpoch, commandId))
} else {
    state
}

/**
 * Consume [DriverUiState.pendingDeepLink] when routing preconditions are met.
 *
 * Returns the updated state (pending link cleared) and the job ID to route to, or
 * `null` as the second element if no routing should occur. The pending link is cleared
 * before routing to prevent double-processing if routing itself fails.
 *
 * **Auth-epoch guard**: if the command's [PendingDeepLinkCommand.authEpoch] does not match
 * [DriverUiState.authEpoch], the command was captured under a different owner's session and
 * is discarded (stale command rejected). This prevents an owner-A command from executing
 * under owner B's session after logout or a direct owner replacement.
 *
 * **One-shot deduplication**: when a command is consumed, its [PendingDeepLinkCommand.commandId]
 * is added to [DriverUiState.consumedCommandIds]. [DriverViewModel.handleDeepLink] checks this
 * set before processing any new delivery, so re-delivery of the same event (e.g. after
 * Activity recreation) is a no-op.
 *
 * Extracted from [DriverViewModel.processPendingDeepLinkIfReady] for unit-testability.
 */
internal fun resolvePendingDeepLink(state: DriverUiState): Pair<DriverUiState, String?> {
    val pending = state.pendingDeepLink ?: return state to null
    // Epoch guard: reject commands captured under a different auth session.
    if (pending.authEpoch != state.authEpoch) {
        return state.copy(pendingDeepLink = null) to null
    }
    if (!state.isAuthenticated || state.session == null) return state to null
    return state.copy(
        pendingDeepLink = null,
        consumedCommandIds = state.consumedCommandIds + pending.commandId,
    ) to pending.destination.jobId
}

/**
 * [ViewModelProvider.Factory] for [DriverViewModel] that accepts an injectable [SessionRepository].
 *
 * Production usage (in [MainActivity]):
 * ```kotlin
 * private val viewModel: DriverViewModel by viewModels { DriverViewModelFactory(application) }
 * ```
 *
 * Instrumented-test usage (inject a [co.uk.xdrivelogistics.driver.FakeSessionRepository]):
 * ```kotlin
 * MainActivity.testViewModelFactory = DriverViewModelFactory(appContext, fakeRepo, skipDataRefresh = true)
 * ```
 *
 * @param sessionRepository Defaults to the production [SessionStore] backed by
 *   [androidx.security.crypto.EncryptedSharedPreferences].
 * @param skipDataRefreshForTesting Passed to [DriverViewModel.skipDataRefreshForTesting]; must
 *   be false in production. Set true in instrumented tests to skip live API calls.
 */
class DriverViewModelFactory(
    private val application: Application,
    private val sessionRepository: SessionRepository = SessionStore(application.applicationContext),
    private val skipDataRefreshForTesting: Boolean = false,
) : ViewModelProvider.AndroidViewModelFactory(application) {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(DriverViewModel::class.java)) {
            return DriverViewModel(application, sessionRepository, skipDataRefreshForTesting) as T
        }
        return super.create(modelClass)
    }
}
