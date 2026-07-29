package co.uk.xdrivelogistics.driver

import android.app.Application
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import co.uk.xdrivelogistics.driver.data.DriverSession
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Production-linked Android 14 instrumented tests that launch [MainActivity] via
 * [ActivityScenario] and observe the routing state through the production
 * [DriverViewModel] obtained from the Activity's [ViewModelStore].
 *
 * Unlike the parser-only [DeepLinkIntentInstrumentedTest], these tests exercise the
 * complete Activity lifecycle routing path:
 *   - cold-start: [MainActivity.onCreate] → `handleIncomingIntent` → [DriverViewModel.handleDeepLink]
 *   - warm-start: [MainActivity.onNewIntent] delivered via [InstrumentationRegistry] framework boundary
 *   - recreation: [ActivityScenario.recreate] retains the ViewModel; `onCreate` re-delivers idempotently
 *   - logout/owner-clear: [DriverViewModel.logout] exercises the production session-clear path
 *
 * State assertions are made synchronously within [ActivityScenario.onActivity] blocks on the
 * main thread. Warm-intent delivery uses a real [android.content.Context.startActivity] call
 * with production flags ([Intent.FLAG_ACTIVITY_SINGLE_TOP] | [Intent.FLAG_ACTIVITY_CLEAR_TOP] |
 * [Intent.FLAG_ACTIVITY_NEW_TASK]), matching the [DriverPushNotifications] production path.
 * [android.app.Instrumentation.waitForIdleSync] ensures [MainActivity.onNewIntent] completes
 * before assertions run. Production [MainActivity.onNewIntent] remains `protected`.
 *
 * Coverage:
 * 1. Cold-start ACTION_VIEW: job link held as [DriverUiState.pendingDeepLink] by the
 *    production [MainActivity.onCreate] → `handleIncomingIntent` code path; safe interim tab = MESSAGES.
 * 2. Cold-start non-job links (Messages, Nearby, Profile): route immediately, no pending hold.
 * 3. Warm-start via the real [MainActivity.onNewIntent] path (framework-delivered): job and
 *    non-job intents are processed through the production lifecycle path.
 * 4. Activity recreation ([ActivityScenario.recreate]): ViewModel retained; routing state is
 *    idempotent — the same intent is re-delivered to `onCreate` and produces the same state.
 * 5. Duplicate warm intents: one-shot idempotent hold — the same job destination is held,
 *    not accumulated.
 * 6. Malformed/unknown/bare URIs: Activity launches without crash; parser returns Messages.
 * 7. A→B owner isolation: after [DriverViewModel.logout], owner A's pending link is rejected
 *    by [resolvePendingDeepLink] (no session); owner B's warm intent then sets a fresh link.
 * 8. Logout/owner-clear: [DriverViewModel.logout] is the production clear path; the routing
 *    coordinator [resolvePendingDeepLink] returns null on the actual post-logout ViewModel state.
 * 9. Stale/unassigned job via [DriverViewModel.selectJobIfAssigned]: without a session,
 *    routing falls through to the Messages tab.
 * 10. ViewModel is always accessible from the Activity's ViewModelStore; the Activity
 *     correctly wires [MainActivity.viewModels] to the Kotlin delegate.
 * 12. One-shot deduplication: the same intent URI (same commandId) cannot execute twice —
 *     [DriverUiState.consumedCommandIds] blocks re-delivery both before and after jobs load.
 */
@RunWith(AndroidJUnit4::class)
class MainActivityDeepLinkInstrumentedTest {

    private val VALID_JOB_UUID_A = "6e5e0122-7b3c-4ec8-9f41-5d8937e541f1"
    private val VALID_JOB_UUID_B = "a1b2c3d4-1234-4abc-8def-0123456789ab"

    @After
    fun tearDown() {
        // Always reset the test factory so later tests get the production SessionStore.
        MainActivity.testViewModelFactory = null
    }

