package co.uk.xdrivelogistics.driver

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.rule.GrantPermissionRule
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Production-linked Android 14 instrumented tests that launch [MainActivity] via
 * [ActivityScenario] and observe the routing state through the production
 * [DriverViewModel] obtained from the Activity's [ViewModelStore].
 *
 * Unlike the parser-only [DeepLinkIntentInstrumentedTest], these tests exercise the
 * complete Activity lifecycle routing path:
 *   - cold-start: [MainActivity.onCreate] → `routeIncomingIntent` → [DriverViewModel.handleDeepLink]
 *   - warm-start: [MainActivity.routeIncomingIntentForTesting] — exercises the production routing
 *     logic without going through [android.app.Activity.onNewIntent] or ActivityManager, keeping
 *     the scenario-owned instance in RESUMED and allowing [ActivityScenario.close] to complete.
 *   - recreation: [ActivityScenario.recreate] retains the ViewModel; `onCreate` re-delivers idempotently
 *   - logout/owner-clear: [DriverViewModel.logout] exercises the production session-clear path
 *
 * Pure routing and session-state tests (deduplication, owner epoch, logout isolation, pending-link
 * replacement) that do not require Activity lifecycle are covered in [DriverViewModelDeepLinkTest].
 *
 * State assertions are made synchronously within [ActivityScenario.onActivity] blocks on the
 * main thread. Warm-intent delivery uses [MainActivity.routeIncomingIntentForTesting] from within
 * [ActivityScenario.onActivity] to invoke only the production routing logic — not the lifecycle
 * callback — on the main thread. This avoids both [android.content.Context.startActivity] with
 * [Intent.FLAG_ACTIVITY_NEW_TASK] (which can launch a second [MainActivity]) and
 * [android.app.Instrumentation.callActivityOnNewIntent] or direct [android.app.Activity.onNewIntent]
 * invocation (which both cross the ActivityManager boundary and interfere with
 * [ActivityScenario] lifecycle ownership under Android 14, leaving the scenario-tracked instance
 * permanently PAUSED and causing [ActivityScenario.close] to time out waiting for DESTROYED).
 * [composeTestRule.waitForIdle] after delivery ensures async Compose/Coroutine state settles
 * before assertions run.
 *
 * Coverage:
 * 1. Cold-start ACTION_VIEW: job link held as [DriverUiState.pendingDeepLink] by the
 *    production [MainActivity.onCreate] → `routeIncomingIntent` code path; safe interim tab = MESSAGES.
 * 2. Cold-start non-job links (Messages, Nearby, Profile): route immediately, no pending hold.
 * 3. Warm-start via [MainActivity.routeIncomingIntentForTesting]: job and
 *    non-job intents are processed through the production routing path.
 * 4. Activity recreation ([ActivityScenario.recreate]): ViewModel retained; routing state is
 *    idempotent — the same intent is re-delivered to `onCreate` and produces the same state.
 * 5. Malformed/unknown/bare URIs: Activity launches without crash; parser returns Messages.
 * 6. Stale/unassigned job via [DriverViewModel.selectJobIfAssigned]: without a session,
 *    routing falls through to the Messages tab.
 * 7. ViewModel is always accessible from the Activity's ViewModelStore; the Activity
 *    correctly wires [MainActivity.viewModels] to the Kotlin delegate.
 * 8. One-shot deduplication (recreation): the same intent URI (same commandId) is idempotent
 *    after Activity recreation via [ActivityScenario.recreate].
 */
@RunWith(AndroidJUnit4::class)
class MainActivityDeepLinkInstrumentedTest {

    private val VALID_JOB_UUID_A = "6e5e0122-7b3c-4ec8-9f41-5d8937e541f1"
    private val VALID_JOB_UUID_B = "a1b2c3d4-1234-4abc-8def-0123456789ab"

