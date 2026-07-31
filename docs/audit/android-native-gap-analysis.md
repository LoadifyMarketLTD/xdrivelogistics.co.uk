# Android Native Kotlin App — Gap Analysis against Phone-Reference UX Concepts

> **Audit type:** Read-only gap analysis  
> **PR:** #323 — Android native phone app: functional audit and corrective implementation  
> **Branch:** `audit/android-native-phone-app`  
> **Produced:** 2026-07-31  
> **Status:** No code was changed.

---

## Android Native Kotlin App — Gap Analysis against Phone-Reference UX Concepts

### 1. Current Kotlin composables/classes/functions serving each listed concept

| Phone-reference concept | Current Kotlin coverage |
|---|---|
| Marketplace inbox / Live loads | `NearbyJobsScreen` (MainActivity.kt ~628) + `LiveLoadCard` / `filterLiveLoadsByBox` / `liveLoadsCounts` (LiveLoadsComponents.kt) |
| Saved (Pinned) loads | `LiveLoadsBox.PINNED` filter + `applyLiveLoadPreferenceAction(PIN)` + `onJobPreference` → `setJobSearchPreference` in ApiClient |
| Deleted (Hidden) loads | `LiveLoadsBox.HIDDEN` filter + `applyLiveLoadPreferenceAction(HIDE/RESTORE)` |
| Quote entry | `PostedJobDetailScreen` with `openQuoteFirst` flag → `QuoteBoxLight`; `QuoteBox` in dark theme |
| Submitted quote state | `DriverBid` model + `MyQuotesScreen` + `QuoteHistoryCard` + `DriverBid.quoteStatusColor()` |
| Quote cancellation | **Gap** — no cancel/withdraw action exists anywhere in the app |
| Alerts / received quotes / unread activity | `MessagesScreen` + `NotificationCard` + `DriverNotification` model; unread badge count absent from bottom nav |
| Bookings: current and history | `BookingsScreen` with tabs Current / Past 7 Days / Past 14 Days / History + `BookingCard` |
| Awarded/active booking summary | `ActionScreen` → `JobSummaryPanel` (summary tab) |
| Stops | `ActionScreen` → `JobStopsPanel` + `StopCard` |
| Status tabs | `ActionScreen` → `SegmentedTabs("Summary","Stops","Status","POD")` + `JobStatusPanel` |
| Company/load identity | `PostedJobDetailScreen` uses `marketplaceTitle()` / `marketplaceMeta()` / `marketplaceBadges()` |
| Pickup/delivery stops | `StopCard` (number, address, time, contact, navigate button) |
| Map action | `onNavigateTo` → `geo:0,0?q=` intent; opens external maps app, no in-app map |
| Distance | `DriverJob.distanceLabel()` extracts from `load_details` or `distanceMiles` field |
| Notes / payment information | `JobSummaryPanel` shows `loadDetails` raw; no structured payment display |
| Attachments: add document | `onPickPodFile` / `onCapturePodPhoto` → `uploadPodForSelectedJob` (POD only); compliance docs in ProfileScreen |
| Attachments: add image | Camera via `podCameraLauncher` → `createPodPhotoUri()` (POD only); no general image attach |
| Attachment removal | **Gap** — no delete action for uploaded POD photos or compliance documents |
| Journey status progression | `StatusTimeline` visual + `nextStatus()` / `nextActionLabel()` / `canMoveNext()` / `blockingRequirementFor()` |
| Next permitted operational action | `moveSelectedJobTo(nextStatus())` button in `JobStatusPanel`; guards via `blockingRequirementFor()` |
| Persistent five-item bottom nav | `BottomNav` renders `primaryBottomNavTabs()` = `[NEARBY, MESSAGES, QUOTES, JOBS, PROFILE]` → labels `Loads / Updates / Offers / Runs / More` ✅ |

---

### 2. Existing API/model support and missing contracts

