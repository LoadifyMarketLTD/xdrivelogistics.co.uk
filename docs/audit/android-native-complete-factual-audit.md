# XDrive Driver Android — Complete Factual Audit

> **Audit type:** Read-only end-to-end audit  
> **PR:** #323 — Android native phone app: functional audit and corrective implementation  
> **Branch:** `audit/android-native-phone-app`  
> **Produced:** 2026-07-31  
> **Status:** No code was changed.

---

## XDrive Driver Android — Complete Factual Audit

### A. Full screen / composable inventory

| Composable | `DriverTab` / route | Purpose |
|---|---|---|
| `LoginScreen` | (no tab — `!isAuthenticated`) | Email + password login; biometric button present but wired to empty `onClick = {}` (non-functional); "Forgot password?" also empty |
| `DriverAppShell` | wrapper | Header + content area + `BottomNav`; switches on `selectedTab` |
| `NearbyJobsScreen` | `NEARBY` → "Loads" | Live Loads marketplace — Live/Pinned/Hidden tabs, search, filters, `LiveLoadCard` list |
| `MyQuotesScreen` | `QUOTES` → "Offers" | Quote history by status (Submitted/Accepted/Rejected/Withdrawn/Expired); no cancel/withdraw action |
| `BookingsScreen` | `BOOKINGS` (not in bottom nav) | Non-posted jobs by date range; links to `ACTION` tab |
| `MyJobsScreen` | `JOBS` → "Runs" | Non-posted jobs by status filter; links to `ACTION` tab |
| `SmartPayScreen` | `SMARTPAY` (not in bottom nav) | Invoice list with filter tabs; summary metrics |
| `ActionScreen` | `ACTION` (not in bottom nav) | Dispatches to `PostedJobDetailScreen` for posted jobs or job-detail panel (Summary / Stops / Status / POD tabs) with dispatcher message |
| `MessagesScreen` | `MESSAGES` → "Updates" | Notification list (All / Unread / Important); mark-read and delete; send dispatch note |
| `ProfileScreen` | `PROFILE` → "More" | Driver info, GPS tracking start/stop, return journey, SmartPay summary, compliance documents, password change, logout |
| `DashboardScreen` | *dead code — not reachable from any tab* | Stats, availability, next-job card; never shown via `DriverAppShell` switch |

**Bottom nav (5 items):** `primaryBottomNavTabs()` = `[NEARBY, MESSAGES, QUOTES, JOBS, PROFILE]` → labels **Loads / Updates / Offers / Runs / More**. `BOOKINGS`, `SMARTPAY`, `ACTION` are reachable only programmatically.

---

### B. Navigation / routing map

```
App start
 └── SessionStore.session Flow emits:
      null  →  LoginScreen
      non-null → DriverAppShell (default tab: NEARBY / "Loads")

DriverAppShell tab switch:
  NEARBY  → NearbyJobsScreen
  MESSAGES → MessagesScreen
  QUOTES  → MyQuotesScreen
  JOBS    → MyJobsScreen → tapping job: selectJob + changeTab(ACTION)
  PROFILE → ProfileScreen

NearbyJobsScreen (Live Loads):
  Card tapped    → openActionForJob(jobId, DETAILS) → tab = ACTION, mode = DETAILS
  Quote tapped   → openActionForJob(jobId, QUOTE)   → tab = ACTION, mode = QUOTE

ActionScreen (job is posted && mode == QUOTE):
  PostedJobDetailScreen(openQuoteFirst = true) — quote form shown first
ActionScreen (job is posted && mode == DETAILS):
  PostedJobDetailScreen(openQuoteFirst = false) — load details shown first
ActionScreen (job not posted):
  Summary / Stops / Status / POD segmented tabs + dispatcher message

BookingsScreen / MyJobsScreen card tap:
  → viewModel.selectJob(id) + viewModel.changeTab(ACTION)

ProfileScreen: GPS Start/Stop, logout, document upload — stay on PROFILE
```

---

### C. Authentication and session lifecycle