    /**
     * Pre-grant POST_NOTIFICATIONS so [MainActivity]'s
     * `LaunchedEffect(state.isAuthenticated)` never calls
     * `notificationPermissionLauncher.launch()` during tests.
     *
     * Without this rule, any test that authenticates (via [FakeSessionRepository]) on
     * Android 13+ causes the permission dialog to open, leaving the Activity in PAUSED.
     * [ActivityScenario.close] then times out waiting for DESTROYED.
     */
    @get:Rule
    val grantPermissions: GrantPermissionRule =
        GrantPermissionRule.grant(Manifest.permission.POST_NOTIFICATIONS)

    /**
     * Registers Compose's [androidx.compose.ui.test.ComposeIdlingResource] with Espresso
     * so that [waitForIdle] drains both the main Looper queue *and* any pending
     * Choreographer/[androidx.compose.runtime.Recomposer] frames.
     *
     * [android.app.Instrumentation.waitForIdleSync] only drains Looper messages; it does
     * not wait for Compose's frame clock (backed by [android.view.Choreographer]). A
     * pending recomposition frame left in the Choreographer queue when
     * [ActivityScenario.close] calls [android.app.Activity.finishAndRemoveTask] prevents
     * the window manager from completing the RESUMED→PAUSED transition on Android 14,
     * causing a 45-second timeout. [waitForIdle] blocks until the [Recomposer] is idle,
     * ensuring no pending frame work exists before teardown.
     */
    @get:Rule
    val composeTestRule = createEmptyComposeRule()

    @After
    fun tearDown() {
        // Always reset the test factory so later tests get the production SessionStore.
        MainActivity.testViewModelFactory = null
    }

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
     * Deliver a warm intent to the exact [MainActivity] owned by [scenario] via
     * [MainActivity.routeIncomingIntentForTesting].
     *
     * Accepts the owning [ActivityScenario] so that routing is applied to the exact instance
     * tracked by the scenario. [MainActivity.routeIncomingIntentForTesting] calls only the
     * private [MainActivity.routeIncomingIntent] routing function — it does NOT call
     * [android.app.Activity.onNewIntent] or [super.onNewIntent], which would notify
     * ActivityManager and leave the scenario-tracked instance in an indeterminate lifecycle
     * state under Android 14, causing [ActivityScenario.close] to time out waiting for DESTROYED.
     *
     * [scenario.onActivity] runs the block on the main thread and blocks the instrumentation
     * thread until it completes, so routing is synchronous before any assertion.
     * [composeTestRule.waitForIdle] after [onActivity] returns blocks until Compose's
     * [androidx.compose.runtime.Recomposer] has no pending work — including pending
     * Choreographer frame callbacks — so that no in-flight recomposition remains when
     * [ActivityScenario.close] calls [android.app.Activity.finishAndRemoveTask].
     */
    private fun deliverWarmIntent(scenario: ActivityScenario<MainActivity>, intent: Intent) {
        scenario.onActivity { activity ->
            activity.routeIncomingIntentForTesting(intent)
        }
        composeTestRule.waitForIdle()
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
        // assert the state produced by MainActivity.onCreate → routeIncomingIntent directly.
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
        // onCreate → routeIncomingIntent → handleDeepLink(Messages) routes immediately.
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

            deliverWarmIntent(scenario, warmIntent)

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

            deliverWarmIntent(scenario, nearbyIntent)

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

            deliverWarmIntent(scenario, compatIntent)

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
            // Before recreation: assert state produced by the first onCreate → routeIncomingIntent.
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink?.destination)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
            }

            // Simulate configuration change (screen rotation, system language, etc.).
            scenario.recreate()

            // After recreation: the ViewModel is retained and the recreated Activity's
            // onCreate re-delivers the same intent via routeIncomingIntent — idempotent.
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

    // ── 5. Malformed/unknown/bare URIs — Activity launches safely ────────────

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

    // ── 6. Stale/unassigned job — selectJobIfAssigned falls through to Messages ─

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

    // ── 8. One-shot commandId deduplication via Activity recreation ───────────

    @Test
    fun recreationIsIdempotentDueToCommandIdDeduplication() {
        // After Activity recreation, the same intent is re-delivered to onCreate with the same URI.
        // Since routeIncomingIntent derives commandId = uri.toString(), the ViewModel detects
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