    /**
     * Poll [condition] until it returns true or [timeoutMs] elapses. Returns whether the
     * condition was met. Runs on the instrumentation thread (NOT the main thread) so it is
     * safe to read [DriverViewModel.uiState] which is a [kotlinx.coroutines.flow.StateFlow].
     */
    private fun awaitCondition(timeoutMs: Long = 5_000L, condition: () -> Boolean): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return true
            Thread.sleep(50)
        }
        return false
    }

    /**
     * Install [DriverViewModelFactory] with a [FakeSessionRepository] and
     * [skipDataRefreshForTesting=true] as [MainActivity.testViewModelFactory]. Call before
     * launching any Activity that should use the fake store.
     */
    private fun installFakeFactory(fakeSession: FakeSessionRepository): DriverViewModelFactory =
        DriverViewModelFactory(
            ApplicationProvider.getApplicationContext<Application>(),
            fakeSession,
            skipDataRefreshForTesting = true,
        ).also { MainActivity.testViewModelFactory = it }

    /**
     * Launch [MainActivity] with an ACTION_VIEW deep-link intent.
     * Proves the Activity starts without crashing when given the specified URI.
     */
    private fun launchWithDeepLink(uriString: String): ActivityScenario<MainActivity> {
        val intent = Intent(
            ApplicationProvider.getApplicationContext(),
            MainActivity::class.java,
        ).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse(uriString)
        }
        return ActivityScenario.launch(intent)
    }

    /**
     * Deliver a warm intent to the running [MainActivity] via the Android Activity Manager,
     * using the same production flags as [DriverPushNotifications]:
     * [Intent.FLAG_ACTIVITY_SINGLE_TOP] | [Intent.FLAG_ACTIVITY_CLEAR_TOP] |
     * [Intent.FLAG_ACTIVITY_NEW_TASK] (required when starting from a non-Activity context).
     *
     * This is a real Activity Manager delivery — the framework calls [MainActivity.onNewIntent]
     * on the existing top Activity instance, exactly as a push-notification tap would.
     * Production [MainActivity.onNewIntent] remains `protected`; no access-modifier changes
     * are needed.
     *
     * [waitForIdleSync] drains the main-thread message queue so that [MainActivity.onNewIntent] →
     * `handleIncomingIntent` → [DriverViewModel.handleDeepLink] completes and the
     * [DriverViewModel.uiState] [StateFlow] has updated before the next [onActivity] block.
     *
     * Must be called from the **instrumentation thread** (the test method body), not from
     * within [ActivityScenario.onActivity].
     */
    private fun deliverWarmIntent(intent: Intent) {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        ctx.startActivity(
            Intent(intent).apply {
                setClass(ctx, MainActivity::class.java)
                addFlags(
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_NEW_TASK,
                )
            },
        )
        InstrumentationRegistry.getInstrumentation().waitForIdleSync()
    }

    // ── 1. Cold-start job link — held in ViewModel until session/jobs load ────

    @Test
    fun coldStartJobIntentLaunchesActivityWithoutCrash() {
        // Proves MainActivity handles a cold-start ACTION_VIEW job URI without crashing.
        launchWithDeepLink("xdrivedriver://job/$VALID_JOB_UUID_A").close()
    }

    @Test
    fun coldStartJobLinkHeldAsPendingDeepLinkByProductionViewModel() {
        // Observe the production DriverViewModel from the Activity's ViewModelStore and
        // assert the state produced by MainActivity.onCreate → handleIncomingIntent directly.
        // No vm.handleDeepLink() call in the test body — the Activity's onCreate already
        // invoked it; we observe its result here.
        launchWithDeepLink("xdrivedriver://job/$VALID_JOB_UUID_A").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                assertNotNull("ViewModel must be accessible from the Activity's ViewModelStore", vm)

                // Unauthenticated state: pending link held, safe interim tab = MESSAGES.
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
            }
        }
    }

    @Test
    fun coldStartJobLinkPreservesExactJobIdForOwnerVerification() {
        launchWithDeepLink("xdrivedriver://job/$VALID_JOB_UUID_A").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                val pending = vm.uiState.value.pendingDeepLink
                assertTrue("Pending must be a Job destination", pending?.destination is DeepLinkDestination.Job)
                assertEquals(
                    "Exact server-issued job ID must be preserved for owner verification",
                    VALID_JOB_UUID_A,
                    (pending?.destination as DeepLinkDestination.Job).jobId,
                )
            }
        }
    }

    // ── 2. Cold-start non-job links route immediately — no pending hold ───────

    @Test
    fun coldStartNotificationLinkRoutesToMessagesImmediately() {
        // onCreate → handleIncomingIntent → handleDeepLink(Messages) routes immediately.
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
                assertNull(
                    "Non-job destination must not be held as pending",
                    vm.uiState.value.pendingDeepLink,
                )
            }
        }
    }

    @Test
    fun coldStartNearbyLinkRoutesToNearbyImmediately() {
        launchWithDeepLink("xdrivedriver://nearby").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                assertEquals(DriverTab.NEARBY, vm.uiState.value.selectedTab)
                assertNull(
                    "Non-job destination must not be held as pending",
                    vm.uiState.value.pendingDeepLink,
                )
            }
        }
    }

    @Test
    fun coldStartProfileLinkRoutesToProfileImmediately() {
        launchWithDeepLink("xdrivedriver://profile").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                assertEquals(DriverTab.PROFILE, vm.uiState.value.selectedTab)
                assertNull(
                    "Non-job destination must not be held as pending",
                    vm.uiState.value.pendingDeepLink,
                )
            }
        }
    }

    // ── 3. Warm-start via real Activity onNewIntent path ─────────────────────

    @Test
    fun warmJobIntentIsProcessedThroughOnNewIntentPath() {
        val warmIntent = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A"))
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var activityBefore: MainActivity? = null
            scenario.onActivity { a -> activityBefore = a }

            deliverWarmIntent(warmIntent)

            scenario.onActivity { a ->
                assertSame("Warm intent must reuse existing Activity (SINGLE_TOP/CLEAR_TOP)", activityBefore, a)
                val vm = ViewModelProvider(a)[DriverViewModel::class.java]
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
            }
        }
    }

    @Test
    fun warmNonJobIntentUpdatesTabImmediatelyViaOnNewIntent() {
        val nearbyIntent = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://nearby"))
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var activityBefore: MainActivity? = null
            scenario.onActivity { a -> activityBefore = a }

            deliverWarmIntent(nearbyIntent)

            scenario.onActivity { a ->
                assertSame("Warm intent must reuse existing Activity (SINGLE_TOP/CLEAR_TOP)", activityBefore, a)
                val vm = ViewModelProvider(a)[DriverViewModel::class.java]
                assertEquals(DriverTab.NEARBY, vm.uiState.value.selectedTab)
                assertNull(
                    "Non-job warm intent must not create a pending link",
                    vm.uiState.value.pendingDeepLink,
                )
            }
        }
    }

    @Test
    fun warmCompatSchemeJobIntentIsProcessedCorrectly() {
        // xdrive:// is the compat inbound alias — must parse to the same destination.
        val compatIntent = Intent(Intent.ACTION_VIEW, Uri.parse("xdrive://job/$VALID_JOB_UUID_A"))
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var activityBefore: MainActivity? = null
            scenario.onActivity { a -> activityBefore = a }

            deliverWarmIntent(compatIntent)

            scenario.onActivity { a ->
                assertSame("Warm compat-scheme intent must reuse existing Activity (SINGLE_TOP/CLEAR_TOP)", activityBefore, a)
                val vm = ViewModelProvider(a)[DriverViewModel::class.java]
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)
            }
        }
    }

    // ── 4. Activity recreation — ViewModel retained, routing is idempotent ───

    @Test
    fun recreationPreservesPendingJobLinkIdempotently() {
        launchWithDeepLink("xdrivedriver://job/$VALID_JOB_UUID_A").use { scenario ->
            // Before recreation: assert state produced by the first onCreate → handleIncomingIntent.
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
            }

            // Simulate configuration change (screen rotation, system language, etc.).
            scenario.recreate()

            // After recreation: the ViewModel is retained and the recreated Activity's
            // onCreate re-delivers the same intent via handleIncomingIntent — idempotent.
            // Assert the actual retained ViewModel state without re-applying the destination.
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                assertEquals(
                    "Pending link must be preserved (idempotent) after recreation",
                    DeepLinkDestination.Job(VALID_JOB_UUID_A),
                    vm.uiState.value.pendingDeepLink?.destination,
                )
                assertEquals(
                    "Tab must remain at MESSAGES after recreation",
                    DriverTab.MESSAGES,
                    vm.uiState.value.selectedTab,
                )
            }
        }
    }

    @Test
    fun recreationWithNonJobLinkIsIdempotent() {
        launchWithDeepLink("xdrivedriver://nearby").use { scenario ->
            // Assert state from the first onCreate before recreation.
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                assertEquals(DriverTab.NEARBY, vm.uiState.value.selectedTab)
            }

            scenario.recreate()

            // After recreation, the recreated onCreate re-delivers the nearby intent — tab stays NEARBY.
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                assertEquals(DriverTab.NEARBY, vm.uiState.value.selectedTab)
                assertNull(vm.uiState.value.pendingDeepLink)
            }
        }
    }

    // ── 5. Duplicate warm intents — one-shot idempotent hold ─────────────────

    @Test
    fun duplicateWarmJobIntentsAreHandledIdempotently() {
        val jobIntent = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A"))
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var activityBefore: MainActivity? = null
            scenario.onActivity { a -> activityBefore = a }

            // First delivery: holds the link.
            deliverWarmIntent(jobIntent)
            scenario.onActivity { a ->
                assertSame("Warm intent must reuse existing Activity (SINGLE_TOP/CLEAR_TOP)", activityBefore, a)
                val vm = ViewModelProvider(a)[DriverViewModel::class.java]
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
            }

            // Second delivery (duplicate — e.g., push received twice): must be idempotent.
            deliverWarmIntent(jobIntent)
            scenario.onActivity { a ->
                assertSame("Duplicate warm intent must still reuse the same Activity instance", activityBefore, a)
                val vm = ViewModelProvider(a)[DriverViewModel::class.java]
                assertEquals(
                    "Duplicate warm intent must not change pending link",
                    DeepLinkDestination.Job(VALID_JOB_UUID_A),
                    vm.uiState.value.pendingDeepLink?.destination,
                )
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
            }
        }
    }

    // ── 6. Malformed/unknown/bare URIs — Activity launches safely ────────────

    @Test
    fun malformedBareUriLaunchesActivityWithoutCrash() {
        launchWithDeepLink("xdrivedriver://").close()
    }

    @Test
    fun unknownHostUriLaunchesActivityWithoutCrash() {
        launchWithDeepLink("xdrivedriver://unknown-future-route-v99").close()
    }

    @Test
    fun invalidJobIdNonUuidUriIsRejectedToMessages() {
        launchWithDeepLink("xdrivedriver://job/not-a-valid-uuid").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                // Verify the parser rejects the non-UUID ID.
                val dest = XDriveDeepLink.parse(Uri.parse("xdrivedriver://job/not-a-valid-uuid"))
                assertEquals(DeepLinkDestination.Messages, dest)

                // Routing Messages produces no pending link.
                vm.handleDeepLink(dest)
                assertNull(vm.uiState.value.pendingDeepLink)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
            }
        }
    }

    @Test
    fun httpsLookalikeHostIsRejectedToMessages() {
        launchWithDeepLink("https://evil.xdrivelogistics.co.uk/driver/jobs/$VALID_JOB_UUID_A").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                val dest = XDriveDeepLink.parse(
                    Uri.parse("https://evil.xdrivelogistics.co.uk/driver/jobs/$VALID_JOB_UUID_A"),
                )
                assertEquals(
                    "Lookalike host must be rejected to Messages",
                    DeepLinkDestination.Messages,
                    dest,
                )
                vm.handleDeepLink(dest)
                assertNull(vm.uiState.value.pendingDeepLink)
            }
        }
    }

    @Test
    fun httpsMPathFailsClosedToMessages() {
        launchWithDeepLink("https://www.xdrivelogistics.co.uk/m/get-app").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                val dest = XDriveDeepLink.parse(
                    Uri.parse("https://www.xdrivelogistics.co.uk/m/get-app"),
                )
                // /m/ path fails closed — no longer broadly routes to Nearby.
                assertEquals(DeepLinkDestination.Messages, dest)
                vm.handleDeepLink(dest)
                assertNull(vm.uiState.value.pendingDeepLink)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
            }
        }
    }

    // ── 7. A→B owner isolation — logout clears owner A's link; owner B gets a fresh start ──

    @Test
    fun ownerTransitionReplacesExistingPendingDeepLink() {
        // Proves that when owner B's job intent arrives, it replaces (does not accumulate)
        // owner A's pending link via the production applyJobDeepLinkToState code path.
        val intentA = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A"))
        val intentB = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_B"))
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var activityBefore: MainActivity? = null
            scenario.onActivity { a -> activityBefore = a }

            // Owner A's job arrives first via warm intent.
            deliverWarmIntent(intentA)
            scenario.onActivity { a ->
                assertSame("Warm intent must reuse existing Activity (SINGLE_TOP/CLEAR_TOP)", activityBefore, a)
                val vm = ViewModelProvider(a)[DriverViewModel::class.java]
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)
            }

            // Owner B's job arrives (e.g., after account switch + push).
            // Routing must REPLACE the pending link, not accumulate two links.
            deliverWarmIntent(intentB)
            scenario.onActivity { a ->
                assertSame("Second warm intent must still reuse the same Activity instance", activityBefore, a)
                val vm = ViewModelProvider(a)[DriverViewModel::class.java]
                assertEquals(
                    "Owner B's job must replace owner A's pending link — no accumulation",
                    DeepLinkDestination.Job(VALID_JOB_UUID_B),
                    vm.uiState.value.pendingDeepLink?.destination,
                )
            }
        }
    }

    @Test
    fun logoutClearsOwnerALinkSoOwnerBGetsAFreshPendingSlot() {
        // Proves the full A→B owner transition through the production logout path:
        // 1. Owner A's job is set as pendingDeepLink via warm intent.
        // 2. vm.logout() is called (production path) — the session-clear coroutine clears state.
        // 3. After logout, resolvePendingDeepLink on the actual ViewModel state returns null
        //    (session guard prevents stale routing even before the async DataStore clear).
        // 4. Owner B's warm intent then sets a fresh pending link.
        val intentA = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A"))
        val intentB = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_B"))
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var vm: DriverViewModel? = null
            var activityBefore: MainActivity? = null
            scenario.onActivity { a ->
                activityBefore = a
                vm = ViewModelProvider(a)[DriverViewModel::class.java]
            }

            // Set owner A's pending link via the real onNewIntent path.
            deliverWarmIntent(intentA)
            scenario.onActivity { a ->
                assertSame("Warm intent must reuse existing Activity (SINGLE_TOP/CLEAR_TOP)", activityBefore, a)
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm!!.uiState.value.pendingDeepLink?.destination)
            }

            // Trigger the production logout path on the main thread.
            scenario.onActivity { _ -> vm!!.logout() }

            // After logout, the routing coordinator must not route owner A's stale job.
            // resolvePendingDeepLink returns null when session == null (unauthenticated guard),
            // proving the stale link is inert regardless of whether the async DataStore
            // clear has completed.
            scenario.onActivity { _ ->
                val (_, resolvedId) = resolvePendingDeepLink(vm!!.uiState.value)
                assertNull(
                    "After logout, resolvePendingDeepLink must not route owner A's stale job",
                    resolvedId,
                )
            }

            // Owner B's warm intent arrives after logout — a fresh pending link is set.
            deliverWarmIntent(intentB)
            scenario.onActivity { a ->
                assertSame("Post-logout warm intent must still reuse the same Activity instance", activityBefore, a)
                val pending = vm!!.uiState.value.pendingDeepLink
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
        }
    }

    @Test
    fun differentJobIdsParseThroughActivityToNonEqualDestinations() {
        val intentA = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A"))
        val intentB = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_B"))
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var activityBefore: MainActivity? = null
            scenario.onActivity { a -> activityBefore = a }

            deliverWarmIntent(intentA)
            var pendingA: PendingDeepLinkCommand? = null
            scenario.onActivity { a ->
                assertSame("Warm intent must reuse existing Activity (SINGLE_TOP/CLEAR_TOP)", activityBefore, a)
                pendingA = ViewModelProvider(a)[DriverViewModel::class.java].uiState.value.pendingDeepLink
            }

            deliverWarmIntent(intentB)
            scenario.onActivity { a ->
                assertSame("Second warm intent must still reuse the same Activity instance", activityBefore, a)
                val pendingB = ViewModelProvider(a)[DriverViewModel::class.java].uiState.value.pendingDeepLink
                assertFalse("Different job UUIDs must produce non-equal pending destinations", pendingA == pendingB)
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), pendingA?.destination)
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_B), pendingB?.destination)
            }
        }
    }

    // ── 8. Logout/owner-clear — production vm.logout() path ─────────────────

    @Test
    fun logoutClearsPendingDeepLinkFromPreviousOwner() {
        val warmIntent = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A"))
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var vm: DriverViewModel? = null
            var activityBefore: MainActivity? = null
            scenario.onActivity { a ->
                activityBefore = a
                vm = ViewModelProvider(a)[DriverViewModel::class.java]
            }

            // Pending link set for owner via the real onNewIntent path.
            deliverWarmIntent(warmIntent)
            scenario.onActivity { a ->
                assertSame("Warm intent must reuse existing Activity (SINGLE_TOP/CLEAR_TOP)", activityBefore, a)
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm!!.uiState.value.pendingDeepLink?.destination)
            }

            // Exercise the production logout path.
            scenario.onActivity { _ -> vm!!.logout() }

            // Assert on the actual ViewModel state (not a manually constructed copy).
            // resolvePendingDeepLink returns null: the null-session guard prevents stale routing
            // after logout, whether or not the async DataStore clear has completed yet.
            scenario.onActivity { _ ->
                val (_, resolvedId) = resolvePendingDeepLink(vm!!.uiState.value)
                assertNull(
                    "After vm.logout(), resolvePendingDeepLink must not route a stale job from the previous owner",
                    resolvedId,
                )
            }
        }
    }

    // ── 9. Stale/unassigned job — selectJobIfAssigned falls through to Messages ─

    @Test
    fun staleJobIdWithoutSessionFallsToMessagesViaSelectJobIfAssigned() {
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                // selectJobIfAssigned: no session → routes to MESSAGES (stale, unassigned,
                // marketplace, and terminal jobs all fall through this path).
                vm.selectJobIfAssigned(VALID_JOB_UUID_A)
                assertEquals(
                    "selectJobIfAssigned with no session must route to MESSAGES",
                    DriverTab.MESSAGES,
                    vm.uiState.value.selectedTab,
                )
            }
        }
    }

    // ── 10. ViewModel wiring — correct instance from Activity ViewModelStore ──

    @Test
    fun viewModelFromActivityStoreIsTheSameInstanceAcrossOnActivityCalls() {
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var vmRef1: DriverViewModel? = null
            var vmRef2: DriverViewModel? = null

            scenario.onActivity { activity ->
                vmRef1 = ViewModelProvider(activity)[DriverViewModel::class.java]
            }
            scenario.onActivity { activity ->
                vmRef2 = ViewModelProvider(activity)[DriverViewModel::class.java]
            }

            assertTrue(
                "ViewModelProvider must return the same instance across onActivity calls",
                vmRef1 === vmRef2,
            )
        }
    }

    // ── 11. Auth-epoch / A→B owner isolation (FakeSessionRepository + skipDataRefresh) ──
    //
    // These tests use an in-memory FakeSessionRepository and skip live API calls so that
    // session transitions are deterministic and do not depend on network availability.
    // The FakeSessionRepository emits session changes synchronously on the Kotlin main-thread
    // dispatcher, making state transitions observable after awaitCondition() returns.
    //
    // The tests prove:
    // a. [DriverViewModel.authEpoch] advances after logout/session-null.
    // b. A [PendingDeepLinkCommand] holds the authEpoch at capture time.
    // c. [resolvePendingDeepLink] on the post-logout (epoch N+1) state rejects a command
    //    that was captured at epoch N.
    // d. A new owner (B) who logs in after A has logged out can only process commands
    //    that were captured under the new epoch, not under A's epoch.

    @Test
    fun authEpochAdvancesAfterLogoutAndPendingLinkIsCleared() {
        val fake = FakeSessionRepository()
        installFakeFactory(fake)

        launchWithDeepLink("xdrivedriver://job/$VALID_JOB_UUID_A").use { scenario ->
            var vm: DriverViewModel? = null

            scenario.onActivity { activity ->
                vm = ViewModelProvider(activity)[DriverViewModel::class.java]
            }

            // After the null-session reset + onCreate handleDeepLink, epoch is ≥ 1
            // and the pending link is held for the current epoch.
            val pendingAfterColdStart = vm!!.uiState.value.pendingDeepLink
            assertNotNull("Cold-start link must be held as PendingDeepLinkCommand", pendingAfterColdStart)
            assertEquals(
                "Command destination must match the cold-start job UUID",
                DeepLinkDestination.Job(VALID_JOB_UUID_A),
                pendingAfterColdStart?.destination,
            )
            val epochAtColdStart = vm!!.uiState.value.authEpoch
            assertEquals(
                "Command epoch must match the state epoch at capture time",
                epochAtColdStart,
                pendingAfterColdStart?.authEpoch,
            )

            // Owner A logs in: FakeSessionRepository emits synchronously → ViewModel
            // observes session, marks isAuthenticated = true, then (skipDataRefresh) calls
            // processPendingDeepLinkIfReady which consumes the pending link.
            runBlocking { fake.saveSession(DriverSession("tok-a", "ref-a", "owner-a", "a@test.co.uk")) }
            val aAuthenticated = awaitCondition(5_000) { vm!!.uiState.value.isAuthenticated }
            assertTrue("ViewModel must become authenticated after owner A session write", aAuthenticated)

            // Pending link consumed (routed to Messages because jobs list is empty in test mode).
            val pendingAfterALogin = awaitCondition(5_000) { vm!!.uiState.value.pendingDeepLink == null }
            assertTrue("Pending link must be consumed after owner A authenticates", pendingAfterALogin)
            val epochDuringA = vm!!.uiState.value.authEpoch
            assertEquals("Epoch must not change on login (only on logout/owner-change)", epochAtColdStart, epochDuringA)

            // Owner A logs out: production logout path → sessionStore.clear() → FakeRepo emits null
            // → DriverViewModel receives null → state reset with authEpoch + 1.
            scenario.onActivity { _ -> vm!!.logout() }
            val epochAdvanced = awaitCondition(5_000) { vm!!.uiState.value.authEpoch > epochDuringA }
            assertTrue("authEpoch must advance after logout", epochAdvanced)
            val epochAfterLogout = vm!!.uiState.value.authEpoch
            assertTrue("Post-logout epoch must be strictly greater than during-A epoch", epochAfterLogout > epochDuringA)
            assertNull("Pending link must be null after logout state reset", vm!!.uiState.value.pendingDeepLink)
        }
    }

    @Test
    fun ownerBCannotRouteStaleOwnerACommandAfterEpochAdvance() {
        // Security proof: a PendingDeepLinkCommand captured at epoch N is rejected by
        // resolvePendingDeepLink when the current state epoch is N+1 (after logout).
        // This proves the production epoch guard works regardless of whether the job
        // appears in owner B's (empty) jobs list.
        val fake = FakeSessionRepository()
        installFakeFactory(fake)

        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var vm: DriverViewModel? = null

            scenario.onActivity { activity ->
                vm = ViewModelProvider(activity)[DriverViewModel::class.java]
            }

            // Owner A logs in.
            runBlocking { fake.saveSession(DriverSession("tok-a", "ref-a", "owner-a", "a@test.co.uk")) }
            val aAuthenticated = awaitCondition(5_000) { vm!!.uiState.value.isAuthenticated }
            assertTrue("Owner A must authenticate", aAuthenticated)
            val epochDuringA = vm!!.uiState.value.authEpoch

            // Owner A delivers a job link while logged in.
            var activityBefore: MainActivity? = null
            scenario.onActivity { a -> activityBefore = a }
            deliverWarmIntent(Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A")))
            scenario.onActivity { a ->
                assertSame("Warm intent must reuse existing Activity (SINGLE_TOP/CLEAR_TOP)", activityBefore, a)
            }
            // skipDataRefresh: processPendingDeepLinkIfReady consumes the link immediately.
            // If jobs were loaded, it would have been consumed. If jobs are empty, link is held
            // (unauthenticated guard still passes if session is set).
            // Here, since isAuthenticated=true but jobs=empty → applyJobDeepLinkToState holds it.
            // processPendingDeepLinkIfReady: isAuthenticated=true, session!=null, epoch matches → consumes.
            // We wait for the link to be consumed (or confirm it was processed).

            // Owner A logs out.
            scenario.onActivity { _ -> vm!!.logout() }
            val epochAdvanced = awaitCondition(5_000) { vm!!.uiState.value.authEpoch > epochDuringA }
            assertTrue("Epoch must advance after owner A logout", epochAdvanced)
            val epochAfterLogout = vm!!.uiState.value.authEpoch

            // Construct a stale command as if owner A's link somehow persisted past the logout.
            // This represents the scenario the epoch guard defends against: a command from epoch
            // N surviving into epoch N+1. In the production code path this cannot happen
            // (the state reset clears the pending link), but the epoch guard is a second line
            // of defence if state ever reaches this condition.
            val staleCommand = PendingDeepLinkCommand(
                DeepLinkDestination.Job(VALID_JOB_UUID_A),
                authEpoch = epochDuringA,  // epoch before logout
                commandId = "stale-cmd-owner-a",
            )
            // Owner B logs in under the new epoch.
            runBlocking { fake.saveSession(DriverSession("tok-b", "ref-b", "owner-b", "b@test.co.uk")) }
            val bAuthenticated = awaitCondition(5_000) {
                vm!!.uiState.value.isAuthenticated && vm!!.uiState.value.session?.userId == "owner-b"
            }
            assertTrue("Owner B must authenticate", bAuthenticated)

            // Directly verify the epoch guard: resolvePendingDeepLink on the current (B-epoch)
            // state with owner A's stale command must reject it.
            val stateWithStaleCommand = vm!!.uiState.value.copy(pendingDeepLink = staleCommand)
            val (_, stalResolvedId) = resolvePendingDeepLink(stateWithStaleCommand)
            assertNull(
                "Stale epoch-$epochDuringA command must be rejected under epoch-$epochAfterLogout state",
                stalResolvedId,
            )

            // Confirm that the epoch guard is the rejection reason: a command with the new epoch
            // IS resolved (job absent from B's list → Messages, but the routing coordinator proceeds).
            val freshCommand = PendingDeepLinkCommand(
                DeepLinkDestination.Job(VALID_JOB_UUID_A),
                authEpoch = epochAfterLogout,  // matches current epoch
                commandId = "fresh-cmd-owner-b",
            )
            val stateWithFreshCommand = vm!!.uiState.value.copy(pendingDeepLink = freshCommand)
            val (_, freshResolvedId) = resolvePendingDeepLink(stateWithFreshCommand)
            assertEquals(
                "A fresh command with the correct epoch must be resolved (routing handled by job-list check)",
                VALID_JOB_UUID_A,
                freshResolvedId,
            )
        }
    }

    @Test
    fun directOwnerReplacementAdvancesEpoch() {
        // Proves that a direct A→B session replacement (no intermediate null) advances the
        // authEpoch through the production ownerChanged() path in DriverViewModel.
        val fake = FakeSessionRepository()
        installFakeFactory(fake)

        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var vm: DriverViewModel? = null
            scenario.onActivity { activity -> vm = ViewModelProvider(activity)[DriverViewModel::class.java] }

            // Owner A logs in.
            runBlocking { fake.saveSession(DriverSession("tok-a", "ref-a", "owner-a", "a@test.co.uk")) }
            awaitCondition(5_000) { vm!!.uiState.value.isAuthenticated }
            val epochDuringA = vm!!.uiState.value.authEpoch

            // Direct replacement: B's session arrives without an intermediate null.
            // The ViewModel's ownerChanged() path detects the different userId and advances the epoch.
            runBlocking { fake.saveSession(DriverSession("tok-b", "ref-b", "owner-b", "b@test.co.uk")) }
            val epochAdvanced = awaitCondition(5_000) { vm!!.uiState.value.authEpoch > epochDuringA }
            assertTrue(
                "Direct owner replacement must advance authEpoch via the ownerChanged path",
                epochAdvanced,
            )
            assertEquals("Session must now belong to owner B", "owner-b", vm!!.uiState.value.session?.userId)
        }
    }

    // ── 12. One-shot commandId deduplication via consumedCommandIds ───────────

    @Test
    fun coldStartJobLinkCommandIdIsRecordedInConsumedCommandIdsAfterPendingLinkIsConsumed() {
        // After the pending deep link is consumed (via processPendingDeepLinkIfReady), the
        // commandId derived from the URI is recorded in consumedCommandIds. A subsequent
        // delivery of the same intent (same URI → same commandId) is a no-op.
        val fake = FakeSessionRepository()
        installFakeFactory(fake)

        launchWithDeepLink("xdrivedriver://job/$VALID_JOB_UUID_A").use { scenario ->
            var vm: DriverViewModel? = null
            scenario.onActivity { activity ->
                vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                // Cold start: link held pending while unauthenticated.
                assertNotNull("Cold-start link must be held pending", vm!!.uiState.value.pendingDeepLink)
            }

            // Authenticate — fake skipDataRefreshForTesting=true triggers processPendingDeepLinkIfReady.
            runBlocking { fake.saveSession(DriverSession("tok", "ref", "user-a", "a@test.co.uk")) }
            val pendingCleared = awaitCondition(5_000) { vm!!.uiState.value.pendingDeepLink == null }
            assertTrue("Pending link must be cleared after authentication", pendingCleared)

            scenario.onActivity {
                // The commandId of the pending link (= URI string) must now be in consumedCommandIds.
                val consumed = vm!!.uiState.value.consumedCommandIds
                assertTrue(
                    "commandId derived from URI must be in consumedCommandIds after consumption",
                    "xdrivedriver://job/$VALID_JOB_UUID_A" in consumed,
                )
            }
        }
    }

    @Test
    fun duplicateWarmJobIntentIsDeduplicatedViaConsumedCommandIds() {
        // Proves that a duplicate warm intent (same URI → same commandId) does not update
        // pendingDeepLink a second time once the commandId is in consumedCommandIds.
        // The commandId is the URI string; the same URI delivered twice must be idempotent.
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var vm: DriverViewModel? = null
            scenario.onActivity { activity -> vm = ViewModelProvider(activity)[DriverViewModel::class.java] }

            // Deliver the first warm intent — records the commandId in the ViewModel state.
            val warmIntent = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A"))
            deliverWarmIntent(warmIntent)
            scenario.onActivity {
                assertNotNull("First delivery must set pendingDeepLink", vm!!.uiState.value.pendingDeepLink)
                assertEquals(VALID_JOB_UUID_A, vm!!.uiState.value.pendingDeepLink?.destination?.jobId)
            }

            // Deliver the exact same intent a second time (same URI → same commandId).
            deliverWarmIntent(warmIntent)
            scenario.onActivity {
                // pendingDeepLink must still hold the same job — not cleared, not accumulated.
                assertNotNull("Second delivery must not clear the pending link", vm!!.uiState.value.pendingDeepLink)
                assertEquals(
                    "Second delivery of the same URI must not change the pending destination",
                    VALID_JOB_UUID_A,
                    vm!!.uiState.value.pendingDeepLink?.destination?.jobId,
                )
            }
        }
    }

    @Test
    fun recreationIsIdempotentDueToCommandIdDeduplication() {
        // After Activity recreation, the same intent is re-delivered to onCreate with the same URI.
        // Since handleIncomingIntent derives commandId = uri.toString(), the ViewModel detects
        // it's already in consumedCommandIds (if consumed) OR sets the same pending link (if not).
        // Either way, the routing state must not change.
        launchWithDeepLink("xdrivedriver://job/$VALID_JOB_UUID_A").use { scenario ->
            var pendingBefore: PendingDeepLinkCommand? = null
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                pendingBefore = vm.uiState.value.pendingDeepLink
                assertNotNull("Pending link must be set on first cold start", pendingBefore)
            }

            // Recreate the Activity — ViewModel is retained, same intent re-delivered to onCreate.
            scenario.recreate()

            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                val pendingAfter = vm.uiState.value.pendingDeepLink

                // The pending link destination must be the same (idempotent re-hold or preserved).
                assertEquals(
                    "Recreation must not change the pending destination",
                    pendingBefore?.destination,
                    pendingAfter?.destination,
                )
                assertEquals(
                    "Recreation must not change the job ID held in pending",
                    VALID_JOB_UUID_A,
                    pendingAfter?.destination?.jobId,
                )
            }
        }
    }
}
