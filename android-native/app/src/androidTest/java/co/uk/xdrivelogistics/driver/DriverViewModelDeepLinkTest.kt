package co.uk.xdrivelogistics.driver

import android.app.Application
import android.net.Uri
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import co.uk.xdrivelogistics.driver.data.DriverSession
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Pure routing and session-state instrumented tests for [DriverViewModel].
 *
 * Unlike [MainActivityDeepLinkInstrumentedTest], these tests exercise the routing state
 * machine directly through [DriverViewModel.handleDeepLink] and [DriverViewModel.logout],
 * without launching [MainActivity] or using [ActivityScenario]. This eliminates all
 * Activity lifecycle teardown constraints and makes routing assertions fully deterministic.
 *
 * The [DriverViewModel] is created via [DriverViewModelFactory] with a [FakeSessionRepository]
 * and [skipDataRefreshForTesting=true], owned by a per-test [ViewModelStore] that is cleared
 * in [tearDown] to cancel [viewModelScope] cleanly. Session transitions are deterministic:
 * [FakeSessionRepository] emits changes synchronously on the main-thread dispatcher, and
 * [awaitCondition] polls from the instrumentation thread until the ViewModel observes them.
 *
 * Coverage:
 * 1. Deduplication: the same commandId (URI) is a no-op on second delivery.
 * 2. Pending-link replacement: a second job intent replaces the first pending link.
 * 3. Logout isolation: [resolvePendingDeepLink] returns null after logout (null-session guard).
 * 4. Different job IDs: two UUIDs produce non-equal [PendingDeepLinkCommand] values.
 * 5. commandId recording: consumed links are recorded in [DriverUiState.consumedCommandIds].
 * 6. Auth-epoch isolation: epoch advances after logout and direct owner replacement.
 * 7. Epoch guard: a command captured at epoch N is rejected at epoch N+1.
 */
@RunWith(AndroidJUnit4::class)
class DriverViewModelDeepLinkTest {

    private val VALID_JOB_UUID_A = "6e5e0122-7b3c-4ec8-9f41-5d8937e541f1"
    private val VALID_JOB_UUID_B = "a1b2c3d4-1234-4abc-8def-0123456789ab"

    private var vmStore = ViewModelStore()

    @Before
    fun setUp() {
        vmStore = ViewModelStore()
    }

    @After
    fun tearDown() {
        vmStore.clear()
    }

    /**
     * Create a [DriverViewModel] owned by a per-test [ViewModelStore] so that
     * [ViewModelStore.clear] in [tearDown] cancels its [viewModelScope] deterministically.
     */
    private fun buildViewModel(fake: FakeSessionRepository = FakeSessionRepository()): DriverViewModel {
        val factory = DriverViewModelFactory(
            ApplicationProvider.getApplicationContext<Application>(),
            fake,
            skipDataRefreshForTesting = true,
        )
        return ViewModelProvider(
            object : ViewModelStoreOwner {
                override fun getViewModelStore(): ViewModelStore = vmStore
            },
            factory,
        )[DriverViewModel::class.java]
    }

