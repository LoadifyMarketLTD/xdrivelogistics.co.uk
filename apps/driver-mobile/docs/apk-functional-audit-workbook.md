# XDrive Driver Mobile — Full Functional Audit Workbook

> Scope note: this workbook audits the Expo preview app under `apps/driver-mobile` (`co.uk.xdrivelogistics.driver.preview`), not the canonical production Android app under `android-native/` (`co.uk.xdrivelogistics.driver`).

## Audit scope guard
- PR #301 is **not** treated as complete in this audit.
- Full app surface reviewed under `apps/driver-mobile` and mobile API routes.
- Production data was **not** modified.

## 1) Audit baseline

| Field | Value |
|---|---|
| Audit ID | DMA-2026-07-26-01 |
| Branch | `copilot/transform-mobile-workspace-driver` |
| Commit SHA | `27401185a045e2e014c943dfad1fb24491d7689b` |
| App package | `co.uk.xdrivelogistics.driver.preview` |
| Deep link scheme | `xdrivedriver://` |
| API base URL | `https://www.xdrivelogistics.co.uk` |
| Supabase config source | Runtime `/api/driver/mobile/config` fallback to Expo env |
| Build profile targets | `preview` (APK), `production` (AAB) |
| Test environment | Sandbox CI shell + Playwright API contract tests |
| Production mutation safety | No destructive production calls executed |
| APK/build identifier | BLOCKED (EAS auth token unavailable in sandbox) |

### Baseline files reviewed
- `apps/driver-mobile/README.md`
- `apps/driver-mobile/docs/apk-functional-audit-workbook.md`
- `apps/driver-mobile/app.config.ts`
- `apps/driver-mobile/eas.json`
- `apps/driver-mobile/package.json`
- All files under `apps/driver-mobile/src`

---

## 2) Authentication audit

| Check | Result | Evidence |
|---|---|---|
| Startup with no saved session | PARTIAL | App starts at `screen='login'`; session clear path exists (`DriverMobileApp.tsx`). Not executed on device. |
| Valid login | BLOCKED | Requires staged driver credentials + device runtime. |
| Invalid password | PARTIAL | Supabase sign-in error surfaced to UI message (`signIn`). Not executed with real bad password. |
| Non-driver rejection | PASS | Explicit profile role gate in `validateDriverRole`; signs out and blocks access. |
| Missing profile handling | PASS | `validateDriverRole` returns null, access denied path enforced. |
| Expired token handling | PARTIAL | API helpers throw expired-session errors; auth state listener resets login. Runtime not executed end-to-end. |
| Persistent login after close/reopen | BLOCKED | SecureStore + Supabase persistence present; no device restart execution evidence. |
| Session restoration | PARTIAL | Boot `supabase.auth.getSession()` path implemented. No device execution evidence. |
| Logout | PARTIAL | `signOut()` clears session token + queue + local state. No runtime execution evidence. |
| Auth loading state | PASS | `loading` state toggles and login button text/disabled state wired. |
| Network failure during login + retry | PARTIAL | Error surfaced from Supabase; retry possible by pressing Sign in again. Not executed with forced offline toggle. |
| Session isolation between users | FAIL | Offline queue key is global (`xdrive.driver.offlineQueue`) and not user-scoped; cross-account leakage risk. |

---

## 3) Screen-by-screen functional matrix

Legend: **PASS / FAIL / BLOCKED / NOT IMPLEMENTED / PARTIAL**

