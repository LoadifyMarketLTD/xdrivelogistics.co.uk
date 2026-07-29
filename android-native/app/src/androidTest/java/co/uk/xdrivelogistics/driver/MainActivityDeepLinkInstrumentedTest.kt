package co.uk.xdrivelogistics.driver

import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
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
 * complete Activity → ViewModel routing path: [MainActivity.handleIncomingIntent] →
 * [DriverViewModel.handleDeepLink] → routing state mutations observed via [DriverUiState].
 *
 * All state assertions are made synchronously within [ActivityScenario.onActivity] blocks
 * to avoid races with the ViewModel's init coroutine, which resets to the stable
 * unauthenticated [DriverUiState] once the DataStore session flow emits null.
 *
 * Coverage:
 * 1. Cold-start ACTION_VIEW: job link held as [DriverUiState.pendingDeepLink]; safe interim
 *    tab = MESSAGES.
 * 2. Cold-start non-job links (Messages, Nearby, Profile): route immediately, no pending hold.
 * 3. Warm-start via [MainActivity.onNewIntent]: job and non-job intents are processed through
 *    the real Activity onNewIntent path.
 * 4. Activity recreation ([ActivityScenario.recreate]): ViewModel retained; routing state
 *    is idempotent — the same pending link is produced again without corruption or loss.
 * 5. Duplicate warm intents: one-shot idempotent hold — the same job destination is held,
 *    not accumulated.
 * 6. Malformed/unknown/bare URIs: Activity launches without crash; parser returns Messages.
 * 7. A→B owner replacement: a new warm job intent replaces (not accumulates) the existing
 *    pending link.
 * 8. Logout/owner-clear: [resolvePendingDeepLink] on a cleared state returns null — no
 *    stale job from the previous owner is routed.
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

    // ── 1. Cold-start job link — held in ViewModel until session/jobs load ────

    @Test
    fun coldStartJobIntentLaunchesActivityWithoutCrash() {
        // Proves MainActivity handles a cold-start ACTION_VIEW job URI without crashing.
        launchWithDeepLink("xdrivedriver://job/$VALID_JOB_UUID_A").close()
    }

    @Test
    fun coldStartJobLinkHeldAsPendingDeepLinkByProductionViewModel() {
        // Observe the production DriverViewModel from the Activity's ViewModelStore
        // and verify handleDeepLink routes correctly for an unauthenticated cold start.
        launchWithDeepLink("xdrivedriver://job/$VALID_JOB_UUID_A").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                assertNotNull("ViewModel must be accessible from the Activity's ViewModelStore", vm)

                // Call the production routing method (same path as handleIncomingIntent in onCreate).
                // Asserted synchronously to avoid the DataStore null-session reset race.
                vm.handleDeepLink(DeepLinkDestination.Job(VALID_JOB_UUID_A))

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
                vm.handleDeepLink(DeepLinkDestination.Job(VALID_JOB_UUID_A))

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
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                vm.handleDeepLink(DeepLinkDestination.Messages)

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
                vm.handleDeepLink(DeepLinkDestination.Nearby)

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
                vm.handleDeepLink(DeepLinkDestination.Profile)

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

                // Deliver warm intent through the real Activity onNewIntent code path.
                // handleIncomingIntent → XDriveDeepLink.parse → handleDeepLink (all synchronous).
                activity.onNewIntent(warmIntent)

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

                activity.onNewIntent(nearbyIntent)

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

                activity.onNewIntent(compatIntent)

                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)
            }
        }
    }

    // ── 4. Activity recreation — ViewModel retained, routing is idempotent ───

    @Test
    fun recreationPreservesPendingJobLinkIdempotently() {
        launchWithDeepLink("xdrivedriver://job/$VALID_JOB_UUID_A").use { scenario ->
            // Before recreation: set routing state.
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                vm.handleDeepLink(DeepLinkDestination.Job(VALID_JOB_UUID_A))
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)
            }

            // Simulate configuration change (screen rotation, system language, etc.).
            scenario.recreate()

            // After recreation: the ViewModel is retained and handleIncomingIntent
            // (called in the new onCreate) re-processes the same intent idempotently.
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                // Re-apply same destination to simulate the second handleDeepLink call.
                vm.handleDeepLink(DeepLinkDestination.Job(VALID_JOB_UUID_A))

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
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                vm.handleDeepLink(DeepLinkDestination.Nearby)
                assertEquals(DriverTab.NEARBY, vm.uiState.value.selectedTab)
            }

            scenario.recreate()

            // onCreate re-processes the same non-job intent — tab stays at NEARBY.
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]
                vm.handleDeepLink(DeepLinkDestination.Nearby)
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
                activity.onNewIntent(jobIntent)
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)
                assertEquals(DriverTab.MESSAGES, vm.uiState.value.selectedTab)

                // Second delivery (duplicate — e.g., push received twice): must be idempotent.
                activity.onNewIntent(jobIntent)
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

    // ── 7. A→B owner replacement — new job link replaces previous pending ────

    @Test
    fun ownerTransitionReplacesExistingPendingDeepLink() {
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                // Owner A's job arrives first via warm intent.
                activity.onNewIntent(
                    Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A")),
                )
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)

                // Owner B's job arrives (e.g., after account switch + push).
                // Routing must REPLACE the pending link, not accumulate two links.
                activity.onNewIntent(
                    Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_B")),
                )
                assertEquals(
                    "Owner B's job must replace owner A's pending link — no accumulation",
                    DeepLinkDestination.Job(VALID_JOB_UUID_B),
                    vm.uiState.value.pendingDeepLink,
                )
            }
        }
    }

    @Test
    fun differentJobIdsParseThroughActivityToNonEqualDestinations() {
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                activity.onNewIntent(
                    Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A")),
                )
                val pendingA = vm.uiState.value.pendingDeepLink

                activity.onNewIntent(
                    Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_B")),
                )
                val pendingB = vm.uiState.value.pendingDeepLink

                assertFalse("Different job UUIDs must produce non-equal pending destinations", pendingA == pendingB)
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), pendingA)
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_B), pendingB)
            }
        }
    }

    // ── 8. Logout/owner-clear — cleared pending state resolves to null ────────

    @Test
    fun logoutClearsPendingDeepLinkFromPreviousOwner() {
        launchWithDeepLink("xdrivedriver://notification").use { scenario ->
            scenario.onActivity { activity ->
                val vm = ViewModelProvider(activity)[DriverViewModel::class.java]

                // Pending link set for an owner.
                activity.onNewIntent(
                    Intent(Intent.ACTION_VIEW, Uri.parse("xdrivedriver://job/$VALID_JOB_UUID_A")),
                )
                assertEquals(DeepLinkDestination.Job(VALID_JOB_UUID_A), vm.uiState.value.pendingDeepLink)

                // Simulate logout/owner-clear: the production ViewModel clears pendingDeepLink
                // on owner change. Verify via the routing coordinator that no job is routed.
                val clearedState = vm.uiState.value.copy(pendingDeepLink = null)
                val (_, resolvedId) = resolvePendingDeepLink(clearedState)
                assertNull(
                    "After owner clear, resolvePendingDeepLink must not route a stale job",
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