**Present in ApiClient.kt / Models.kt:**
- `login` / `refreshSession` / Supabase auth flow
- `resolveDriverProfile` (joins vehicles)
- `loadAssignedJobs` (posted + assigned + company-awarded)
- `submitJobQuote` → `job_bids` upsert
- `loadDriverBids` (with job join)
- `updateJobStatus` → XDrive `/api/driver/jobs/:id/status`
- `uploadPodDocument` / `confirmDeliveryRecipient`
- `uploadComplianceDocument` (Storage + table insert)
- `loadDriverNotifications` / `markNotificationRead` / `deleteNotification`
- `setJobSearchPreference` (pin/hide/restore, upsert with `on_conflict`)
- `sendLocation` / `sendQuickNote`
- `loadDriverInvoices` / `loadReturnJourney` / `saveReturnJourney`

**Missing contracts (no method in ApiClient or ViewModel):**
- Quote cancellation / withdrawal (`DELETE` or status patch on `job_bids`)
- Notification mark-all-read (only single-item `markNotificationRead`)
- FCM token registration (no `POST /api/driver/fcm-token` or Supabase equivalent)
- Deep-link routing into a specific job from a push notification
- Offline action queue / PendingActionStore (no local queue; `PendingLocationStore.kt` only handles location)
- In-app map / route polyline (only external geo: intent)
- Biometric/fingerprint authentication (button exists in `LoginScreen` but `onClick = { }` is a no-op)
- Password-reset / forgot-password flow (`TextButton(onClick = { })` is a no-op)
- `awarded` status acknowledgement — `Model.nextStatus()` maps `"awarded" -> "on_my_way"` skipping an explicit Accept-Job step

---

### 3. Functional gaps versus `docs/audit/08-android-functional.md`

