# Audit 08 — Android Functional Audit

> Production Certification Phase · Development Freeze Active
> Must be executed on a physical Android device, not emulator only.
> Reference also: `apps/driver-mobile/docs/apk-functional-audit-workbook.md` for screen-by-screen detail.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| APK filename | |
| Build ID / commit SHA | |
| EAS profile (preview / production) | |
| API base URL in app | https://www.xdrivelogistics.co.uk |
| Device 1 (primary) — model / Android version | |
| Device 2 (secondary, if available) | |
| Emulator used (model / API level) | |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## AND-01 · Installation & Bootstrap

| ID | Step | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-01-01 | Install APK from file | App installs without error; icon appears on home screen | | 🔲 N/T | CRITICAL | |
| AND-01-02 | First launch — splash screen | Splash shown briefly; no crash | | 🔲 N/T | MAJOR | |
| AND-01-03 | App fetches config from `/api/driver/mobile/config` | Config loaded; Supabase URL and anon key set at runtime | | 🔲 N/T | CRITICAL | |
| AND-01-04 | App reaches login screen | Login screen displayed within 3s | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AND-02 · Authentication (APK)

| ID | Step | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-02-01 | Login with valid driver credentials | Authenticated; navigates to Active Job / Loads | | 🔲 N/T | CRITICAL | |
| AND-02-02 | Login with wrong password | Error message shown; no crash | | 🔲 N/T | CRITICAL | |
| AND-02-03 | Login with non-driver account | "Driver accounts only" error; no access | | 🔲 N/T | CRITICAL | |
| AND-02-04 | Session persists after app killed and reopened | Still authenticated; correct screen shown | | 🔲 N/T | MAJOR | |
| AND-02-05 | Session persists after phone reboot | App opens to authenticated state | | 🔲 N/T | MAJOR | |
| AND-02-06 | Logout | Session cleared; returns to login screen | | 🔲 N/T | MAJOR | |
| AND-02-07 | Authorization header sent to API (no redirect drop) | API calls use `https://www.xdrivelogistics.co.uk` (canonical) | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AND-03 · Navigation & Gestures

| ID | Screen / Element | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-03-01 | Bottom navigation — all 5 tabs tappable | Each tab opens correct screen | | 🔲 N/T | CRITICAL | |
| AND-03-02 | Back button (Android system) | Returns to previous screen; no crash | | 🔲 N/T | MAJOR | |
| AND-03-03 | Back button on login screen | App closes (does not navigate backwards past login) | | 🔲 N/T | MINOR | |
| AND-03-04 | Pull-to-refresh on Loads list | List reloads; spinner visible; stale data cleared | | 🔲 N/T | MAJOR | |
| AND-03-05 | Pull-to-refresh on Jobs list | Same | | 🔲 N/T | MAJOR | |
| AND-03-06 | Swipe right on job card (PIN) | Job pinned; appears in Pinned tab | | 🔲 N/T | MAJOR | |
| AND-03-07 | Swipe left on job card (HIDE) | Job hidden; moves to Hidden tab | | 🔲 N/T | MAJOR | |
| AND-03-08 | Scroll in long lists (50+ items) | Smooth scroll; no dropped frames | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AND-04 · Live Loads & Quoting

| ID | Step | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-04-01 | Loads tab — live feed displays jobs | Job cards shown with key info | | 🔲 N/T | CRITICAL | |
| AND-04-02 | Tap job card — open quote panel | Quote panel slides up; job details pre-filled | | 🔲 N/T | CRITICAL | |
| AND-04-03 | Submit quote with valid amount | Bid sent; job removed from live list; success toast | | 🔲 N/T | CRITICAL | |
| AND-04-04 | Submit quote with 0 or negative amount | Validation error; submit blocked | | 🔲 N/T | MAJOR | |
| AND-04-05 | Cancel quote panel | Panel dismissed; no bid submitted | | 🔲 N/T | MINOR | |
| AND-04-06 | Nearby jobs endpoint called correctly | GET `/api/driver/mobile/nearby-jobs` returns results | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AND-05 · Active Job & Journey Execution