| Screen | Open/navigation | Loading/empty/error/retry | Controls & states | Back/keyboard/scroll/render | Result |
|---|---|---|---|---|---|
| Login | Implemented | Loading + message states implemented | Disabled Sign in until inputs present | Keyboard/render not executed on device | PARTIAL |
| Live Loads | Implemented via bottom nav | Pull-to-refresh + error + empty text implemented | Quote/pin/hide/restore controls implemented | Gestures/render/back not device-validated | PARTIAL |
| Active Job | Implemented | Loading via parent + empty fallback screen | Primary transition + detail + POD + queue controls | Back/scroll/small-screen not executed | PARTIAL |
| My Jobs | Implemented | Empty state implemented; refresh via scope change | Scope tabs + row open implemented | Back behavior not executed | PARTIAL |
| Job Detail | Implemented | Renders with optional fields | Back-to-active button implemented | Small-screen/keyboard N/A not executed | PARTIAL |
| POD | Implemented | Validation alerts + offline queue fallback implemented | Photo/doc/signature/recipient/notes/clear signature/save | Camera/file picker/signature runtime not executed on device | PARTIAL |
| Notifications | Implemented | Empty and populated list states implemented | Open-related-job action only for job entity | Deep-link lifecycle not fully implemented | PARTIAL |
| Profile | Implemented | Refresh + data panels + queue panel | Sign out present | Full dataset accuracy requires live staged data | PARTIAL |

Critical blocker: no device/e2e native execution evidence for Android back behavior, keyboard overlap, accessibility traversal, and crash-free interaction loops.

---

## 4) Live Loads & quoting audit

| Check | Result | Evidence |
|---|---|---|
| Authenticated source endpoint | PASS | `GET /api/driver/mobile/nearby-jobs` with bearer token from Supabase session. |
| Display of pickup/delivery/date/vehicle/price | PARTIAL | Mapping exists; values depend on backend payload; no live fixture validation screenshots. |
| Pin/hide/restore | PARTIAL | Local preference state + swipe handlers implemented; no runtime execution capture. |
| Search/filters | FAIL | API supports `search`/`radius`/`mode`; native UI has no search/filter controls. |
| Open correct job for quote | PARTIAL | Quote modal bound to selected job in component state. |
| Fixed-price/proposed-price accept | PARTIAL | Proposed price prefill + accept button implemented. |
| Free-form quote | PARTIAL | Amount + message submit implemented. |
| Validation empty/zero/negative/invalid | PARTIAL | Numeric + `>0` client validation and server validation exist. |
| Duplicate quote protection | PASS | Server returns 409 on existing active bid (and unique handling). |
| Quote success confirmation | PASS | Success alert shown and job removed from current feed. |
| API failure handling | PASS | Error message surfaced from response. |
| Offline quote behavior | FAIL | No quote queue; submit directly depends on network/API. |
| Quote state after restart | FAIL | No persisted pending quote state management. |
| Accepted/rejected quote behavior | PARTIAL | Notifications/resources include bid states; no dedicated quote outcome workflow screen. |
| Bidding permission enforcement | PASS | Server checks `can_commercial_bid`; UI also disables quote when false. |

---

## 5) State-transition matrix (canonical vs native)

Canonical target: `posted → quoted → awarded → allocated → accepted → on_my_way_to_pickup → on_site_pickup → loaded → on_my_way_to_delivery → on_site_delivery → delivered`

| Transition state | Native support | Result | Evidence |
|---|---|---|---|
| posted | Live loads only | PARTIAL | Seen in nearby-jobs marketplace feed, not job execution flow. |
| quoted | Bid submission | PARTIAL | `/api/driver/mobile/bids` creates submitted bids. |
| awarded | Job scopes/action precondition | PARTIAL | Jobs API includes awarded/allocated scopes. |
| allocated | Mapped to mobile `awarded` | FAIL | Mapping collapses `allocated`→`awarded`; semantic loss. |
| accepted | Explicit state/action | FAIL | No explicit accepted stage/action in native driver flow. |
| on_my_way_to_pickup | via action `on-my-way-pickup` -> `current_status=on_my_way` | FAIL | Uses legacy `on_my_way`; not canonical `on_my_way_to_pickup` persisted. |
| on_site_pickup | via `arrived-pickup` | PARTIAL | Stored as `on_site_pickup`; UI maps to `arrived_pickup`. |
| loaded | via `loaded` | PASS | Action exists with lifecycle guard. |
| on_my_way_to_delivery | via action sets `in_transit` | FAIL | Canonical name not persisted; mapped abstraction only. |
| on_site_delivery | via `arrived-delivery` | PASS | Action exists with lifecycle guard. |
| delivered | via `delivered` with POD gate | PASS | Server requires POD when required; idempotent check present. |

