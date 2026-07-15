# XDrive Driver Mobile — APK Functional Audit Workbook

This workbook operationalizes the complete functional APK audit requested for the Driver Mobile app, screen-by-screen and button-by-button.

## 1) Baseline definition (spec vs audited APK)

### Audit metadata (must be filled before execution)

| Field | Value |
|---|---|
| Audit ID |  |
| Audited APK filename |  |
| Audited build ID / hash |  |
| Build date/time |  |
| EAS profile used (preview/production) |  |
| API base URL observed in app |  |
| Environment (staging/production) |  |
| Device model / Android version |  |
| Auditor name |  |
| Audit execution date |  |

### Canonical MVP specification checkpoint

Scope baseline for this audit (from app scope and current implementation):

- Persistent driver login.
- Active Job as default operational screen after authenticated load.
- My Jobs with Active / Upcoming / Completed scopes.
- Job Detail with operational fields.
- Canonical status progression from awarded to delivered.
- POD capture flow (photos/documents + metadata), with offline queue fallback.
- Critical notification shell.
- Offline queue skeleton for status/POD retry.

---

## 2) Screen-by-screen, button-by-button audit matrix

Status legend: `OK`, `NOK`, `PARTIAL`, `N/T` (not tested)

### Login

| Screen | UI element / button | Preconditions | Expected result | Observed result | Status | Severity |
|---|---|---|---|---|---|---|
| Login | Email input | App opened, logged out | Accepts valid email format input |  | N/T |  |
| Login | Password input | App opened, logged out | Accepts secure password input |  | N/T |  |
| Login | `Sign in` button (disabled state) | Empty email or password | Button stays disabled |  | N/T |  |
| Login | `Sign in` button (enabled state) | Email + password provided | Starts login and displays loading label |  | N/T |  |
| Login | Driver-only role gate | Credentials for non-driver account | Access denied, session cleared, remains in login |  | N/T |  |

### Global/Header + Navigation

| Screen | UI element / button | Preconditions | Expected result | Observed result | Status | Severity |
|---|---|---|---|---|---|---|
| Header | `Alerts` | Authenticated | Opens Notifications screen |  | N/T |  |
| Header | `Profile` | Authenticated | Opens Profile screen |  | N/T |  |
| Bottom nav | `Loads` | Authenticated | Opens Live Loads screen |  | N/T |  |
| Bottom nav | `Active` | Authenticated | Opens Active Job screen |  | N/T |  |
| Bottom nav | `Jobs` | Authenticated | Opens Jobs list screen |  | N/T |  |
| Bottom nav | `POD` | Authenticated + active job exists | Opens POD screen |  | N/T |  |
| Bottom nav | `Profile` | Authenticated | Opens Profile screen |  | N/T |  |

### Live Loads

| Screen | UI element / button | Preconditions | Expected result | Observed result | Status | Severity |
|---|---|---|---|---|---|---|
| Live Loads | Feed tabs: `Live`, `Pinned`, `Hidden` | Authenticated | Changes feed and count labels correctly |  | N/T |  |
| Live Loads | Pull-to-refresh | Authenticated | Reloads loads and clears stale list/error |  | N/T |  |
| Live Loads | Card tap (`onOpen`) | Quote-eligible job | Opens quote panel pre-bound to selected job |  | N/T |  |
| Live Loads | Card action `QUOTE` | Quote-eligible job | Opens quote panel |  | N/T |  |
| Live Loads | Card action `CHECK ELIGIBILITY` (locked) | `canQuote=false` job | Action disabled + warning surfaced |  | N/T |  |
| Live Loads | Swipe right (`PIN`/`UNPIN`) | Job visible in feed | Toggles pinned state in preferences |  | N/T |  |
| Live Loads | Swipe left (`HIDE`) | Job visible in feed | Moves job to hidden feed |  | N/T |  |
| Live Loads | Hidden card action `RESTORE` | Job in hidden feed | Returns job to visible feed |  | N/T |  |
| Live Loads quote panel | `CANCEL` | Quote panel opened | Closes panel without submit |  | N/T |  |
| Live Loads quote panel | `SUBMIT QUOTE` valid amount | Quote panel opened | Sends quote, removes job from live list, success alert |  | N/T |  |
| Live Loads quote panel | `SUBMIT QUOTE` invalid amount | Quote panel opened, amount invalid | Rejects submit with validation error |  | N/T |  |