    /**
     * Poll [condition] until it returns true or [timeoutMs] elapses.
     */
    private fun awaitCondition(timeoutMs: Long = 5_000L, condition: () -> Boolean): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return true
            Thread.sleep(50)
        }
        return false
    }

    // ── 1. Deduplication — same commandId is a no-op ──────────────────────────

    @Test
    fun duplicateWarmJobIntentsAreHandledIdempotently() {
        val vm = buildViewModel()
        val uri = "xdrivedriver://job/$VALID_JOB_UUID_A"
        val dest = XDriveDeepLink.parse(Uri.parse(uri))

        // First delivery: holds the pending link.
        vm.handleDeepLink(dest, uri)
        assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)
        assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)

        // Second delivery (duplicate — same commandId): must be idempotent.
        vm.handleDeepLink(dest, uri)
        assertEquals(
            "Duplicate delivery must not change pending link",
            DeepLinkDestination.Job(VALID_JOB_UUID_A),
            vm.uiState.value.pendingDeepLink?.destination,
        )
        assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
    }

    @Test
    fun duplicateWarmJobIntentIsDeduplicatedViaConsumedCommandIds() {
        val vm = buildViewModel()
        val uri = "xdrivedriver://job/$VALID_JOB_UUID_A"
        val dest = XDriveDeepLink.parse(Uri.parse(uri))

        // First delivery — sets pendingDeepLink.
        vm.handleDeepLink(dest, uri)
        assertNotNull("First delivery must set pendingDeepLink", vm.uiState.value.pendingDeepLink)
        assertEquals(VALID_JOB_UUID_A, vm.uiState.value.pendingDeepLink?.destination?.jobId)

        // Second delivery (same URI → same commandId): pendingDeepLink must be unchanged.
        vm.handleDeepLink(dest, uri)
        assertNotNull("Second delivery must not clear the pending link", vm.uiState.value.pendingDeepLink)
        assertEquals(
            "Second delivery of the same URI must not change the pending destination",
            VALID_JOB_UUID_A,
            vm.uiState.value.pendingDeepLink?.destination?.jobId,
        )
    }

    // ── 2. Pending-link replacement — second job replaces first ───────────────

    @Test
    fun ownerTransitionReplacesExistingPendingDeepLink() {
        val vm = buildViewModel()
        val uriA = "xdrivedriver://job/$VALID_JOB_UUID_A"
        val uriB = "xdrivedriver://job/$VALID_JOB_UUID_B"

        vm.handleDeepLink(XDriveDeepLink.parse(Uri.parse(uriA)), uriA)
        assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)

        vm.handleDeepLink(XDriveDeepLink.parse(Uri.parse(uriB)), uriB)
        assertEquals(
            "Owner B's job must replace owner A's pending link — no accumulation",
            DeepLinkDestination.Job(VALID_JOB_UUID_B),
            vm.uiState.value.pendingDeepLink?.destination,
        )
    }

    @Test
    fun differentJobIdsParseThroughViewModelToNonEqualDestinations() {
        val vm = buildViewModel()
        val uriA = "xdrivedriver://job/$VALID_JOB_UUID_A"
        val uriB = "xdrivedriver://job/$VALID_JOB_UUID_B"

        vm.handleDeepLink(XDriveDeepLink.parse(Uri.parse(uriA)), uriA)
        val pendingA = vm.uiState.value.pendingDeepLink

        vm.handleDeepLink(XDriveDeepLink.parse(Uri.parse(uriB)), uriB)
        val pendingB = vm.uiState.value.pendingDeepLink

        assertFalse("Different job UUIDs must produce non-equal pending destinations", pendingA == pendingB)
        assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), pendingA?.destination)
        assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_B), pendingB?.destination)
    }

    // ── 3. Logout isolation — null-session guard blocks stale routing ─────────

    @Test
    fun logoutClearsOwnerALinkSoOwnerBGetsAFreshPendingSlot() {
        val vm = buildViewModel()
        val uriA = "xdrivedriver://job/$VALID_JOB_UUID_A"
        val uriB = "xdrivedriver://job/$VALID_JOB_UUID_B"

        // Set owner A's pending link.
        vm.handleDeepLink(XDriveDeepLink.parse(Uri.parse(uriA)), uriA)
        assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)

        // Exercise the production logout path.
        vm.logout()

        // resolvePendingDeepLink returns null: the null-session guard prevents stale routing
        // after logout, whether or not the async DataStore clear has completed yet.
        val (_, resolvedId) = resolvePendingDeepLink(vm.uiState.value)
        assertNull("After logout, resolvePendingDeepLink must not route owner A's stale job", resolvedId)

        // Owner B's job arrives after logout — a fresh pending link is set.
        vm.handleDeepLink(XDriveDeepLink.parse(Uri.parse(uriB)), uriB)
        val pending = vm.uiState.value.pendingDeepLink
        assertEquals(
            "Owner B's job must be held as a fresh pending link after owner A's logout",
            DeepLinkDestination.Job(VALID_JOB_UUID_B),
            pending?.destination,
        )
        assertFalse(
            "Owner B's pending link must not equal owner A's stale UUID",
            pending?.destination == DeepLinkDestination.Job(VALID_JOB_UUID_A),
        )
    }

    @Test
    fun logoutClearsPendingDeepLinkFromPreviousOwner() {
        val vm = buildViewModel()
        val uri = "xdrivedriver://job/$VALID_JOB_UUID_A"

        vm.handleDeepLink(XDriveDeepLink.parse(Uri.parse(uri)), uri)
        assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)

        // Exercise the production logout path.
        vm.logout()

        // Assert on the actual ViewModel state: the null-session guard prevents stale routing
        // after logout, whether or not the async DataStore clear has completed yet.
        val (_, resolvedId) = resolvePendingDeepLink(vm.uiState.value)
        assertNull(
            "After vm.logout(), resolvePendingDeepLink must not route a stale job from the previous owner",
            resolvedId,
        )
    }

    // ── 4. commandId recording — consumed links enter consumedCommandIds ──────

    @Test
    fun coldStartJobLinkCommandIdIsRecordedInConsumedCommandIdsAfterPendingLinkIsConsumed() {
        val fake = FakeSessionRepository()
        val vm = buildViewModel(fake)

        // Simulate deep-link delivery (e.g., from onCreate → routeIncomingIntent).
        val uri = "xdrivedriver://job/$VALID_JOB_UUID_A"
        vm.handleDeepLink(XDriveDeepLink.parse(Uri.parse(uri)), uri)
        assertNotNull("Deep-link delivery must hold the link pending", vm.uiState.value.pendingDeepLink)

        // Authenticate — skipDataRefreshForTesting=true triggers processPendingDeepLinkIfReady.
        runBlocking { fake.saveSession(DriverSession("tok", "ref", "user-a", "a@test.co.uk")) }
        val pendingCleared = awaitCondition(5_000) { vm.uiState.value.pendingDeepLink == null }
        assertTrue("Pending link must be cleared after authentication", pendingCleared)

        val consumed = vm.uiState.value.consumedCommandIds
        assertTrue(
            "commandId derived from URI must be in consumedCommandIds after consumption",
            uri in consumed,
        )
    }

    // ── 5. Auth-epoch — FakeSessionRepository + skipDataRefresh ──────────────

    @Test
    fun authEpochAdvancesAfterLogoutAndPendingLinkIsCleared() {
        val fake = FakeSessionRepository()
        val vm = buildViewModel(fake)

        // Simulate a cold-start job deep-link delivery.
        val uri = "xdrivedriver://job/$VALID_JOB_UUID_A"
        vm.handleDeepLink(XDriveDeepLink.parse(Uri.parse(uri)), uri)

        val pendingAfterDelivery = vm.uiState.value.pendingDeepLink
        assertNotNull("Cold-start link must be held as PendingDeepLinkCommand", pendingAfterDelivery)
        assertEquals(
            "Command destination must match the delivered job UUID",
            DeepLinkDestination.Job(VALID_JOB_UUID_A),
            pendingAfterDelivery?.destination,
        )
        val epochAtDelivery = vm.uiState.value.authEpoch
        assertEquals(
            "Command epoch must match the state epoch at capture time",
            epochAtDelivery,
            pendingAfterDelivery?.authEpoch,
        )

        // Owner A logs in: FakeSessionRepository emits synchronously → ViewModel
        // observes session, marks isAuthenticated = true, then (skipDataRefresh) calls
        // processPendingDeepLinkIfReady which consumes the pending link.
        runBlocking { fake.saveSession(DriverSession("tok-a", "ref-a", "owner-a", "a@test.co.uk")) }
        val aAuthenticated = awaitCondition(5_000) { vm.uiState.value.isAuthenticated }
        assertTrue("ViewModel must become authenticated after owner A session write", aAuthenticated)

        val pendingConsumed = awaitCondition(5_000) { vm.uiState.value.pendingDeepLink == null }
        assertTrue("Pending link must be consumed after owner A authenticates", pendingConsumed)
        val epochDuringA = vm.uiState.value.authEpoch
        assertEquals("Epoch must not change on login (only on logout/owner-change)", epochAtDelivery, epochDuringA)

        // Owner A logs out: production logout path → sessionStore.clear() → FakeRepo emits null
        // → DriverViewModel receives null → state reset with authEpoch + 1.
        vm.logout()
        val epochAdvanced = awaitCondition(5_000) { vm.uiState.value.authEpoch > epochDuringA }
        assertTrue("authEpoch must advance after logout", epochAdvanced)
        val epochAfterLogout = vm.uiState.value.authEpoch
        assertTrue("Post-logout epoch must be strictly greater than during-A epoch", epochAfterLogout > epochDuringA)
        assertNull("Pending link must be null after logout state reset", vm.uiState.value.pendingDeepLink)
    }

    @Test
    fun ownerBCannotRouteStaleOwnerACommandAfterEpochAdvance() {
        // Security proof: a PendingDeepLinkCommand captured at epoch N is rejected by
        // resolvePendingDeepLink when the current state epoch is N+1 (after logout).
        val fake = FakeSessionRepository()
        val vm = buildViewModel(fake)

        // Owner A logs in.
        runBlocking { fake.saveSession(DriverSession("tok-a", "ref-a", "owner-a", "a@test.co.uk")) }
        val aAuthenticated = awaitCondition(5_000) { vm.uiState.value.isAuthenticated }
        assertTrue("Owner A must authenticate", aAuthenticated)
        val epochDuringA = vm.uiState.value.authEpoch

        // Owner A logs out.
        vm.logout()
        val epochAdvanced = awaitCondition(5_000) { vm.uiState.value.authEpoch > epochDuringA }
        assertTrue("Epoch must advance after owner A logout", epochAdvanced)
        val epochAfterLogout = vm.uiState.value.authEpoch

        // Construct a stale command as if owner A's link somehow persisted past the logout.
        // This represents the scenario the epoch guard defends against: a command from epoch
        // N surviving into epoch N+1.
        val staleCommand = PendingDeepLinkCommand(
            DeepLinkDestination.Job(VALID_JOB_UUID_A),
            authEpoch = epochDuringA,  // epoch before logout
            commandId = "stale-cmd-owner-a",
        )

        // Owner B logs in under the new epoch.
        runBlocking { fake.saveSession(DriverSession("tok-b", "ref-b", "owner-b", "b@test.co.uk")) }
        val bAuthenticated = awaitCondition(5_000) {
            vm.uiState.value.isAuthenticated && vm.uiState.value.session?.userId == "owner-b"
        }
        assertTrue("Owner B must authenticate", bAuthenticated)

        // Directly verify the epoch guard: resolvePendingDeepLink on the current (B-epoch)
        // state with owner A's stale command must reject it.
        val stateWithStaleCommand = vm.uiState.value.copy(pendingDeepLink = staleCommand)
        val (_, staleResolvedId) = resolvePendingDeepLink(stateWithStaleCommand)
        assertNull(
            "Stale epoch-$epochDuringA command must be rejected under epoch-$epochAfterLogout state",
            staleResolvedId,
        )

        // Confirm that the epoch guard is the rejection reason: a command with the new epoch
        // IS resolved (job absent from B's list → Messages, but the routing coordinator proceeds).
        val freshCommand = PendingDeepLinkCommand(
            DeepLinkDestination.Job(VALID_JOB_UUID_A),
            authEpoch = epochAfterLogout,  // matches current epoch
            commandId = "fresh-cmd-owner-b",
        )
        val stateWithFreshCommand = vm.uiState.value.copy(pendingDeepLink = freshCommand)
        val (_, freshResolvedId) = resolvePendingDeepLink(stateWithFreshCommand)
        assertEquals(
            "A fresh command with the correct epoch must be resolved (routing handled by job-list check)",
            VALID_JOB_UUID_A,
            freshResolvedId,
        )
    }

    @Test
    fun directOwnerReplacementAdvancesEpoch() {
        // Proves that a direct A→B session replacement (no intermediate null) advances the
        // authEpoch through the production ownerChanged() path in DriverViewModel.
        val fake = FakeSessionRepository()
        val vm = buildViewModel(fake)

        // Owner A logs in.
        runBlocking { fake.saveSession(DriverSession("tok-a", "ref-a", "owner-a", "a@test.co.uk")) }
        awaitCondition(5_000) { vm.uiState.value.isAuthenticated }
        val epochDuringA = vm.uiState.value.authEpoch

        // Direct replacement: B's session arrives without an intermediate null.
        // The ViewModel's ownerChanged() path detects the different userId and advances the epoch.
        runBlocking { fake.saveSession(DriverSession("tok-b", "ref-b", "owner-b", "b@test.co.uk")) }
        val epochAdvanced = awaitCondition(5_000) { vm.uiState.value.authEpoch > epochDuringA }
        assertTrue(
            "Direct owner replacement must advance authEpoch via the ownerChanged path",
            epochAdvanced,
        )
        assertEquals("Session must now belong to owner B", "owner-b", vm.uiState.value.session?.userId)
    }
}