Additional lifecycle defects:
- Client `statusFlow` omits explicit canonical names and relies on mapped aliases.
- Invalid action names in e2e contract (`arrived-at-pickup`, `loading`) diverge from API implementation.

---

## 6) Active Job + My Jobs audit

| Check | Result | Evidence |
|---|---|---|
| Active job selection | PARTIAL | First job selected after fetch, current job refreshed by id if present. |
| Upcoming/completed lists | PARTIAL | Scope tabs implemented; backend scope lists omit cancelled/declined/disputed handling in mobile UI. |
| Cancelled/declined/disputed handling | FAIL | No dedicated native states/actions/messages for these outcomes. |
| Accurate job counts | PARTIAL | Derived from API responses; no fixture verification. |
| Refresh and stale removal | PARTIAL | Refetch updates list; no explicit stale reconciliation tests run. |
| Multiple active/allocated jobs safety | FAIL | App assumes single active job (`job` state picks first result). |
| Completed history access | PARTIAL | Completed scope exists; no runtime evidence with real data. |
| Earnings accuracy | FAIL | No earnings totals screen in native app. |

---

## 7) Job detail audit

| Field group | Result | Evidence |
|---|---|---|
| Collection/delivery addresses + times | PARTIAL | Rendered from mapped job fields. |
| Contact + phone | PARTIAL | Conditional render when contact allowed/available; no click-to-call action. |
| Load, quantity, weight, dimensions | FAIL | Quantity/weight/dimensions not exposed in Job Detail UI. |
| Vehicle requirement + instructions + notes | PARTIAL | Vehicle + requirements text shown; missing structured fields. |
| References and commercial amount | PARTIAL | Reference + price shown when available. |
| Waiting-time information | NOT IMPLEMENTED | No waiting-time field in mobile UI. |
| Map/navigation actions | NOT IMPLEMENTED | No map/deep navigation buttons in native job detail. |
| Missing-field fallback | PASS | `stringField` fallbacks and TBC defaults present. |
| Authorization-sensitive fields | PASS | Backend `sanitizeQuoteJob` masks private fields before allocation context. |

---

## 8) POD audit

| Check | Result | Evidence |
|---|---|---|
| POD gate before delivery | PASS | Client and server both block delivered when POD required and missing. |
| Photo capture | PARTIAL | Camera picker implemented; no device execution evidence. |
| Existing photo/document select | PARTIAL | Document picker implemented; no execution evidence. |
| Signature capture/clear/retry | PARTIAL | Signature canvas + clear action implemented; not runtime validated. |
| Recipient name required | PASS | Client validation + server validation enforce requirement. |
| Notes/timestamp/job association | PASS | Notes + timestamps + job-id-bound storage path enforced. |
| Upload progress UI | FAIL | No upload progress indicator; only success/fallback flow. |
| Upload failure + offline queue | PARTIAL | Failed upload queued as offline action; no explicit failed-item UI in POD screen itself. |
| Retry after reconnection | PARTIAL | Global queue flush interval/network listener exists. |
| Duplicate POD protection/idempotency | FAIL | No explicit idempotency token; repeated submissions can append more files. |
| Restart with pending POD | PARTIAL | Queue persisted in AsyncStorage; not device-validated. |
| Delivered without valid evidence prevention | PASS | Server validates evidence and persistent storage path checks. |
| Cross-job POD attachment prevention | PASS | Server validates path prefix by job id + assigned driver ownership. |

---

## 9) Notifications audit

| Check | Result | Evidence |
|---|---|---|
| Push-token registration | PARTIAL | Registration call exists; silently ignores errors. |
| Permission denied behaviour | PASS | Returns null, no crash. |
| Notification list + unread count | PARTIAL | Uses `resources.alerts` + local seen timestamp; no push listener ingestion. |
| Mark seen | PARTIAL | Seen-at timestamp stored when opening Notifications screen. |
| Event coverage (assigned/bid accepted/updated/cancelled/dispatcher/POD) | PARTIAL | Title mapping exists; dependent on backend event feed only. |
| Deep links (cold/warm/background) | FAIL | No native notification tap/deep-link routing handlers. |
| Invalid/deleted job notification handling | PARTIAL | Open job path handles 404 with message; no dedicated UX copy. |
| Duplicate notification handling | FAIL | No dedupe key logic in client list rendering. |