| ID | Step | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-05-01 | Active Job screen shows awarded job | Job details, pickup and delivery addresses shown | | 🔲 N/T | CRITICAL | |
| AND-05-02 | "Start Journey" button → POST `start_journey` | Status updated; GPS tracking starts; customer notified | | 🔲 N/T | CRITICAL | |
| AND-05-03 | "Arrived at Collection" → POST action | Status → `arrived_collection`; timestamp recorded | | 🔲 N/T | CRITICAL | |
| AND-05-04 | "Loaded" → POST action | Status → `loaded` | | 🔲 N/T | CRITICAL | |
| AND-05-05 | "On My Way" → POST action | Status → `on_my_way`; GPS continues | | 🔲 N/T | CRITICAL | |
| AND-05-06 | "Arrived at Delivery" → POST action | Status → `arrived_delivery`; customer notified | | 🔲 N/T | CRITICAL | |
| AND-05-07 | Out-of-order status rejected | "On My Way" before "Loaded" | Error shown; status not updated | | 🔲 N/T | MAJOR | |
| AND-05-08 | Status progress bar reflects current state | Bar shows correct step highlighted | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AND-06 · POD (Proof of Delivery)

| ID | Step | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-06-01 | POD tab accessible after "Arrived at Delivery" | POD screen opens; job context loaded | | 🔲 N/T | CRITICAL | |
| AND-06-02 | Camera button → camera permission requested | Permission dialog shown | | 🔲 N/T | MAJOR | |
| AND-06-03 | Capture photo via camera | Photo added to POD list | | 🔲 N/T | CRITICAL | |
| AND-06-04 | Select photo from gallery | Image added to POD list | | 🔲 N/T | MAJOR | |
| AND-06-05 | Add 5+ photos | All photos shown; no limit error | | 🔲 N/T | CRITICAL | |
| AND-06-06 | Delete a photo before submit | Photo removed from list | | 🔲 N/T | MINOR | |
| AND-06-07 | Draw signature | Signature captured on pad | | 🔲 N/T | CRITICAL | |
| AND-06-08 | Clear and redo signature | Pad cleared; new signature accepted | | 🔲 N/T | MINOR | |
| AND-06-09 | Submit POD (complete) | Job → `delivered`; PDF generated; customer notified | | 🔲 N/T | CRITICAL | |
| AND-06-10 | Submit POD without photos | Blocked; validation error | | 🔲 N/T | MAJOR | |
| AND-06-11 | Submit POD without signature | Blocked; validation error | | 🔲 N/T | MAJOR | |
| AND-06-12 | Offline — submit POD without internet | Queued locally; uploaded on reconnect | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AND-07 · GPS & Location

| ID | Step | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-07-01 | GPS permission requested on Start Journey | Permission dialog shown if not granted | | 🔲 N/T | CRITICAL | |
| AND-07-02 | GPS permission granted — tracking starts | `POST /api/driver/location` called; position stored | | 🔲 N/T | CRITICAL | |
| AND-07-03 | GPS permission denied — graceful degradation | Error message shown; journey can still proceed manually | | 🔲 N/T | MAJOR | |
| AND-07-04 | Location updates while app in background | Position updated even when screen off | | 🔲 N/T | CRITICAL | |
| AND-07-05 | Location accuracy acceptable | Accuracy within 50m during active test | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AND-08 · Push Notifications

| ID | Step | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-08-01 | Notification permission requested on first login | Permission dialog shown | | 🔲 N/T | MAJOR | |
| AND-08-02 | Device token registered | POST `/api/driver/mobile/device-token` called; token saved | | 🔲 N/T | MAJOR | |
| AND-08-03 | Push notification received (bid awarded) | Notification appears in notification tray | | 🔲 N/T | CRITICAL | |
| AND-08-04 | Tap notification → opens correct screen | Tapping bid-awarded notification opens Active Job screen | | 🔲 N/T | MAJOR | |
| AND-08-05 | In-app notification badge shown | Bell icon shows unread count | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AND-09 · Device Compatibility

