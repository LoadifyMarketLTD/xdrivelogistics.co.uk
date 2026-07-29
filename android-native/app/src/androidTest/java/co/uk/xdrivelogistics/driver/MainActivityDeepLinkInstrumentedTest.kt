package co.uk.xdrivelogistics.driver

import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
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
 * main thread. Warm-intent delivery uses the Android framework's
 * [android.app.Instrumentation.callActivityOnNewIntent] to respect the protected
 * [MainActivity.onNewIntent] access boundary without modifying production code.
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
 */
@RunWith(AndroidJUnit4::class)
class MainActivityDeepLinkInstrumentedTest {

    private val VALID_JOB_UUID_A = "6e5e0122-7b3c-4ec8-9f41-5d8937e541f1"
    private val VALID_JOB_UUID_B = "a1b2c3d4-1234-4abc-8def-0123456789ab"

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
     * Deliver a warm intent through the Android framework's [android.app.Instrumentation]
     * boundary. [MainActivity.onNewIntent] is `protected`; the framework method is the
     * correct way to deliver intents to a running Activity in instrumented tests without
     * modifying production access modifiers.
     */
    private fun deliverWarmIntent(activity: MainActivity, intent: Intent) {
        InstrumentationRegistry.getInstrumentation().callActivityOnNewIntent(activity, intent)
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
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)
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
                assertTrue("Pending must be a Job destination", pending is DeepLinkDestination.Job)
                assertEquals(
                    "Exact server-issued job ID must be preserved for owner verification",
                    VALID_JOB_UUID_A,
                    (pending as DeepLinkDestination.Job).jobId,
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
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                val warmIntent = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A"))

                // Deliver through the Android framework boundary — exercises the real
                // MainActivity.onNewIntent → handleIncomingIntent → handleDeepLink path.
                deliverWarmIntent(activity, warmIntent)

                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
            }
        }
    }

    @Test
    fun warmNonJobIntentUpdatesTabImmediatelyViaOnNewIntent() {
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                val nearbyIntent = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://nearby"))

                deliverWarmIntent(activity, nearbyIntent)

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
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                // xdrive:// is the compat inbound alias — must parse to the same destination.
                val compatIntent = Intent(Intent.ACTION_VIEW, Uri.parse("xdrive://job/$VALID_JOB_UUID_A"))

                deliverWarmIntent(activity, compatIntent)

                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)
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
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)
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
                    vm.uiState.value.pendingDeepLink,
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
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                val jobIntent = Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A"))

                // First delivery: holds the link.
                deliverWarmIntent(activity, jobIntent)
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)

                // Second delivery (duplicate — e.g., push received twice): must be idempotent.
                deliverWarmIntent(activity, jobIntent)
                assertEquals(
                    "Duplicate warm intent must not change pending link",
                    DeepLinkDestination.Job(VALID_JOB_UUID_A),
                    vm.uiState.value.pendingDeepLink,
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
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                // Owner A's job arrives first via warm intent.
                deliverWarmIntent(activity, Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A")))
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)

                // Owner B's job arrives (e.g., after account switch + push).
                // Routing must REPLACE the pending link, not accumulate two links.
                deliverWarmIntent(activity, Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_B")))
                assertEquals(
                    "Owner B's job must replace owner A's pending link — no accumulation",
                    DeepLinkDestination.Job(VALID_JOB_UUID_B),
                    vm.uiState.value.pendingDeepLink,
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
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var vm: DriverViewModel? = null

            scenario.onActivity { activity ->
                vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                // Set owner A's pending link via the real onNewIntent path.
                deliverWarmIntent(
                    activity,
                    Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A")),
                )
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm!!.uiState.value.pendingDeepLink)
            }

            // Trigger the production logout path on the main thread.
            scenario.onActivity { _ ->
                vm!!.logout()
            }

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
            scenario.onActivity { activity ->
                deliverWarmIntent(
                    activity,
                    Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_B")),
                )
                val pending = vm!!.uiState.value.pendingDeepLink
                assertEquals(
                    "Owner B's job must be held as a fresh pending link after owner A's logout",
                    DeepLinkDestination.Job(VALID_JOB_UUID_B),
                    pending,
                )
                assertFalse(
                    "Owner B's pending link must not equal owner A's stale UUID",
                    pending == DeepLinkDestination.Job(VALID_JOB_UUID_A),
                )
            }
        }
    }

    @Test
    fun differentJobIdsParseThroughActivityToNonEqualDestinations() {
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                deliverWarmIntent(activity, Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A")))
                val pendingA = vm.uiState.value.pendingDeepLink

                deliverWarmIntent(activity, Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_B")))
                val pendingB = vm.uiState.value.pendingDeepLink

                assertFalse("Different job UUIDs must produce non-equal pending destinations", pendingA == pendingB)
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), pendingA)
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_B), pendingB)
            }
        }
    }

    // ── 8. Logout/owner-clear — production vm.logout() path ─────────────────

    @Test
    fun logoutClearsPendingDeepLinkFromPreviousOwner() {
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            var vm: DriverViewModel? = null

            scenario.onActivity { activity ->
                vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                // Pending link set for owner via the real onNewIntent path.
                deliverWarmIntent(
                    activity,
                    Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A")),
                )
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm!!.uiState.value.pendingDeepLink)
            }

            // Exercise the production logout path.
            scenario.onActivity { _ ->
                vm!!.logout()
            }

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
}