Current state summary: push implementation is a **partial shell** (token registration + list display), not full notification lifecycle handling.

---

## 10) Profile/account audit

| Feature area | Result | Evidence |
|---|---|---|
| Identity/contact/company/vehicle snapshot | PARTIAL | Read-only panels via `/resources`. |
| Documents + expiry | PARTIAL | Counts shown; no upload/manage UI in native profile. |
| Availability | NOT IMPLEMENTED | No native availability controls/screen. |
| Finance/invoices/earnings | PARTIAL | Invoice count only; no full finance workflow UI. |
| Messages | NOT IMPLEMENTED | No native messages screen. |
| Password change | NOT IMPLEMENTED | No native password-change flow in current app UI. |
| Logout | PARTIAL | Implemented; runtime execution not captured in this sandbox audit. |

---

## 11) Offline/network matrix

| Scenario | Result | Evidence |
|---|---|---|
| App launch offline | BLOCKED | Not device-executed. |
| Login offline | PARTIAL | Depends on Supabase sign-in; error surfaces but no dedicated offline UX. |
| Connection loss during API request | PARTIAL | Errors captured; some actions queued (status/POD) but not quote. |
| Connection loss during status update | PARTIAL | Falls back to queue and optimistic status update. |
| Connection loss during POD upload | PARTIAL | Falls back to queue. |
| Queue persistence after restart | PARTIAL | AsyncStorage queue implemented; not executed on device restart. |
| Automatic retry/backoff | PASS | Exponential backoff + interval/network-triggered flush implemented. |
| Manual retry | PASS | Queue panel exposes Retry Failed + Sync now. |
| Duplicate prevention | PARTIAL | Status idempotency server-side; queue item dedupe not enforced client-side. |
| Partial upload recovery | FAIL | No resumable upload / chunk-level recovery logic. |
| Corrupted queue entry handling | PARTIAL | Parser drops invalid entries and returns empty on JSON error. |
| Queue isolation per driver | FAIL | Single global queue key (not user-scoped). |
| Logout with pending queue | FAIL | Logout wipes entire queue globally, risking loss for shared-device account switches. |

---

## 12) Deep links and mobile-web integration

| Check | Result | Evidence |
|---|---|---|
| `xdrivedriver://` scheme declared | PASS | `app.config.ts` scheme set. |
| Android intent filter | PARTIAL | Wildcard https host filter present; custom scheme intent filter not explicitly declared in Android section. |
| Open app from `/driver` and `/m` | PARTIAL | Web banner + `/m` page attempt `window.location = xdrivedriver://`. |
| App-not-installed fallback | PASS | `/m` fallback to `/m/get-app`. |
| Invalid deep link handling | FAIL | No native link parser/router error handling. |
| Job-specific deep link | FAIL | No route-to-job implementation in native app. |
| Notification deep link | FAIL | No notification tap routing implementation. |
| Authenticated/unauthenticated restoration | FAIL | No deferred destination restore-after-login logic. |
| Redirect loop prevention `/driver` `/m` native | PARTIAL | Basic links exist; no explicit loop guard logic evidenced. |
| Desktop stays on `/driver` | PARTIAL | Banner only on mobile via prop; runtime browser matrix not executed. |
| Non-driver exclusion from app invite | FAIL | `/m` open app prompt has no role gate before invitation. |

---

## 13) Security and authorization matrix