| ID | Scenario | Device / Config | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-09-01 | Portrait orientation | Any phone | UI renders correctly; no overflow | | 🔲 N/T | CRITICAL | |
| AND-09-02 | Landscape orientation | Rotate to landscape | UI re-renders correctly; no elements hidden | | 🔲 N/T | MAJOR | |
| AND-09-03 | Small phone (5") | 5" device or emulator | No overflow; all text readable | | 🔲 N/T | MAJOR | |
| AND-09-04 | Large phone (6.5"+) | Large device | No excess whitespace; layout proportional | | 🔲 N/T | MINOR | |
| AND-09-05 | Tablet (9–11") | Tablet device or emulator | Layout adapts; not stretched awkwardly | | 🔲 N/T | MINOR | |
| AND-09-06 | Dark mode (system) | System → Dark theme | All screens render correctly; no invisible text | | 🔲 N/T | MAJOR | |
| AND-09-07 | Light mode (system) | System → Light theme | All screens render correctly | | 🔲 N/T | MAJOR | |
| AND-09-08 | Accessibility font scale 130% | Settings → Font size → Large | No text truncation; layout intact | | 🔲 N/T | MINOR | |
| AND-09-09 | Android 10 (API 29) | Older device / emulator | App functions; no deprecated API crashes | | 🔲 N/T | MAJOR | |
| AND-09-10 | Android 13+ (API 33) | Newer device | Notification permissions, photo picker work correctly | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AND-10 · Offline & Resilience

| ID | Scenario | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-10-01 | Airplane mode while viewing loads | Offline message shown; no crash | | 🔲 N/T | MAJOR | |
| AND-10-02 | Airplane mode during journey | Status displayed from cache; GPS continues (if enabled) | | 🔲 N/T | MAJOR | |
| AND-10-03 | Reconnect after offline | Data re-syncs automatically; offline queue flushed | | 🔲 N/T | MAJOR | |
| AND-10-04 | Offline queue — status update | Status update queued; sent on reconnect | | 🔲 N/T | MAJOR | |
| AND-10-05 | Offline queue — POD submit | POD queued; sent on reconnect with all photos | | 🔲 N/T | MAJOR | |
| AND-10-06 | Weak signal (2G throttle via dev settings) | App degrades gracefully; spinners visible | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AND-11 · Crash & Error Handling

| ID | Scenario | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|
| AND-11-01 | Normal session — no ANR | Use app normally for 30 min | 0 ANR dialogs | | 🔲 N/T | CRITICAL | |
| AND-11-02 | Normal session — no unhandled crashes | Use app normally for 30 min | 0 crash dialogs | | 🔲 N/T | CRITICAL | |
| AND-11-03 | Logcat — no fatal errors | `adb logcat -s ReactNativeJS:E` | 0 fatal JS errors | | 🔲 N/T | CRITICAL | |
| AND-11-04 | API error shown gracefully | Force API failure (network off) | Error message displayed; no blank screen | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| AND-01 Installation & Bootstrap | 4 | | | | |
| AND-02 Authentication | 7 | | | | |
| AND-03 Navigation & Gestures | 8 | | | | |
| AND-04 Live Loads & Quoting | 6 | | | | |
| AND-05 Active Job & Journey | 8 | | | | |
| AND-06 POD | 12 | | | | |
| AND-07 GPS & Location | 5 | | | | |
| AND-08 Push Notifications | 5 | | | | |
| AND-09 Device Compatibility | 10 | | | | |
| AND-10 Offline & Resilience | 6 | | | | |
| AND-11 Crash & Error Handling | 4 | | | | |
| **TOTAL** | **75** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