### Active Job

| Screen | UI element / button | Preconditions | Expected result | Observed result | Status | Severity |
|---|---|---|---|---|---|---|
| Active Job | Primary CTA (next status action) | Active job + next step exists | Confirms (when required) and submits status |  | N/T |  |
| Active Job | Primary CTA when no next step + POD required | Job requires POD before delivery | Redirects to POD screen and shows message |  | N/T |  |
| Active Job | `Job detail` | Active job exists | Opens Job Detail screen |  | N/T |  |
| Active Job | `Capture POD` | Active job exists | Opens POD screen |  | N/T |  |
| Active Job | Pending sync badge | Offline queued actions exist | Shows pending count state |  | N/T |  |

### Jobs

| Screen | UI element / button | Preconditions | Expected result | Observed result | Status | Severity |
|---|---|---|---|---|---|---|
| Jobs | Segmented: `active` | Jobs screen loaded | Loads active scope jobs |  | N/T |  |
| Jobs | Segmented: `upcoming` | Jobs screen loaded | Loads upcoming scope jobs |  | N/T |  |
| Jobs | Segmented: `completed` | Jobs screen loaded | Loads completed scope jobs |  | N/T |  |
| Jobs | Job row tap | At least one job in scope | Opens Job Detail for selected job |  | N/T |  |
| Jobs | Empty scope state | No jobs in selected scope | Shows "No jobs in this scope." message |  | N/T |  |

### Job Detail

| Screen | UI element / button | Preconditions | Expected result | Observed result | Status | Severity |
|---|---|---|---|---|---|---|
| Job Detail | Operational fields rendering | Job selected | Displays pickup/delivery/times/cargo/vehicle (+optional contact/phone) |  | N/T |  |
| Job Detail | `Back to active` | Job detail opened | Returns to Active screen |  | N/T |  |

### POD

| Screen | UI element / button | Preconditions | Expected result | Observed result | Status | Severity |
|---|---|---|---|---|---|---|
| POD | `Add photo` | Camera permission granted | Captures photo and appends to POD payload |  | N/T |  |
| POD | `Add photo` permission denied | Camera permission denied | Shows camera-required alert and prevents capture |  | N/T |  |
| POD | `Add document` | File picker available | Selects and appends document URI |  | N/T |  |
| POD | `Recipient name` input | POD screen open | Stores recipient name in payload |  | N/T |  |
| POD | `Notes` input | POD screen open | Stores notes in payload |  | N/T |  |
| POD | `Save POD` online | Valid auth token + internet | Uploads POD and returns to Active |  | N/T |  |
| POD | `Save POD` offline | No token or no internet | Queues action and returns to Active |  | N/T |  |

### Notifications

| Screen | UI element / button | Preconditions | Expected result | Observed result | Status | Severity |
|---|---|---|---|---|---|---|
| Notifications | Informational panel | Notifications screen open | Shows current critical notifications shell copy |  | N/T |  |

### Profile

| Screen | UI element / button | Preconditions | Expected result | Observed result | Status | Severity |
|---|---|---|---|---|---|---|
| Profile | Session/app info panel | Profile screen open | Displays account/session metadata |  | N/T |  |
| Profile | `Sign out` | Authenticated | Signs out, clears stored session + queue, returns to login |  | N/T |  |

---

## 3) Critical end-to-end flow execution checklist

For each flow, capture: video/screenshot evidence, API responses, and result classification (`PASS`, `FAIL`, `PARTIAL`).

| Flow ID | Flow | Test path | Evidence ref | Result |
|---|---|---|---|---|
| CF-01 | Driver auth + role gate | Login as driver; login as non-driver |  |  |
| CF-02 | Session restore | Relaunch app with prior valid session |  |  |
| CF-03 | Operational status progression | Awarded -> in_transit -> arrived -> delivered path |  |  |
| CF-04 | POD dependency for delivery | Attempt delivery when POD required before upload |  |  |
| CF-05 | POD full path | Add photo + document + recipient + notes + save |  |  |
| CF-06 | Offline queue replay | Trigger status/POD offline, then reconnect and sync |  |  |
| CF-07 | Live Loads interaction | Pin/hide/restore + submit quote + tab switching |  |  |
| CF-08 | Sign-out and fresh sign-in | Sign out, verify cleanup, sign in again |  |  |

