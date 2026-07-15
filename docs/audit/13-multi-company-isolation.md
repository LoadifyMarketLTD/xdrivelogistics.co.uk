# Audit 13 — Multi-Company Isolation Audit

> Production Certification Phase · Development Freeze Active
> Verify that no company can access data belonging to another company.
> All tests must use real authenticated sessions — no service role bypass.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Company A (test) | |
| Company A user | |
| Company B (test) | |
| Company B user | |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## ISO-01 · Job Isolation

| ID | Check | Method (auth as Company B) | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| ISO-01-01 | Company B cannot see Company A's jobs in list | GET `/customer` | Company A jobs absent from list | | 🔲 N/T | CRITICAL | |
| ISO-01-02 | Company B cannot access Company A's job detail | GET `/customer/jobs/<Company-A-job-id>` | 403 or redirect | | 🔲 N/T | CRITICAL | |
| ISO-01-03 | Company B cannot edit Company A's job | PUT/PATCH on Company A job | Error; 0 rows updated | | 🔲 N/T | CRITICAL | |
| ISO-01-04 | Company B cannot cancel Company A's job | Cancel action | Error; status not changed | | 🔲 N/T | CRITICAL | |
| ISO-01-05 | API: `SELECT * FROM jobs` as Company B | Supabase client with Company B auth | Only Company B rows returned | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## ISO-02 · Bid / Quote Isolation

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| ISO-02-01 | Driver A cannot see Driver B's bids | Auth as Driver B; `SELECT * FROM job_bids` | Only Driver B's own bids | | 🔲 N/T | CRITICAL | |
| ISO-02-02 | Company A customer cannot see bids on Company B's jobs | Auth as Company A; query bids for Company B job | 0 rows | | 🔲 N/T | CRITICAL | |
| ISO-02-03 | Company A cannot award a bid on Company B's job | POST `/api/customer/bids/[id]/award` as Company A | 403 | | 🔲 N/T | CRITICAL | |
| ISO-02-04 | `job_bids_with_job_owner` view — Company A sees only own | Auth as Company A; `SELECT * FROM job_bids_with_job_owner` | Only rows where `company_owner_id` = Company A | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## ISO-03 · Invoice Isolation

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| ISO-03-01 | Driver A cannot see Driver B's invoices | Auth as Driver A; `SELECT * FROM invoices` | Only Driver A invoices | | 🔲 N/T | CRITICAL | |
| ISO-03-02 | Driver A cannot access Driver B's invoice detail URL | GET `/driver/finance/invoices/<Driver-B-invoice-id>` | 403 or empty | | 🔲 N/T | CRITICAL | |
| ISO-03-03 | Driver A cannot submit Driver B's invoice | POST `/api/driver/finance/invoices/<Driver-B-id>/submit` | 403 | | 🔲 N/T | CRITICAL | |
| ISO-03-04 | Admin can see all invoices | Auth as admin; `SELECT count(*) FROM invoices` | All invoices returned | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## ISO-04 · Document Isolation

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| ISO-04-01 | Company A cannot list Company B's documents | Auth as Company A; `SELECT * FROM company_documents WHERE company_id = <B>` | 0 rows | | 🔲 N/T | CRITICAL | |
| ISO-04-02 | Company A cannot download Company B's document via signed URL | Generate URL for Company B doc as Company A | 403 or URL not generated | | 🔲 N/T | CRITICAL | |
| ISO-04-03 | Driver A cannot read Driver B's driver-docs in Storage | Direct Storage path access as Driver A | 403 | | 🔲 N/T | CRITICAL | |
| ISO-04-04 | pod-photos: Company A cannot access Company B's POD photos | Signed URL attempt | 403 | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## ISO-05 · Profile & Driver Isolation

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| ISO-05-01 | Driver A cannot update Driver B's profile | Auth as Driver A; `UPDATE drivers WHERE id = <B>` | 0 rows updated | | 🔲 N/T | CRITICAL | |
| ISO-05-02 | Driver A cannot see Driver B's location history | Auth as Driver A; `SELECT * FROM driver_locations WHERE driver_id = <B>` | 0 rows | | 🔲 N/T | CRITICAL | |
| ISO-05-03 | Company A cannot see Company B's member list | Auth as Company A; `SELECT * FROM company_memberships WHERE company_id = <B>` | 0 rows | | 🔲 N/T | CRITICAL | |
| ISO-05-04 | Company A cannot see Company B's vehicles | Auth as Company A; `SELECT * FROM vehicles WHERE company_id = <B>` | 0 rows | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## ISO-06 · Notification Isolation

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| ISO-06-01 | User A cannot read User B's notifications | Auth as User A; `SELECT * FROM notifications WHERE recipient_id = <User B>` | 0 rows | | 🔲 N/T | CRITICAL | |
| ISO-06-02 | Realtime notification channel scoped to user | Browser realtime subscription | Only own notifications received | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| ISO-01 Job Isolation | 5 | | | | |
| ISO-02 Bid/Quote Isolation | 4 | | | | |
| ISO-03 Invoice Isolation | 4 | | | | |
| ISO-04 Document Isolation | 4 | | | | |
| ISO-05 Profile & Driver | 4 | | | | |
| ISO-06 Notification | 2 | | | | |
| **TOTAL** | **23** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
