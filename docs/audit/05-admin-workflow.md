# Audit 05 — Admin Workflow

> Production Certification Phase · Development Freeze Active

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Environment | https://www.xdrivelogistics.co.uk |
| Test account (admin) | |
| Test account (super-admin) | |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## AW-01 · Admin Access & Dashboard

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| AW-01-01 | Login as admin | POST `/login` | Redirect to `/admin` | | 🔲 N/T | | |
| AW-01-02 | Admin dashboard overview | GET `/admin` | KPIs, recent activity, alerts displayed | | 🔲 N/T | | |
| AW-01-03 | Access `/admin` with non-admin role | Customer/driver session | 403 or redirect to `/forbidden` | | 🔲 N/T | | |
| AW-01-04 | Login as super-admin | POST `/login` | Redirect to `/super-admin` | | 🔲 N/T | | |
| AW-01-05 | Super-admin dashboard | GET `/super-admin` | Platform-wide overview displayed | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AW-02 · User Management

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| AW-02-01 | List all users | `/super-admin/users` | All registered users with roles and status | | 🔲 N/T | | |
| AW-02-02 | Search/filter users by role | Filter control | Filtered correctly | | 🔲 N/T | | |
| AW-02-03 | Search users by name/email | Search input | Matching users returned | | 🔲 N/T | | |
| AW-02-04 | View user profile detail | Click user | Full profile with history shown | | 🔲 N/T | | |
| AW-02-05 | Change user role | Role update action | Role updated in DB; session reflects new role on next login | | 🔲 N/T | | |
| AW-02-06 | Deactivate user account | Deactivate action | User cannot login; sessions invalidated | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AW-03 · Company Management

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| AW-03-01 | List all companies | `/super-admin/companies` or `/admin/companies` | All companies with status and type | | 🔲 N/T | | |
| AW-03-02 | Filter companies by status (pending / approved / suspended) | Filter control | Correct subset shown | | 🔲 N/T | | |
| AW-03-03 | View company detail | GET `/api/super-admin/companies/[id]` | Full company profile, documents, members | | 🔲 N/T | | |
| AW-03-04 | Approve pending company | POST `/api/super-admin/onboarding/[id]` | Company status → `approved`; owner notified | | 🔲 N/T | | |
| AW-03-05 | Reject company with reason | Reject action | Company status → `rejected`; owner notified with reason | | 🔲 N/T | | |
| AW-03-06 | Suspend active company | Suspend action | Company members lose access; jobs paused | | 🔲 N/T | | |
| AW-03-07 | Re-activate suspended company | Re-activate action | Access restored; notification sent | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AW-04 · Marketplace & Jobs

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| AW-04-01 | View all jobs on marketplace | `/admin/marketplace` | All open jobs across all companies | | 🔲 N/T | | |
| AW-04-02 | Filter jobs by status | Filter control | Correct jobs returned | | 🔲 N/T | | |
| AW-04-03 | View job detail (admin view) | Click job | Full job with bids, company, driver | | 🔲 N/T | | |
| AW-04-04 | Assign driver to job manually | POST `/api/admin/jobs/[id]/assign-driver` | Job assigned; driver notified | | 🔲 N/T | | |
| AW-04-05 | Accept bid (admin) | POST `/api/admin/bids/[id]/accept` | Bid accepted; job allocated | | 🔲 N/T | | |
| AW-04-06 | Reject bid (admin) | POST `/api/admin/bids/[id]/reject` | Bid rejected; driver notified | | 🔲 N/T | | |
| AW-04-07 | View all bids | `/admin/bids` | All bids platform-wide listed | | 🔲 N/T | | |
| AW-04-08 | View all quotes | `/admin/quotes` | All driver quotes listed | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AW-05 · Disputes & Invoices

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| AW-05-01 | View open disputes | `/admin/disputes` | All active disputes listed | | 🔲 N/T | | |
| AW-05-02 | View dispute detail | Click dispute | Full context: job, driver, customer, reason | | 🔲 N/T | | |
| AW-05-03 | Resolve dispute | Resolution action | Status updated; both parties notified | | 🔲 N/T | | |
| AW-05-04 | View all invoices | `/admin/invoices` | All platform invoices with status | | 🔲 N/T | | |
| AW-05-05 | View invoice payment history | GET `/api/admin/invoices/[id]/payment-history` | Payment records displayed | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AW-06 · Drivers, Vehicles & Fleet

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| AW-06-01 | View all drivers | `/admin/drivers` or GET `/api/admin/drivers` | All drivers with company and status | | 🔲 N/T | | |
| AW-06-02 | View all vehicles | `/admin/vehicles` | All vehicles with owner company | | 🔲 N/T | | |
| AW-06-03 | View drivers-vehicles combined | `/admin/drivers-vehicles` | Combined view with assignments | | 🔲 N/T | | |
| AW-06-04 | View fleet live map | `/admin/fleet` | Map with all active drivers' positions | | 🔲 N/T | | |
| AW-06-05 | View operations centre | `/admin/operations-centre` | Real-time ops overview | | 🔲 N/T | | |
| AW-06-06 | View dispatchers | `/admin/dispatchers` | GET `/api/admin/dispatchers` returns data | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AW-07 · Documents, Audit & Reports

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| AW-07-01 | View platform documents | `/admin/documents` | All uploaded documents accessible | | 🔲 N/T | | |
| AW-07-02 | View audit log | GET `/api/super-admin/audit` | User actions logged with timestamp and actor | | 🔲 N/T | | |
| AW-07-03 | Platform health check | `/super-admin/health` | All services reported healthy | | 🔲 N/T | | |
| AW-07-04 | View platform analytics | `/super-admin/analytics` | Revenue, jobs, user stats displayed | | 🔲 N/T | | |
| AW-07-05 | View finance summary | GET `/api/super-admin/finance` | Aggregated financial data correct | | 🔲 N/T | | |
| AW-07-06 | Admin settings | `/admin/settings` | Settings accessible and saveable | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## AW-08 · Notifications (Admin)

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| AW-08-01 | View notifications sent platform-wide | `/super-admin/notifications` | Full notification history | | 🔲 N/T | | |
| AW-08-02 | Send manual notification to user | Broadcast action | Notification delivered to target user | | 🔲 N/T | | |
| AW-08-03 | Email readiness check | GET `/api/super-admin/email-readiness` | Email provider connected; config valid | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| AW-01 Access & Dashboard | 5 | | | | |
| AW-02 User Management | 6 | | | | |
| AW-03 Company Management | 7 | | | | |
| AW-04 Marketplace & Jobs | 8 | | | | |
| AW-05 Disputes & Invoices | 5 | | | | |
| AW-06 Drivers, Vehicles & Fleet | 6 | | | | |
| AW-07 Documents, Audit & Reports | 6 | | | | |
| AW-08 Notifications | 3 | | | | |
| **TOTAL** | **46** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