| Control | Result | Evidence |
|---|---|---|
| No service-role key in mobile bundle | PASS | App uses anon key/runtime config only; service role remains server-side. |
| Public Supabase config only | PASS | `/api/driver/mobile/config` returns anon public config only. |
| Access token storage | PARTIAL | SecureStore + Supabase storage used; token also passed in memory. |
| Tokens not logged | PARTIAL | No explicit token logs in reviewed files; full runtime logs not audited. |
| Endpoint auth required | PASS | `requireDriver()` enforced across mobile API routes. |
| Driver role validation server-side | PASS | `requireDriver` validates active profile/driver/app access. |
| Job ownership enforced server-side | PASS | Job routes require `assigned_driver_id = driverId`. |
| POD authorization server-side | PASS | `savePod` checks assignment and validates storage paths. |
| Quote authorization server-side | PASS | `/bids` checks bidding permission and eligibility. |
| Duplicate/rate protection | PARTIAL | Duplicate quote constraint + status idempotency present; explicit rate limiting absent. |
| Cross-driver data access prevention | PASS | Assignment filters + auth context checks in API routes. |
| Safe non-production destructive tests | PASS | No destructive live-prod tests executed in this audit. |

---

## 14) Technical validation run report

| Validation item | Command | Result | Notes |
|---|---|---|---|
| Dependency installation (root) | `npm install` | PASS | Installed; reported 5 high vulnerabilities. |
| Dependency installation (mobile) | `npm --prefix apps/driver-mobile install` | PASS | Installed; reported 13 vulnerabilities. |
| TypeScript typecheck (mobile) | `npm --prefix apps/driver-mobile run typecheck` | PASS | Clean. |
| TypeScript typecheck (repo) | `npm run typecheck` | FAIL | `e2e/mobile-api-contract.spec.ts` typing errors. |
| ESLint | `npm run lint` | FAIL | 2 errors (`_lib.ts` Boolean cast, unused `request` var in e2e test). |
| Unit tests | N/A | NOT IMPLEMENTED | No dedicated unit-test script in package scripts. |
| API contract tests | `npm run test:e2e -- e2e/mobile-api-contract.spec.ts` | PARTIAL | 6 passed, 8 skipped; authenticated scenarios skipped (no creds). |
| Native app tests | N/A | NOT IMPLEMENTED | No Android/iOS native automated test suite configured. |
| Expo config validation | `npx expo config --type public` | PASS | Config resolves; shows permissions and env defaults. |
| EAS config validation | `npx eas-cli config --platform android --profile preview` | FAIL | `eas.json` invalid: `build.production.android.splits` not allowed. |
| Android APK build (script) | `npm --prefix apps/driver-mobile run build:android:apk` | FAIL | `eas` binary missing in local deps. |
| Android APK build (direct) | `npx eas-cli build --platform android --profile preview --non-interactive` | BLOCKED | Requires Expo auth token/login. |
| Security scanning | `codeql_checker` | Pending in this PR workflow | To be run after doc edits commit. |
| Dependency vulnerability scan (root) | `npm audit --json` | FAIL | 5 high vulnerabilities (eslint/minimatch chain). |
| Dependency vulnerability scan (mobile) | `npm audit --json` | FAIL | 13 vulns (12 moderate, 1 high; Expo chain + brace-expansion). |
| Dead-code/unused-route review | `npm run audit:interactive` | PARTIAL | Report generated; many broken/partial routes across platform. |

---

## 15) Functional gap register (evidence-backed)

