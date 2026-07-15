# Audit 01 — Customer Workflow

> Production Certification Phase · Development Freeze Active
> Nothing may be marked PASS unless executed and verified against the real platform.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Environment | https://www.xdrivelogistics.co.uk |
| Test account (customer) | |
| Test company | |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## CW-01 · Registration & Email Verification

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| CW-01-01 | Navigate to registration page | GET `/register` | Page loads, form displayed with role selector | | 🔲 N/T | | |
| CW-01-02 | Submit with all valid fields (customer role) | POST `/auth/signup` via Supabase | Account created; confirmation email sent; redirect to email-check page | | 🔲 N/T | | |
| CW-01-03 | Submit with duplicate email | POST `/auth/signup` | Inline error "Email already in use"; no crash | | 🔲 N/T | | |
| CW-01-04 | Submit with weak/invalid password | POST `/auth/signup` | Validation error before submit | | 🔲 N/T | | |
| CW-01-05 | Submit with missing required fields | POST `/auth/signup` | Fields highlighted; submit blocked | | 🔲 N/T | | |
| CW-01-06 | Click email verification link | GET `/auth/callback` | Token exchanged; session created; redirect to onboarding | | 🔲 N/T | | |
| CW-01-07 | Access protected route before email verification | GET `/customer` | Redirect to email verification notice page | | 🔲 N/T | | |
| CW-01-08 | Re-send verification email | Button on notice page | New email sent; button shows cooldown | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## CW-02 · Company Onboarding

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| CW-02-01 | Initiate onboarding | POST `/api/onboarding/init` | Token generated; redirect to `/onboarding/[token]` | | 🔲 N/T | | |
| CW-02-02 | Customer onboarding step — company details | POST `/api/onboarding/customer/session` | Session state saved; next step unlocked | | 🔲 N/T | | |
| CW-02-03 | Upload company documents | POST `/api/onboarding/documents` | Files uploaded to Storage; listed in session | | 🔲 N/T | | |
| CW-02-04 | Submit onboarding | POST `/api/onboarding/submit/customer` | Application submitted; status = `pending_approval` | | 🔲 N/T | | |
| CW-02-05 | Submit onboarding with missing documents | POST `/api/onboarding/submit/customer` | Blocked with validation error; no partial insert | | 🔲 N/T | | |
| CW-02-06 | Access dashboard after submit (pending) | GET `/customer` | Redirect to `/pending-approval` | | 🔲 N/T | | |
| CW-02-07 | Resume incomplete onboarding | GET `/onboarding/resume` | Session restored at last completed step | | 🔲 N/T | | |
| CW-02-08 | Admin approves company | Admin action | Customer receives notification; `/customer` accessible | | 🔲 N/T | | |
| CW-02-09 | Admin rejects company | Admin action | Customer receives rejection notification with reason | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## CW-03 · Job Posting

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| CW-03-01 | Open new job form | `/customer` → "Post Job" | Job creation form displayed with all fields | | 🔲 N/T | | |
| CW-03-02 | Post job with all required fields | Supabase insert `jobs` | Job created with status `open`; visible on marketplace | | 🔲 N/T | | |
| CW-03-03 | Post job with pickup/delivery address autocomplete | Google Places / address field | Addresses resolved; coordinates stored | | 🔲 N/T | | |
| CW-03-04 | Post job with missing required fields | Submit form | Front-end validation blocks submit; fields highlighted | | 🔲 N/T | | |
| CW-03-05 | Post job with invalid date (past date) | Submit form | Validation error; submit blocked | | 🔲 N/T | | |
| CW-03-06 | View posted job in My Jobs list | `/customer` | Job appears in list with correct status and details | | 🔲 N/T | | |
| CW-03-07 | Edit job (status = `open`) | Edit action on job | All editable fields updated and saved | | 🔲 N/T | | |
| CW-03-08 | Edit job after allocation (status = `assigned`) | Edit action | Edit blocked or limited to non-core fields | | 🔲 N/T | | |
| CW-03-09 | Cancel job (no bids) | Cancel action | Job status → `cancelled`; removed from marketplace | | 🔲 N/T | | |
| CW-03-10 | Cancel job (with bids) | Cancel action | Job cancelled; all bidding drivers notified | | 🔲 N/T | | |
| CW-03-11 | Cancel already-assigned job | Cancel action | Appropriate error or confirmation flow | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## CW-04 · Offer Selection & Allocation

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| CW-04-01 | View incoming bids on job | `/customer/jobs/[id]` | List of bids with driver name, company, price, ETA | | 🔲 N/T | | |
| CW-04-02 | Compare bids (sort by price) | Sort control | Bids re-sorted correctly | | 🔲 N/T | | |
| CW-04-03 | Compare bids (sort by rating) | Sort control | Bids re-sorted by driver/company rating | | 🔲 N/T | | |
| CW-04-04 | View driver/company profile from bid | Link in bid card | Driver or company profile page opens | | 🔲 N/T | | |
| CW-04-05 | Award bid to driver | POST `/api/customer/bids/[id]/award` | Job status → `assigned`; driver notified; other bidders rejected | | 🔲 N/T | | |
| CW-04-06 | Award bid — verify other bids rejected | Supabase `job_bids` | Rejected bids have status `rejected`; drivers notified | | 🔲 N/T | | |
| CW-04-07 | Attempt to award second bid after allocation | POST `/api/customer/bids/[id]/award` | Request rejected with error; no double-allocation | | 🔲 N/T | | |
| CW-04-08 | No bids visible from other companies' jobs | `/customer` | Only own company's jobs visible | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## CW-05 · Live Tracking

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| CW-05-01 | Open tracking view for active job | `/customer/jobs/[id]` → tracking tab | Map displayed; driver position shown | | 🔲 N/T | | |
| CW-05-02 | Driver position updates in real time | Supabase realtime on `driver_locations` | Pin on map moves without page refresh | | 🔲 N/T | | |
| CW-05-03 | Current status displayed correctly | Status banner | Status matches actual driver status (loaded / on_my_way etc.) | | 🔲 N/T | | |
| CW-05-04 | Status update triggers notification | Driver updates status | Customer receives in-app and/or email notification | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## CW-06 · POD, Invoice & Archiving

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| CW-06-01 | POD becomes available after delivery | `/customer/jobs/[id]` | POD tab/section unlocked; images and signature visible | | 🔲 N/T | | |
| CW-06-02 | Download POD PDF | Download button | PDF downloads; contains correct job details, images, signature | | 🔲 N/T | | |
| CW-06-03 | Invoice generated after delivery | `/customer/jobs/[id]` → invoice | Invoice present with correct amount, job ref, dates | | 🔲 N/T | | |
| CW-06-04 | Download invoice PDF | Download button | PDF downloads; content matches displayed invoice | | 🔲 N/T | | |
| CW-06-05 | Payment flow (if active) | Payment button | Payment initiated; status updated | | 🔲 N/T | | |
| CW-06-06 | Archive completed job | Archive action | Job moves to archived view; no longer in active list | | 🔲 N/T | | |
| CW-06-07 | Archived jobs searchable | Archived section | Filter/search returns archived job | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## CW-07 · Settings & Account

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| CW-07-01 | Access customer settings | `/customer/settings` | Settings page loads with all sections | | 🔲 N/T | | |
| CW-07-02 | Update company profile | Settings → company | Changes saved; confirmation displayed | | 🔲 N/T | | |
| CW-07-03 | Update notification preferences | Settings → notifications | Preferences saved; applied to subsequent notifications | | 🔲 N/T | | |
| CW-07-04 | Logout | Logout action | Session cleared; redirect to `/login` | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| CW-01 Registration & Email | 8 | | | | |
| CW-02 Onboarding | 9 | | | | |
| CW-03 Job Posting | 11 | | | | |
| CW-04 Offer Selection | 8 | | | | |
| CW-05 Live Tracking | 4 | | | | |
| CW-06 POD / Invoice / Archive | 7 | | | | |
| CW-07 Settings | 4 | | | | |
| **TOTAL** | **51** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:** (reference to Audit 11 — Defect Report)

| Defect ID | Description | Severity |
|---|---|---|
| | | |
