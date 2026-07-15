# Audit 03 — Broker Workflow

> Production Certification Phase · Development Freeze Active

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Environment | https://www.xdrivelogistics.co.uk |
| Test account (broker) | |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## BW-01 · Broker Onboarding & Login

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BW-01-01 | Register as broker role | POST `/api/onboarding/init` | Onboarding initiated with broker flow | | 🔲 N/T | | |
| BW-01-02 | Complete broker onboarding session | POST `/api/onboarding/broker/session` | Session state saved | | 🔲 N/T | | |
| BW-01-03 | Submit broker application | POST `/api/onboarding/submit/broker` | Status = `pending_approval`; admin notified | | 🔲 N/T | | |
| BW-01-04 | Login after admin approval | POST `/login` | Redirect to `/broker` dashboard | | 🔲 N/T | | |
| BW-01-05 | Access `/broker` without broker role | Customer or driver account | 403 Forbidden or redirect | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## BW-02 · Job Posting as Broker

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BW-02-01 | Create new job | `/broker` → "Post Load" | Form displayed; all fields present | | 🔲 N/T | | |
| BW-02-02 | Post job with valid data | Supabase insert `jobs` | Job created; status = `open`; visible on marketplace | | 🔲 N/T | | |
| BW-02-03 | View broker's own jobs | `/broker` | Only own company's jobs listed | | 🔲 N/T | | |
| BW-02-04 | Broker cannot see other companies' jobs | `/broker` | No cross-company job leakage | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## BW-03 · Invitations to Carriers

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BW-03-01 | Send invitation to specific carrier | Invite action on job | Carrier receives notification / email | | 🔲 N/T | | |
| BW-03-02 | Invited carrier sees job in their loads | Carrier dashboard | Job visible with "invited" flag | | 🔲 N/T | | |
| BW-03-03 | Revoke invitation | Revoke action | Carrier no longer sees the invitation | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## BW-04 · Offer Comparison & Carrier Selection

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BW-04-01 | View bids received on broker job | `/broker` → job detail | Bids listed with carrier name, price, vehicle type | | 🔲 N/T | | |
| BW-04-02 | Sort bids by price | Sort control | Sorted correctly ascending / descending | | 🔲 N/T | | |
| BW-04-03 | View carrier company profile from bid | Link in bid | Carrier profile opens | | 🔲 N/T | | |
| BW-04-04 | Award bid to carrier | POST `/api/customer/bids/[id]/award` | Job allocated; carrier notified; other bids rejected | | 🔲 N/T | | |
| BW-04-05 | Attempt second award after allocation | Award action | Blocked; error returned | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## BW-05 · Tracking, Communication & Finalization

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BW-05-01 | Track job status | `/broker` → job detail | Current status displayed; updated in real time | | 🔲 N/T | | |
| BW-05-02 | View POD after delivery | Job detail → POD section | POD images and signature accessible | | 🔲 N/T | | |
| BW-05-03 | Download POD PDF | Download button | PDF downloads with correct content | | 🔲 N/T | | |
| BW-05-04 | View completed loads history | `/broker/awards` | All awarded and completed jobs listed | | 🔲 N/T | | |
| BW-05-05 | View active bids submitted by carriers | `/broker/bids` | All pending bids listed | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| BW-01 Onboarding & Login | 5 | | | | |
| BW-02 Job Posting | 4 | | | | |
| BW-03 Invitations | 3 | | | | |
| BW-04 Offer Comparison | 5 | | | | |
| BW-05 Tracking & Finalization | 5 | | | | |
| **TOTAL** | **22** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
