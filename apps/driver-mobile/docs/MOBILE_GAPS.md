# XDrive Driver Preview (Expo) — Feature Gap Matrix

> **Note**: This document tracks the preview Expo/React Native app (`apps/driver-mobile`, package `co.uk.xdrivelogistics.driver.preview`).
> The canonical production Android application is the Kotlin/Jetpack Compose project under `android-native/` (package `co.uk.xdrivelogistics.driver`).

Audit baseline:
- Branch: `copilot/transform-mobile-workspace-driver`
- Commit: `27401185a045e2e014c943dfad1fb24491d7689b`
- Scope: Expo preview app under `apps/driver-mobile` vs required operational parity.

## Native-vs-web and required-feature gaps

| Gap ID | Feature | Current native state | Severity | Required API | Required screen/workflow | Required validation | Blocks APK release |
|---|---|---|---|---|---|---|---|
| MG-001 | Canonical lifecycle parity (`posted→...→delivered`) | ✅ Implemented: `accept`, `on_my_way_to_pickup`, `on_site_pickup`, `loaded`, `on_my_way_to_delivery`, `on_site_delivery`, `delivered` + idempotency check BEFORE lifecycle guard | P0 | `POST /api/driver/mobile/jobs/:id/:action` | Active Job + state engine | Full transition matrix with idempotency and invalid-transition tests | Yes |
| MG-002 | Queue isolation per account | ✅ Implemented: per-user keys, `ownerUserId` filtering, `withQueueLock` serialisation, legacy items discarded | P0 | Queue persistence model (`AsyncStorage`) + sync worker | Offline queue subsystem | Multi-account switch with pending queue persistence tests | Yes |
| MG-003 | Build pipeline correctness | ✅ Implemented: invalid `splits` config removed; EAS profiles clean | P0 | EAS config | Build configuration | `npx eas-cli config`, preview build smoke test | Yes |
| MG-004 | Offline quote submission | ✅ Implemented: `bid` endpoint queued offline, replayed by `flushQueue`, `podKey` dedup | P1 | `POST /api/driver/mobile/bids` + client queue integration | Live Loads quote flow | Offline/online replay tests, duplicate suppression | Yes |
| MG-005 | Notification deep-link lifecycle | ✅ Implemented: push-tap routing for foreground/background/cold-start; `pendingDeepLinkJobIdRef` for pre-auth links | P1 | Notification payload contract + job fetch endpoint | Notifications + app entry routing | Foreground/background/cold-start deep-link tests | Yes |
| MG-006 | Multi-active job handling | ✅ Implemented: multiple active jobs navigate to list view, `setJob(null)` prevents silent first-item select | P1 | Jobs listing endpoint + selection rules | Active Job / My Jobs | Multiple allocated jobs conflict tests | Yes |
| MG-007 | Job detail operational completeness | ✅ Implemented: postcodes, coordinates, cargo dimensions, weight, distance, separate pickup/delivery contacts, load details, special requirements, access restrictions | P1 | `GET /api/driver/mobile/jobs/:id` | Job Detail | Field completeness + authorization masking tests | Yes |
| MG-008 | POD idempotent re-submit protection | ✅ Implemented: `pod_generated === true` gate on server; per-form `podKey` dedup in client queue | P1 | `POST /api/driver/mobile/jobs/:id/pod` | POD | Duplicate submission/idempotency contract tests | Yes |
| MG-009 | Driver availability management | ✅ Implemented: `GET/PUT /api/driver/mobile/availability` backed by `driver_availability_slots` + `availability_status`; native screen with status toggle and weekly AM/PM/Evening grid | P2 | `/api/driver/mobile/availability` | Profile/Availability screen | CRUD + schedule contract tests | No |
| MG-010 | Driver messages | ✅ Implemented: `GET/POST /api/driver/mobile/messages` backed by `notification_events`; native screen shows dispatcher messages with read/unread state and mark-all-read | P2 | `/api/driver/mobile/messages` | Messages screen | Send/receive/read-state tests | No |
| MG-011 | Finance detail workflows | ✅ Implemented: native screen shows invoices with net/VAT split, due dates, payment status, and summary stats (outstanding, paid count) | P2 | `/api/driver/finance/invoices` (existing) | Finance screen | Amount parity, status transitions, doc access tests | No |
| MG-012 | Password change flow | ✅ Implemented: `PasswordChangeScreen` with current password, new password, confirmation and Supabase `updateUser` call | P2 | `/api/driver/password` | Profile > Security | Validation + re-auth and token continuity tests | No |

## Release-gate summary

### P0/P1 release blockers — all resolved
- MG-001 ✅ Canonical lifecycle parity + idempotency ordering fixed
- MG-002 ✅ Queue isolation per account
- MG-003 ✅ EAS build pipeline correctness
- MG-004 ✅ Offline quote submission
- MG-005 ✅ Notification deep-link lifecycle
- MG-006 ✅ Multi-active job handling
- MG-007 ✅ Job detail operational completeness
- MG-008 ✅ POD idempotent re-submit protection

### P2 features — all implemented
- MG-009 ✅ Driver availability management (weekly schedule + status toggle)
- MG-010 ✅ Driver messages (dispatcher notifications with read state)
- MG-011 ✅ Finance detail (net/VAT/due dates/summary)
- MG-012 ✅ Password change flow

## Auto-invoice note

Auto-invoice on delivery is intentionally native-only (`autoGenerateMarketplaceInvoice` called after
`delivered` action). The web admin flow requires a manual invoice-creation step. This is a deliberate
product decision, not a gap.

## Evidence references
- `apps/driver-mobile/src/app/DriverMobileApp.tsx`
- `apps/driver-mobile/src/jobs/statusFlow.ts`
- `apps/driver-mobile/src/offline/queue.ts`
- `apps/driver-mobile/src/live-loads/LiveLoadsScreen.tsx`
- `apps/driver-mobile/src/api/availability.ts`
- `apps/driver-mobile/src/api/messages.ts`
- `app/api/driver/mobile/_lib.ts`
- `app/api/driver/mobile/jobs/[id]/[action]/route.ts`
- `app/api/driver/mobile/availability/route.ts`
- `app/api/driver/mobile/messages/route.ts`
- `apps/driver-mobile/eas.json`

