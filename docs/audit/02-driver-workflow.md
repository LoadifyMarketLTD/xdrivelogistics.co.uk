# Audit 02 — Driver Workflow

> Production Certification Phase · Development Freeze Active
> Nothing may be marked PASS unless executed and verified against the real platform.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Environment | https://www.xdrivelogistics.co.uk |
| Test account (driver) | |
| Test device (Android APK) | |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## DW-01 · Login & Authentication

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DW-01-01 | Login with valid driver credentials (web) | POST `/login` | Authenticated; redirect to `/driver` | | 🔲 N/T | | |
| DW-01-02 | Login with valid driver credentials (APK) | APK login screen | Authenticated; Active Job / Loads screen shown | | 🔲 N/T | | |
| DW-01-03 | Login with wrong password | POST `/login` | Error shown; session not created | | 🔲 N/T | | |
| DW-01-04 | Login with non-driver account (APK) | APK login screen | Access denied; "Driver accounts only" message | | 🔲 N/T | | |
| DW-01-05 | Session persistence after app background (APK) | Backgrounding app 10 min | Session still valid on return | | 🔲 N/T | | |
| DW-01-06 | Must-change-password flag enforced | Driver with `must_change_password = true` | Redirect to `/driver/change-password` before any other action | | 🔲 N/T | | |
| DW-01-07 | Change password successfully | POST `/api/driver/password` | Password updated; session maintained | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DW-02 · Availability

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DW-02-01 | Set availability ON (web) | `/driver/availability` toggle | Status updated in DB; jobs visible in loads | | 🔲 N/T | | |
| DW-02-02 | Set availability OFF (web) | `/driver/availability` toggle | Status updated; nearby jobs no longer shown | | 🔲 N/T | | |
| DW-02-03 | Set availability ON (APK) | Availability toggle in app | Realtime update reflected in admin fleet view | | 🔲 N/T | | |
| DW-02-04 | Availability status persists after app restart | APK restart | Availability state restored correctly | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DW-03 · Searching & Filtering Jobs

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DW-03-01 | View live loads feed (web) | `/driver/loads` | Open jobs listed with key details | | 🔲 N/T | | |
| DW-03-02 | View nearby jobs (APK) | GET `/api/driver/mobile/nearby-jobs` | Jobs within radius shown; distance displayed | | 🔲 N/T | | |
| DW-03-03 | Filter by vehicle type | Filter control | List filtered correctly | | 🔲 N/T | | |
| DW-03-04 | Filter by collection distance | Filter control | Only jobs within range shown | | 🔲 N/T | | |
| DW-03-05 | Filter by weight / payload | Filter control | Jobs outside limit excluded | | 🔲 N/T | | |
| DW-03-06 | Search loads (web) | GET `/api/driver/search-loads` | Results match query parameters | | 🔲 N/T | | |
| DW-03-07 | Pull-to-refresh loads list (APK) | Swipe down | List reloads; stale data cleared | | 🔲 N/T | | |
| DW-03-08 | Pin job to top of list (APK swipe right) | Swipe gesture | Job pinned; appears in Pinned tab | | 🔲 N/T | | |
| DW-03-09 | Hide job (APK swipe left) | Swipe gesture | Job hidden; moves to Hidden tab | | 🔲 N/T | | |
| DW-03-10 | Restore hidden job (APK) | Restore action in Hidden tab | Job returns to Live feed | | 🔲 N/T | | |
| DW-03-11 | Job not quoteable — eligibility check (APK) | Job with `canQuote=false` | "Check Eligibility" shown; Quote button disabled | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DW-04 · Submitting a Quote / Bid

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DW-04-01 | Open quote panel from job card (APK) | Tap job card | Quote panel opens pre-bound to job | | 🔲 N/T | | |
| DW-04-02 | Submit quote with valid price (APK) | POST `/api/driver/mobile/bids` | Bid created; job removed from live list; success toast | | 🔲 N/T | | |
| DW-04-03 | Submit quote with invalid amount (APK) | Submit with 0 or negative | Validation error; submit blocked | | 🔲 N/T | | |
| DW-04-04 | Submit quote (web) | `/driver/loads` → quote form | Bid created; confirmation shown | | 🔲 N/T | | |
| DW-04-05 | View submitted quotes list | `/driver/quotes` | All submitted bids listed with status | | 🔲 N/T | | |
| DW-04-06 | Quote for already-closed job | Submit after job closed | Error returned; no duplicate bid | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DW-05 · Job Acceptance & Journey Execution

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DW-05-01 | Receive notification — bid awarded | After customer awards bid | Push notification received (APK); in-app notification (web) | | 🔲 N/T | | |
| DW-05-02 | View won job | `/driver/won-work` | Awarded job appears with full details | | 🔲 N/T | | |
| DW-05-03 | Start Journey | POST `/api/driver/mobile/jobs/[id]/start_journey` | Status → `in_progress`; GPS tracking begins | | 🔲 N/T | | |
| DW-05-04 | Arrived at Collection | POST action `arrived_collection` | Status updated; timestamp recorded; customer notified | | 🔲 N/T | | |
| DW-05-05 | Loaded | POST action `loaded` | Status → `loaded`; timestamp recorded | | 🔲 N/T | | |
| DW-05-06 | On My Way | POST action `on_my_way` | Status → `on_my_way`; live tracking visible to customer | | 🔲 N/T | | |
| DW-05-07 | Arrived at Delivery | POST action `arrived_delivery` | Status → `arrived_delivery`; customer notified | | 🔲 N/T | | |
| DW-05-08 | Status progression — steps skipped | Attempt `on_my_way` before `loaded` | Error: status machine enforced; out-of-order rejected | | 🔲 N/T | | |
| DW-05-09 | Active job screen shows current status (APK) | During journey | Status banner and progress bar reflect DB state | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DW-06 · POD (Proof of Delivery)

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DW-06-01 | Access POD screen (APK) | Bottom nav → POD | POD screen opens; job context loaded | | 🔲 N/T | | |
| DW-06-02 | Capture photo via camera (APK) | Camera button | Camera opens; photo captured and added to POD | | 🔲 N/T | | |
| DW-06-03 | Add photo from gallery (APK) | Gallery button | Image selected and added to POD | | 🔲 N/T | | |
| DW-06-04 | Add multiple images (no limit enforced) | Add 5+ images | All images uploaded and displayed | | 🔲 N/T | | |
| DW-06-05 | Remove an image before submission | Delete on image thumbnail | Image removed from list | | 🔲 N/T | | |
| DW-06-06 | Capture signature | Signature pad | Signature drawn and saved as image | | 🔲 N/T | | |
| DW-06-07 | Clear and redo signature | Clear button | Pad reset; new signature accepted | | 🔲 N/T | | |
| DW-06-08 | Submit POD (all complete) | Submit POD button | POD saved; job → `delivered`; PDF generated; customer notified | | 🔲 N/T | | |
| DW-06-09 | Submit POD without images | Submit with 0 photos | Blocked; validation error shown | | 🔲 N/T | | |
| DW-06-10 | Submit POD without signature | Submit without signature | Blocked; validation error shown | | 🔲 N/T | | |
| DW-06-11 | POD PDF contains all required fields | Open generated PDF | Job ref, driver name, company, date, images, signature present | | 🔲 N/T | | |
| DW-06-12 | Offline POD queue — submit without internet | Airplane mode → submit | Queued locally; uploaded on reconnect | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DW-07 · Finance & Invoice

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DW-07-01 | Generate invoice for completed job | GET `/api/driver/finance/jobs/[jobId]/generate-invoice` | Invoice created with correct amount and job ref | | 🔲 N/T | | |
| DW-07-02 | View invoice list | `/driver/finance` | All invoices listed with status (draft / submitted / paid) | | 🔲 N/T | | |
| DW-07-03 | View invoice detail | `/driver/finance/invoices/[id]` | All invoice fields displayed correctly | | 🔲 N/T | | |
| DW-07-04 | Submit invoice | POST `/api/driver/finance/invoices/[id]/submit` | Status → `submitted`; admin notified | | 🔲 N/T | | |
| DW-07-05 | Download invoice PDF | Download button | PDF generated with correct content | | 🔲 N/T | | |
| DW-07-06 | Raise dispute on invoice | POST `/api/driver/finance/invoices/[id]/disputes` | Dispute created; admin notified | | 🔲 N/T | | |
| DW-07-07 | Overpayment guard — double submission blocked | POST submit twice | Second submission rejected (migration 129) | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DW-08 · History, Profile & Documents

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DW-08-01 | View completed job history | `/driver/history` | All delivered jobs listed with date and amount | | 🔲 N/T | | |
| DW-08-02 | Filter history by date range | Filter control | Results filtered correctly | | 🔲 N/T | | |
| DW-08-03 | View driver profile | `/driver/profile` | Profile details displayed and editable | | 🔲 N/T | | |
| DW-08-04 | Update profile (name, phone) | Submit profile form | Changes saved; confirmation shown | | 🔲 N/T | | |
| DW-08-05 | Upload driver document | `/driver/documents` | Document uploaded; expiry date recorded | | 🔲 N/T | | |
| DW-08-06 | View vehicle linked to driver | `/driver/vehicles` | Assigned vehicle shown with details | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| DW-01 Login & Auth | 7 | | | | |
| DW-02 Availability | 4 | | | | |
| DW-03 Search & Filter | 11 | | | | |
| DW-04 Quote / Bid | 6 | | | | |
| DW-05 Journey Execution | 9 | | | | |
| DW-06 POD | 12 | | | | |
| DW-07 Finance & Invoice | 7 | | | | |
| DW-08 History & Profile | 6 | | | | |
| **TOTAL** | **62** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