| Stage | Implementation |
|---|---|
| **Persisted store** | `EncryptedSharedPreferences` (AES256_GCM key, AES256_SIV+GCM values) — `xdrive_secure_session` file; keys: `access_token`, `refresh_token`, `user_id`, `email` |
| **On app start** | `DriverViewModel.init` collects `SessionStore.session` Flow; if non-null → `isAuthenticated = true`, calls `refreshDriverData()` + `startLiveRefresh()` |
| **Login** | POST `/auth/v1/token?grant_type=password` with `apikey` + JSON `{email, password}`; extracts `access_token`, `refresh_token`, `user.id`; saves to `SessionStore`; `isLoading` disabled during flight, button disabled while loading (prevents double-tap) |
| **Session restore** | Immediate on init from SharedPreferences without network round-trip; `isAuthenticated` set synchronously from stored tokens |
| ******** | `supabaseRequest()` helper: `Authorization: ******; all inline Supabase calls use same pattern; XDrive API calls (`/api/driver/*`) also use `****** The Supabase `apikey` header is correctly set to `supabaseAnonKey` (required by Supabase PostgREST in addition to Bearer) |
| **Live refresh** | Coroutine loop every 30 s (`startLiveRefresh`); checks current session token hasn't changed and `!isLoading` before polling |
| **Token refresh** | `refreshAndRetry(session)` — POST `/auth/v1/token?grant_type=refresh_token`; on success saves new tokens + retries data load with `allowRefresh = false`; on failure → `sessionStore.clear()` + `DriverUiState(error = "Your session expired.")` |
| **Logout** | Cancels live-refresh job; calls `sessionStore.clear()`; Flow emits null → `_uiState.value = DriverUiState()` → `isAuthenticated = false` → `LoginScreen` |
| **Offline startup** | If stored session exists and network is unavailable, app shows authenticated shell and `refreshDriverData()` fails → snackbar error. No explicit offline/reconnecting interstitial state; user stays on `NearbyJobsScreen` with empty list and error toast |
| **Concurrent refresh risk** | ⚠️ No mutex or singleton refresh job. If multiple concurrent requests each get 401 and each call `refreshAndRetry`, each will independently attempt a token refresh. In practice the 30-s poll is guarded by `!isLoading`, but a manual refresh + poll race is theoretically possible |
| **First authenticated screen** | ✅ `DriverTab.NEARBY` is the `DriverUiState` default — driver enters directly into Live Loads marketplace, no intermediate dashboard or onboarding screen |

---

### D. API client — all endpoints

| Method | URL | Auth | Purpose |
|---|---|---|---|
| POST | `{SUPABASE_URL}/auth/v1/token?grant_type=password` | `apikey` only | Login |
| POST | `{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token` | `apikey` only | Token refresh |
| GET | `{SUPABASE_URL}/rest/v1/drivers?select=...&user_id=eq.{uid}` | ****** apikey | Resolve driver profile |
| GET | `{SUPABASE_URL}/rest/v1/vehicles?select=...&assigned_driver_id=eq.{id}&company_id=eq.{id}` | ****** apikey | Load vehicle |
| GET | `{SUPABASE_URL}/rest/v1/driver_documents?select=...&driver_id=eq.{id}` | ****** apikey | Driver compliance docs |
| GET | `{SUPABASE_URL}/rest/v1/vehicle_documents?select=...&vehicle_id=eq.{id}` | ****** apikey | Vehicle docs |
| GET | `{SUPABASE_URL}/rest/v1/driver_job_search_preferences?select=job_id,state&driver_id=eq.{id}` | ****** apikey | Load pin/hide preferences |
| GET | `{SUPABASE_URL}/rest/v1/job_bids?select=...&or=(bidder_user_id.eq..,bidder_driver_id.eq..,company_id.eq..)` | ****** apikey | Load driver bids/quotes |
| GET | `{SUPABASE_URL}/rest/v1/notifications?select=...&user_id=eq.{id}` | ****** apikey | Load notifications |
| PATCH | `{SUPABASE_URL}/rest/v1/notifications?id=eq.{id}&user_id=eq.{id}` | ****** apikey | Mark notification read |
| DELETE | `{SUPABASE_URL}/rest/v1/notifications?id=eq.{id}&user_id=eq.{id}` | ****** apikey | Delete notification |
| GET | `{SUPABASE_URL}/rest/v1/return_journeys?select=...&driver_id=eq.{id}` | ****** apikey | Load return journey |
| DELETE + POST | `{SUPABASE_URL}/rest/v1/return_journeys` | ****** apikey | Replace return journey |
| GET | `{SUPABASE_URL}/rest/v1/invoices?select=...&company_id=eq.{id}` | ****** apikey | Load invoices |
| GET | `{SUPABASE_URL}/rest/v1/drivers?company_id=eq.{id}` | ****** apikey | Nearby driver names |
| GET | `{SUPABASE_URL}/rest/v1/vehicles?company_id=eq.{id}` | ****** apikey | Nearby driver vehicles |
| GET | `{SUPABASE_URL}/rest/v1/driver_locations?company_id=eq.{id}&order=recorded_at.desc` | ****** apikey | Nearby driver locations |
| POST | `{SUPABASE_URL}/rest/v1/driver_job_search_preferences?on_conflict=driver_id,job_id` | ****** apikey | Upsert pin/hide |
| DELETE | `{SUPABASE_URL}/rest/v1/driver_job_search_preferences?driver_id=eq.{id}&job_id=eq.{id}` | ****** apikey | Restore (delete preference) |
| POST | `{SUPABASE_URL}/storage/v1/object/{driver-docs or vehicle-docs}/{path}` | ****** apikey | Upload compliance doc |
| POST | `{SUPABASE_URL}/rest/v1/{driver_documents or vehicle_documents}` | ****** apikey | Link compliance doc record |
| GET | `{SUPABASE_URL}/rest/v1/jobs?select=...&or=(status.eq.posted,assigned_driver_id.eq..,assigned_company_id.eq..,awarded_carrier_company_id.eq..)` | ****** apikey | Load all jobs (posted + assigned) |
| POST | `{SUPABASE_URL}/rest/v1/job_bids` | ****** apikey | Submit quote |
| POST | `{XDRIVE_BASE_URL}/api/driver/jobs/{id}/notes` | ****** API) | Send dispatcher note |
| POST | `{XDRIVE_BASE_URL}/api/driver/location` | ****** API) | Publish location |
| POST | `{XDRIVE_BASE_URL}/api/driver/password` | ****** API) | Change password |
| POST | `{SUPABASE_URL}/rest/v1/rpc/driver_update_job_status_atomic` | ****** apikey | Advance job status (RPC) |
| POST | `{SUPABASE_URL}/storage/v1/object/pod-docs/{path}` | ****** apikey | Upload POD/collection photo |
| PATCH | `{SUPABASE_URL}/rest/v1/jobs?id=eq.{id}&assigned_driver_id=eq.{id}` | ****** apikey | Link POD to job |
| PATCH | `{SUPABASE_URL}/rest/v1/jobs?id=eq.{id}&assigned_driver_id=eq.{id}` | ****** apikey | Confirm delivery recipient |
| GET | `https://api.postcodes.io/postcodes/{postcode}` | none | Distance estimation (public API) |

**Error handling:** All calls are wrapped in `networkResult { }` → `withContext(Dispatchers.IO) { runCatching { } }`. HTTP errors extract `error` or `message` from JSON body. 401/JWT/token errors trigger session refresh or logout via `isSessionError()` / `friendlyDriverMessage()`.

---

### E. Data models

| Model | Key fields |
|---|---|
| `DriverSession` | `accessToken`, `refreshToken`, `userId`, `email` |
| `DriverProfile` | `driverId`, `companyId`, `vehicleId?`, `displayName`, `email`, `vehicleLabel`, `vehicleRegistration` |
| `DriverJob` | `id`, `status`, `currentStatus`, `pickupLocation`, `deliveryLocation`, `pickupDatetime?`, `deliveryDatetime?`, `clientName`, `clientPhone`, `vehicleType`, `cargoType`, `budgetAmount?`, `loadDetails` (JSON string), `pickupPostcode`, `deliveryPostcode`, `distanceMiles?`, `pickupDistanceFromActiveDeliveryMiles?`, `deliveryPhotos`, `podPhotos`, `collectionPhotoUrl?`, `deliverySignatureData?`, `clientSignatureName`, `podRequired` |
| `DriverDocument` | `id`, `docType`, `status`, `createdAt?`, `expiryDate?`, `isVehicleDocument` |
| `DriverBid` | `id`, `jobId`, `amount?`, `currency`, `status`, `message`, `createdAt?`, `pickupLocation`, `deliveryLocation`, `pickupDatetime?`, `clientName` |
| `DriverNotification` | `id`, `title`, `body`, `type`, `readAt?`, `createdAt?` |
| `DriverReturnJourney` | `id`, `fromLocation`, `toLocation`, `availableDate?` |
| `DriverInvoice` | `id`, `invoiceNumber`, `status`, `amount?`, `currency`, `clientName`, `dueDate?` |
| `NearbyDriver` | `driverId`, `driverName`, `vehicleLabel`, `lat?`, `lng?`, `recordedAt?` |
| `DriverPreferences` | `notifyTracked`, `emailNotifications` (model exists; not actively fetched or displayed) |
| `PendingLocation` | `latitude`, `longitude`, `capturedAtEpochMs` — 10-min freshness guard |

---

### F. ViewModel state (`DriverUiState`)

```
isLoading: Boolean        — global spinner/button-disabled gate
isAuthenticated: Boolean  — Login vs DriverAppShell switch
session: DriverSession?   — current tokens
profile: DriverProfile?   — resolved driver + vehicle identity
jobs: List<DriverJob>     — all jobs (posted + assigned)
documents: List<DriverDocument>
bids: List<DriverBid>
notifications: List<DriverNotification>
returnJourney: DriverReturnJourney?
invoices: List<DriverInvoice>
nearbyDrivers: List<NearbyDriver>
jobSearchPreferences: Map<String,String>  — pin/hide state keyed by jobId
selectedTab: DriverTab    — default NEARBY
selectedJobId: String?    — job targeted by Quote/details/status actions
actionEntryMode: ActionEntryMode  — DETAILS or QUOTE
message: String           — success snackbar
error: String             — error snackbar
```

Events: `login`, `logout`, `changeTab`, `selectJob`, `openActionForJob`, `refreshDriverData`, `moveSelectedJobTo`, `submitQuoteForSelectedJob`, `uploadPodForSelectedJob`, `confirmDeliveryRecipientForSelectedJob`, `uploadComplianceDocument`, `setJobSearchPreference`, `sendQuickNote`, `markAlertRead`, `deleteAlert`, `saveReturnJourney`, `sendLocation`, `updatePassword`.

---

### G. Live Loads (NearbyJobsScreen)

- Filters `jobs` to `isPosted()` only
- Computes `pickupDistanceFromActiveDeliveryMiles` from active delivery postcode via `postcodes.io` + Haversine × 1.22 routing factor
- Applies `LiveLoadsBox` (LIVE/PINNED/HIDDEN) using `jobSearchPreferences`
- Search: client name, postcode, location, loadDetails, ID
- Date filter: Any / Today / Tomorrow / This week (Europe/London)
- Vehicle and freight type filters from distinct job values
- Sort: Collection (pickup datetime) or Nearest (distance)
- Card: `LiveLoadCard` (dark XDrive theme, yellow border if selected, route connector with green/red markers, Quote button, Pin/Hide/Restore actions)
- Quote tap → `openActionForJob(jobId, QUOTE)` → `ActionScreen` → `PostedJobDetailScreen(openQuoteFirst = true)` ✅

---

### H. Job lifecycle status machine

**Client normalisation (`DriverJob.driverStatusKey()` in Models.kt):**
`assigned/accepted → allocated`, `arrived_pickup → on_site_pickup`, `collected → loaded`, `on_route_delivery/on_my_way_to_delivery → in_transit`, `arrived_delivery → on_site_delivery`

**Next-status chain (`DriverJob.nextStatus()` in Models.kt):**
`allocated/awarded → on_my_way → on_site_pickup → loaded → in_transit → on_site_delivery → delivered → completed`

⚠️ **Discrepancy**: The private extension `DriverJob.nextStatus()` in `MainActivity.kt` maps `loaded → on_site_delivery` (skips `in_transit`), while Models.kt maps `loaded → in_transit → on_site_delivery`. The private extension shadows Models.kt in UI scope; `isValidTransition()` in ViewModel uses Models.kt chain for server-side validation. These are inconsistent and should be reconciled.

**Blocking requirements:**
- `loaded`: requires `collectionPhotoUrl` set
- `delivered`: requires `podPhotos` or `deliveryPhotos` non-empty, `clientSignatureName` non-blank, `deliverySignatureData` non-null (if `podRequired`)

**Server call:** `driver_update_job_status_atomic(p_driver_id, p_job_id, p_next_status)` RPC — atomic; returns `{ok: Boolean}`.

---

### I. GPS / tracking

**`TrackingService`** (foreground service, `START_STICKY`):
- Reads session from `SessionStore` directly (independent of ViewModel)
- Captures GPS via `FusedLocationProviderClient.getCurrentLocation(BALANCED_POWER_ACCURACY)` every 60 s
- Saves to `PendingLocationStore` (SharedPreferences); freshness window 10 min
- Uploads via `ApiClient.sendLocation` → `POST /api/driver/location ******
- On 401: attempts token refresh inline within service; on refresh failure → `AUTH_REQUIRED` → stops service
- On network failure: `RETRY` → 15-s wait, retries with same pending location

**`TrackingPolicy` / `PendingLocation`:** freshness guard, `UploadOutcome` enum, `isAuthenticationFailure()` helper.

**`PendingLocationStore`:** `SharedPreferences` (plaintext); stores `lat`, `lng`, `capturedAtEpochMs`.

**Manual GPS**: "Publish Location" button in ProfileScreen → `fusedClient.lastLocation` one-shot → `viewModel.sendLocation`

---

### J. Notifications / deep links

**Notifications:** Pulled from `rest/v1/notifications` on every refresh; displayed in `MessagesScreen`. Mark-read (PATCH `read_at`), delete (DELETE). No push notification listener, no FCM integration, no `FirebaseMessagingService`. Unread count is not shown in the bottom nav badge.

**Deep links:** No `intent-filter` with `ACTION_VIEW` or custom scheme in `AndroidManifest`. No deep link routing in `MainActivity`. The CI workflow does not test intent handling.

---

### K. SmartPay / Invoices

`SmartPayScreen` queries `rest/v1/invoices?company_id=eq.{id}`. Filters: All / Pending / Awaiting Payment / Paid / Overdue. Shows invoice number, client, status badge, amount, due date. No payment action, no external invoice link. Also summarised in `ProfileScreen` (top 3 invoices + counts). `SMARTPAY` tab not reachable from bottom nav — requires programmatic tab switch (no current caller does this except `DashboardScreen` which is dead code).

---

### L. Documents / Profile / Settings

- **Compliance documents:** Driving Licence, Insurance Certificate, Vehicle Registration, Right to Work, Vehicle MOT; uploaded to Supabase Storage (`driver-docs` / `vehicle-docs`); record inserted to `driver_documents` / `vehicle_documents` with status `pending`
- **Return journey:** Delete-then-insert to `return_journeys` table
- **Password change:** POST `/api/driver/password` XDrive API (not Supabase auth endpoint)
- **Availability:** Local UI state only (`var availability by remember`) — never persisted or synced
- **Nearby drivers:** Loaded but not displayed anywhere in the current UI

---

### M. Offline queue / pending sync

**GPS only:** `PendingLocationStore` queues one location point that survives a retry loop in `TrackingService`. No offline queue for status updates, quotes, notes, or document uploads. If a status update fails, the error is shown as a snackbar and the job remains at its current server state — no retry or local pending indicator.

---

### N. Test coverage

| Test file | What it covers |
|---|---|
| `LiveLoadsComponentsTest.kt` | `filterLiveLoadsByBox` (all three boxes), `liveLoadsCounts`, `applyLiveLoadPreferenceAction`, `toLiveLoadCardData` (company name, reference, vehicle, route, freight, weight normalisation), `primaryBottomNavLabels` order |
| `DriverJobLifecycleTest.kt` | `DriverJob.driverStatusKey()`, `isPosted()`, `isActive()`, `hasPod()`, `statusLabel()`, `nextStatus()`, `nextActionLabel()`, `canMoveNext()`, `blockingRequirementFor()`, `openActionForJob` selects correct job and mode (anti-regression for Quote targeting job B after A selected) |
| `TrackingPolicyTest.kt` | `PendingLocation.isFresh()` (fresh, expired, zero epoch), `isAuthenticationFailure()` for JWT/401/token/unauthorized messages |
| `LiveLoadsCardInteractionTest.kt` | Compose instrumented: Quote/Pin/Hide tap does not bubble to card-open; card tap opens correct job; TBC fallback labels are rendered |
| `PendingLocationStoreInstrumentedTest.kt` | Save/read/clear round-trip on device |

**Not covered:**
- Login success/failure (no unit test for `DriverViewModel.login`)
- Session restore on app restart
- Token refresh and retry
- Concurrent refresh protection
- Status transition validation (`isValidTransition`)
- `moveSelectedJobTo` blocking requirements
- `submitQuoteForSelectedJob` validation
- API client HTTP calls (no mock/fake server)
- `TrackingService` lifecycle
- Deep links (none implemented)
- Biometric auth (not implemented)

---

### O. Build configuration

- `compileSdk = 35`, `targetSdk = 35`, `minSdk = 26` (Android 8.0+)
- `versionCode = 1`, `versionName = "1.0.0"`
- Kotlin Compiler Extension 1.5.14; Compose BOM 2024.09.02
- Key dependencies: `okhttp3:4.12.0`, `gson:2.11.0`, `security-crypto:1.1.0-alpha06` (alpha — not production-stable), `play-services-location:21.3.0`, `coroutines:1.8.1`, `navigation-compose:2.8.0` (imported but not used — Navigation Compose is never called)
- BuildConfig fields: `XDRIVE_BASE_URL` (default `https://www.xdrivelogistics.co.uk`), `SUPABASE_URL` (empty default), `SUPABASE_ANON_KEY` (empty default)
- `isMinifyEnabled = false` for release — no ProGuard/R8 obfuscation currently active

---

### P. Identified gaps and risks (summary)

| # | Area | Finding | Severity |
|---|---|---|---|
| 1 | Biometric login | Button present on `LoginScreen`, `onClick = {}` — non-functional | Medium |
| 2 | Forgot password | Button present on `LoginScreen`, `onClick = {}` — non-functional | Medium |
| 3 | Concurrent token refresh | No mutex; multiple simultaneous 401s could trigger parallel refresh calls | Medium |
| 4 | Offline startup UX | Shows snackbar error but no explicit "offline/reconnecting" state | Low |
| 5 | `nextStatus()` discrepancy | `loaded → in_transit` (Models.kt) vs `loaded → on_site_delivery` (MainActivity extension); server validation uses Models chain | Medium |
| 6 | `DashboardScreen` dead code | Composable defined but unreachable from any navigation path | Low |
| 7 | `DriverPreferences` model unused | Exists in Models.kt; never fetched or displayed | Low |
| 8 | `NearbyDrivers` loaded but never shown | Fetched every refresh; not rendered anywhere | Low |
| 9 | No push notifications / FCM | No `FirebaseMessagingService`; no real-time alerts | High |
| 10 | No deep-link handling | `AndroidManifest` has no intent filter for deep links | Medium |
| 11 | Quote cancellation absent | `MyQuotesScreen` displays bids but has no withdraw/cancel action | Medium |
| 12 | Unread count absent from nav | `MessagesScreen` tab shows no badge for unread notification count | Low |
| 13 | `BOOKINGS` / `SMARTPAY` tabs hidden from nav | Reachable only programmatically; `SMARTPAY` has no current caller | Medium |
| 14 | Offline queue (non-GPS actions) | Status updates, quotes, notes have no retry queue if offline | Medium |
| 15 | `security-crypto` alpha dependency | `1.1.0-alpha06` used in production; stable GA `1.0.0` is available | Low |
| 16 | `navigation-compose` unused | Imported as dependency, never used; app uses direct tab switching | Low |
| 17 | `PostedJobCard` vs `LiveLoadCard` duality | Two separate card designs for the same `isPosted()` jobs depending on which screen renders them | Low |
| 18 | No proactive token expiry check | JWT expiry timestamp is not parsed; refresh only triggered on 401 response | Low |

---

This audit is read-only. No files were modified. Standing by for an explicit implementation instruction before any code changes are made.