| Audit ID | Requirement | Gap |
|---|---|---|
| AND-01-03 | Fetch config from `/api/driver/mobile/config` at runtime | BuildConfig bakes in values at compile time; no runtime config fetch |
| AND-02-02/03 | Specific error messages (wrong password / non-driver account) | Single generic `IllegalStateException(extractError(...))` — no error code routing |
| AND-02-04/05 | Session persists and restores across kills/reboots | `SessionStore` uses `EncryptedSharedPreferences`; `collectLatest` in `init {}` restores if keys present ✅ — but there is **no token-validity pre-check** before showing the main screen; an expired non-refreshable token will only fail on the first data fetch |
| AND-02-07 | `Authorization: ****** on all API calls | `supabaseRequest` helper sets the header correctly; `markNotificationRead` / `deleteNotification` / `saveReturnJourney` / etc. contain a hardcoded placeholder `"******"` string where the ****** should appear (this is a real defect visible in the source) |
| AND-03-06/07 | Swipe right = Pin, swipe left = Hide | No swipe gesture; actions are buttons inside the card |
| AND-03-04/05 | Pull-to-refresh | No `SwipeRefresh` wrapper; only a manual Refresh `TextButton` in the app header |
| AND-04-02 | Quote panel slides up on card tap | `openActionForJob(QUOTE)` navigates to `PostedJobDetailScreen` full-screen; no bottom-sheet slide-up |
| AND-04-05 | Duplicate-quote idempotency guard | No client-side idempotency key; `submitJobQuote` uses plain insert; risk of duplicate bids on double-tap |
| Offline queue | Pending-sync state for queued actions | Only `PendingLocationStore` queues location pings; no queue for status updates, POD uploads, or quotes |
| FCM | Push notifications + deep links | `TrackingService` exists for GPS; no Firebase Messaging service or deep-link `IntentFilter` in manifest |
| Quote cancel | Withdraw a submitted quote | No UI or API method |
| Attachment delete | Remove uploaded POD or compliance doc | No UI or API method |
| Biometrics | Fingerprint login | No-op button |
| Forgot password | Reset password flow | No-op button |
| Accept Job | Explicit "Accept" step between awarded and on_my_way | Missing; model jumps directly `awarded → on_my_way` |

---

### 4. UX gaps visible on small phones

| Location | Issue |
|---|---|
| `NearbyJobsScreen` header area | `LiveLoadsSegmentedTabs` + count row + search field + 6 `LazyRow` filter pills appear before the first card; on a 5" phone this could scroll the first card below the fold |
| `PostedJobDetailScreen` | Uses a white `Color(0xFFF2F4F8)` light background that breaks the XDrive dark theme; the screen is visually inconsistent with all other screens |
| `ActionScreen` detail tabs | `SegmentedTabs("Summary","Stops","Status","POD")` uses a `LazyRow` with no size constraints; on narrow screens "POD" tab may be cut off |
| `JobStopsPanel` | Raw ISO datetime strings are passed to `InfoLine` for collection/delivery time without formatting |
| `BottomNav` | No icon, only text; active item has background highlight but no icon differentiation; small phones with system navigation bars may overlap the bottom nav if `navigationBarsPadding` is absent |
| `MessagesScreen` | Notifications are listed with full body text; no `maxLines` limit means a long notification body can push other items off-screen |
| `LoginScreen` biometrics button | Visible but non-functional; misleading UX |
| Quote amount field | No currency symbol visible in `QuoteBox` (dark theme); `QuoteBoxLight` has `GBP` prefix; inconsistent |
| Missing unread badge | `Messages` / `Updates` nav item has no badge count; drivers won't know how many unread alerts exist without tapping the tab |

---

### 5. Proposed implementation sequence (first task recommended, not implemented)

The gaps above map to the following priority order, keeping each task to a small, isolated file set:

| # | Task | Files affected | Risk |
|---|---|---|---|
| **1** | **Fix ****** in all API write methods** (`markNotificationRead`, `deleteNotification`, `saveReturnJourney`, storage upload, etc.) | `ApiClient.kt` only | Low — pure substitution |
| 2 | Authentication error routing (invalid credentials vs no-driver-account vs network) | `ApiClient.kt`, `DriverViewModel.kt` | Low |
| 3 | Token validity pre-check on session restore (show connecting state, not main screen, until first profile call succeeds) | `DriverViewModel.kt`, `MainActivity.kt` | Medium |
| 4 | Offline action queue for status updates and quote submission (PendingActionStore pattern) | New file `PendingActionStore.kt`, `DriverViewModel.kt` | Medium |
| 5 | FCM registration + deep-link routing (new `FirebaseMessagingService` subclass + manifest changes) | New file + `AndroidManifest.xml` | Medium |
| 6 | Accept Job step (`awarded → accepted` explicit state before `on_my_way`) | `Models.kt`, `DriverViewModel.kt`, `MainActivity.kt` | Low–Medium |
| 7 | Duplicate-quote guard (idempotency key or submit-once debounce) | `ApiClient.kt`, `DriverViewModel.kt` | Low |
| 8 | Quote cancellation UI + API call | `ApiClient.kt`, `DriverViewModel.kt`, `MainActivity.kt` | Low |
| 9 | Pull-to-refresh (`SwipeRefresh` wrapper on `NearbyJobsScreen` and `MyJobsScreen`) | `MainActivity.kt` | Low |
| 10 | Unread notifications badge on bottom nav | `MainActivity.kt`, `DriverUiState` | Low |

**Recommended first task:** **Fix ****** substitution in all API write methods** — this is a CRITICAL security defect (authenticated write requests are sent with a placeholder value instead of the actual user token), it is limited entirely to `ApiClient.kt`, and it is the only change that must land before any other authenticated feature can be considered production-safe.

---

### 6. Exact files that would be modified for the first task

`android-native/app/src/main/java/co/uk/xdrivelogistics/driver/data/ApiClient.kt`

The `supabaseRequest()` private helper already sets `Authorization: ****** correctly for read operations. All write helpers (`markNotificationRead`, `deleteNotification`, `saveReturnJourney` × 2, `setJobSearchPreference` × 2, `uploadComplianceDocument` × 2, `uploadPodDocument`, `confirmDeliveryRecipient`, `updateJobStatus`, `sendLocation`, `sendQuickNote`, `updatePassword`) contain a hardcoded string `"******"` in place of `"******"`. Each of those lines needs to be replaced with the correct token value, mirroring the `supabaseRequest` helper pattern. No production Kotlin outside that one file needs to change.

---

No code was committed. Awaiting explicit implementation instruction before proceeding.
