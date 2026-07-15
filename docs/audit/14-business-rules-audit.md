# Audit 14 — Business Rules Audit

> Production Certification Phase · Development Freeze Active
> Verify that all core business logic rules are enforced at every layer.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Environment | https://www.xdrivelogistics.co.uk |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## BR-01 · Job State Machine

| ID | Rule | Test Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BR-01-01 | Job can only transition: `open` → `assigned` | Attempt `open` → `in_progress` direct | Rejected; invalid transition | | 🔲 N/T | CRITICAL | |
| BR-01-02 | Job can only transition: `assigned` → `in_progress` | Trigger via Start Journey | Allowed | | 🔲 N/T | MAJOR | |
| BR-01-03 | Job cannot be cancelled after `in_progress` | Cancel action on active job | Blocked; error shown | | 🔲 N/T | MAJOR | |
| BR-01-04 | Job status `delivered` is terminal | Attempt update after delivery | Rejected | | 🔲 N/T | MAJOR | |
| BR-01-05 | Job status `cancelled` is terminal | Attempt reactivation | Rejected | | 🔲 N/T | MAJOR | |
| BR-01-06 | Only one bid can be awarded per job | Award second bid after first awarded | Rejected; error returned | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## BR-02 · Driver Journey State Machine

| ID | Rule | Test Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BR-02-01 | `start_journey` only allowed when job is `assigned` | Call with non-assigned job | Error; action rejected | | 🔲 N/T | CRITICAL | |
| BR-02-02 | `arrived_collection` only after `start_journey` | Skip start_journey; call arrived_collection | Rejected | | 🔲 N/T | MAJOR | |
| BR-02-03 | `loaded` only after `arrived_collection` | Call loaded without arriving | Rejected | | 🔲 N/T | MAJOR | |
| BR-02-04 | `on_my_way` only after `loaded` | Skip loaded; call on_my_way | Rejected | | 🔲 N/T | MAJOR | |
| BR-02-05 | `arrived_delivery` only after `on_my_way` | Skip on_my_way | Rejected | | 🔲 N/T | MAJOR | |
| BR-02-06 | POD submit only allowed after `arrived_delivery` | Submit POD with status `on_my_way` | Rejected | | 🔲 N/T | MAJOR | |
| BR-02-07 | Status updates are idempotent within same step | Repeat same status action | Accepted gracefully; no duplicate records | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## BR-03 · Onboarding State Machine

| ID | Rule | Test Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BR-03-01 | Onboarding token required to submit | POST `/api/onboarding/submit/customer` without token | Rejected | | 🔲 N/T | MAJOR | |
| BR-03-02 | Onboarding token is single-use | Reuse same token | Rejected; session invalid | | 🔲 N/T | MAJOR | |
| BR-03-03 | Onboarding session atomic — partial submit blocked | Submit without all required steps | Rejected with clear error | | 🔲 N/T | CRITICAL | |
| BR-03-04 | Company not accessible until approved | Login with pending company | Redirect to `/pending-approval` | | 🔲 N/T | CRITICAL | |
| BR-03-05 | Rejected company cannot re-submit without new application | Rejected company submits again | Blocked; contact admin message | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## BR-04 · Bid / Quote Rules

| ID | Rule | Test Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BR-04-01 | Driver can only bid on open jobs | Bid on assigned/cancelled job | Rejected | | 🔲 N/T | CRITICAL | |
| BR-04-02 | Driver cannot bid on own company's jobs (if applicable) | Self-bid attempt | Rejected or warning shown | | 🔲 N/T | MAJOR | |
| BR-04-03 | Duplicate bid rejected (same driver, same job) | Submit second bid | Rejected; unique constraint | | 🔲 N/T | MAJOR | |
| BR-04-04 | Bid amount must be > 0 | Submit bid with 0 | Front-end and back-end both reject | | 🔲 N/T | MAJOR | |
| BR-04-05 | Award only valid bid (not rejected/cancelled) | Award a previously rejected bid | Rejected | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## BR-05 · Invoice & Finance Rules

| ID | Rule | Test Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BR-05-01 | Invoice only generated for delivered job | Generate invoice for in_progress job | Blocked or error | | 🔲 N/T | MAJOR | |
| BR-05-02 | Invoice amount matches awarded bid amount | Compare `invoices.amount` to `job_bids.amount` | Match | | 🔲 N/T | CRITICAL | |
| BR-05-03 | Invoice cannot be submitted twice (overpayment guard) | Submit same invoice twice | Second submit rejected (migration 129) | | 🔲 N/T | CRITICAL | |
| BR-05-04 | Dispute only openable on submitted invoice | Dispute on draft invoice | Blocked | | 🔲 N/T | MAJOR | |
| BR-05-05 | Admin can see all invoices; driver sees only own | Role-scoped query | Correct results per role | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## BR-06 · Access & Membership Rules

| ID | Rule | Test Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| BR-06-01 | User cannot be member of two companies simultaneously | Add user already in Company A to Company B | Blocked or requires removal first | | 🔲 N/T | MAJOR | |
| BR-06-02 | Deactivated user cannot login | Login as deactivated user | Login rejected | | 🔲 N/T | CRITICAL | |
| BR-06-03 | Suspended company — members lose access | Login as member of suspended company | Redirect to suspended notice | | 🔲 N/T | CRITICAL | |
| BR-06-04 | Driver must be available to receive job notifications | Unavailable driver | Not notified of new nearby jobs | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| BR-01 Job State Machine | 6 | | | | |
| BR-02 Journey State Machine | 7 | | | | |
| BR-03 Onboarding State Machine | 5 | | | | |
| BR-04 Bid/Quote Rules | 5 | | | | |
| BR-05 Invoice & Finance | 5 | | | | |
| BR-06 Access & Membership | 4 | | | | |
| **TOTAL** | **32** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