| Gap ID | Function | Expected | Actual | Severity | Release impact | Evidence |
|---|---|---|---|---|---|---|
| DM-AUD-001 | Canonical lifecycle parity | Full canonical states and transitions preserved | Native collapses/aliases states (`allocated→awarded`, delivery path via `in_transit`) | Critical | Blocks APK release | `src/jobs/statusFlow.ts`, `app/api/driver/mobile/_lib.ts`, `.../jobs/[id]/[action]/route.ts` |
| DM-AUD-002 | Queue isolation per driver | Offline queue isolated by authenticated user | Global queue key shared across users | Critical | Blocks APK release | `src/offline/queue.ts` |
| DM-AUD-003 | Offline quote support | Quote action survives offline and retries safely | No quote queue/offline retry path | High | Blocks field operation continuity | `src/live-loads/LiveLoadsScreen.tsx`, `src/api/liveLoads.ts` |
| DM-AUD-004 | Notification deep links | Job/event taps navigate correctly on cold/warm/background start | No notification deep-link handlers | High | Blocks operational responsiveness | `src/push/registerPushToken.ts`, `src/app/DriverMobileApp.tsx` |
| DM-AUD-005 | EAS production profile validity | Config valid for build pipelines | `splits` schema invalid in `eas.json` | High | Blocks APK pipeline reliability | `apps/driver-mobile/eas.json`, `npx eas-cli config` output |
| DM-AUD-006 | Multi-active-job safety | Deterministic handling of multiple allocated jobs | Single `job` state picks first result only | High | Risk to dispatch correctness | `src/app/DriverMobileApp.tsx` |
| DM-AUD-007 | Job detail operational completeness | Quantity/weight/dimensions/map/call actions present | Missing multiple required operational fields/actions | Medium | Degrades driver execution quality | `src/app/DriverMobileApp.tsx` |
| DM-AUD-008 | POD idempotent submission | Duplicate submits do not duplicate evidence writes | Re-submits can append additional files | Medium | Potential data duplication | `app/api/driver/mobile/jobs/[id]/[action]/route.ts` |
| DM-AUD-009 | Native test coverage | Functional native test suite for key flows | None configured | Medium | Increases regression risk | `apps/driver-mobile/package.json` |
| DM-AUD-010 | Authenticated contract execution in CI | API contract includes real auth path in audit env | 8 tests skipped due missing E2E creds | Medium | Evidence gap | `e2e/mobile-api-contract.spec.ts` run output |

---

## 16) P0/P1/P2 remediation backlog

| Backlog ID | Priority | Defect(s) | Required remediation |
|---|---|---|---|
| RM-001 | P0 | DM-AUD-001 | Align native and mobile API status machine with canonical backend lifecycle; remove semantic collapsing and enforce valid transitions only. |
| RM-002 | P0 | DM-AUD-002 | Scope offline queue keys per authenticated user and preserve per-user pending items across account switches. |
| RM-003 | P0 | DM-AUD-005 | Fix `eas.json` schema (`production.android.splits`) and ensure reproducible preview APK build profile. |
| RM-004 | P1 | DM-AUD-003 | Add offline quote queue with idempotent retry and duplicate suppression. |
| RM-005 | P1 | DM-AUD-004 | Implement full push lifecycle: permission states, token lifecycle, foreground/background tap handlers, deep-link routing with auth restore. |
| RM-006 | P1 | DM-AUD-006 | Implement safe multi-active-job handling and deterministic active-job selection strategy. |
| RM-007 | P2 | DM-AUD-007 | Expand Job Detail with missing operational fields, map/navigation and call actions. |
| RM-008 | P2 | DM-AUD-008 | Add POD idempotency keying and duplicate submission safeguards. |
| RM-009 | P2 | DM-AUD-009/010 | Add native/UI automation and staged authenticated contract fixtures. |

---

## 17) Final audit verdict

### What genuinely works
- Driver-gated API authorization and assignment checks.
- Core status actions endpoints (with lifecycle guards and POD gate for delivered).
- Live-load quote submission with server duplicate protection.
- Offline queue skeleton for status/POD with retry/backoff.

### What is partial
- Authentication/session resilience evidence (implemented, not fully device-executed).
- Most screen behavior (implemented but lacking full runtime evidence matrix).
- Push notifications (registration/list shell only).
- Profile/resources coverage (read-heavy, limited actionability).

### What is broken
- Lifecycle canonical parity in native mapping/execution semantics.
- Global queue isolation model.
- EAS config/build readiness.
- Repo typecheck/lint baseline failures relevant to mobile audit paths.

### What is missing
- Offline quoting.
- Deep-link routing in native app.
- Several required job detail operational fields/actions.
- Native automated test suite and authenticated staged functional execution pack.

### Defects blocking driver operations
- Queue isolation + missing offline quote flow + lifecycle mismatches.

### Defects blocking APK release
- Lifecycle mismatch (P0), queue isolation (P0), invalid EAS profile/build readiness (P0), missing end-to-end runtime evidence for critical flows.

### Remediation order
1. RM-001
2. RM-002
3. RM-003
4. RM-004
5. RM-005
6. RM-006
7. RM-007
8. RM-008
9. RM-009