---

## 4) Negative scenarios and edge-case checklist

| Case ID | Scenario | Expected behavior | Observed behavior | Status | Severity |
|---|---|---|---|---|---|
| NG-01 | No internet during status submit | Action queued, UI indicates pending sync |  | N/T |  |
| NG-02 | No internet during POD save | POD queued, user returned safely to Active |  | N/T |  |
| NG-03 | Reconnect after queued actions | Pending/failed actions reprocessed, status updated |  | N/T |  |
| NG-04 | Invalid quote amount (`0`, negative, text) | Validation error, no API submit |  | N/T |  |
| NG-05 | Expired/invalid token | Session reset or auth error flow without crash |  | N/T |  |
| NG-06 | Camera permission denied | Alert shown; no crash; user stays in POD |  | N/T |  |
| NG-07 | Document picker cancelled | No crash; no invalid payload writes |  | N/T |  |
| NG-08 | No active job state | Active screen shows empty-state + refresh action |  | N/T |  |
| NG-09 | API transient failure on status update | Fallback queue used + user feedback message |  | N/T |  |
| NG-10 | API transient failure on quote submit | Error surfaced; no silent failure |  | N/T |  |

---

## 5) Navigation and state consistency checks

| Check ID | Verification point | Expected result | Observed result | Status |
|---|---|---|---|---|
| NV-01 | Header shortcuts route correctly | `Alerts` and `Profile` open expected screens |  | N/T |
| NV-02 | Bottom nav state highlighting | Selected route highlighted consistently |  | N/T |
| NV-03 | Screen transitions preserve selected job context | Job detail/POD opens for current selected job |  | N/T |
| NV-04 | Loading states visible on network actions | User gets clear loading feedback |  | N/T |
| NV-05 | Error/copy states are explicit and actionable | No silent failures; meaningful messaging |  | N/T |
| NV-06 | Confirm dialogs on required actions | Confirmation appears for guarded status steps |  | N/T |

---

## 6) Functional gap register (required output of audit)

Classify every defect found during execution.

| Gap ID | Category (Missing/Wrong behavior/UX improvement) | Related matrix item(s) | Repro steps | Expected | Actual | Severity | Business impact | Owner | Status |
|---|---|---|---|---|---|---|---|---|---|
| DM-AUD-001 |  |  |  |  |  |  |  |  | Open |
| DM-AUD-002 |  |  |  |  |  |  |  |  | Open |
| DM-AUD-003 |  |  |  |  |  |  |  |  | Open |

Severity guide:
- **Critical**: blocks core driver operations or data integrity.
- **High**: major function works incorrectly, but temporary workaround exists.
- **Medium**: function works with friction or partial inconsistency.
- **Low**: cosmetic/minor UX issue with no operational risk.

---

## 7) Closure criteria and remediation plan

### Exit criteria for the audit

Audit can be marked complete only when:

1. All matrix items are executed or explicitly tagged `N/T` with reason.
2. All critical flows (CF-01..CF-08) have evidence attached.
3. All negative scenarios (NG-01..NG-10) are executed.
4. **Zero open Critical/High defects** remain for MVP-critical flows.

### Remediation backlog (priority order)

| Backlog ID | Linked gap ID | Priority (P0/P1/P2) | Reason | Action owner | Target release |
|---|---|---|---|---|---|
| RM-001 |  | P0 |  |  |  |
| RM-002 |  | P1 |  |  |  |
| RM-003 |  | P2 |  |  |  |

Priority guide:
- **P0**: must-fix before release (critical/high operational risk).
- **P1**: required for near-term quality/stability after P0 closure.
- **P2**: non-blocking improvements.

---

## Audit execution notes

- Prefer real APK execution on a physical Android device for final sign-off.
- Capture evidence per failed or partial item (screenshot/video + API log excerpt).
- Keep this workbook versioned in the repo for traceability between builds.
