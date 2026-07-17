# Audit 04 — Fleet Workflow

> Production Certification Phase · Development Freeze Active

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Environment | https://www.xdrivelogistics.co.uk |
| Test account (fleet manager) | |
| Test driver account | |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## FW-01 · Fleet Onboarding & Access

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FW-01-01 | Register as fleet company | POST `/api/onboarding/init` | Fleet onboarding flow initiated | | 🔲 N/T | | |
| FW-01-02 | Complete fleet onboarding session | POST `/api/onboarding/fleet/session` | Session state saved | | 🔲 N/T | | |
| FW-01-03 | Submit fleet application | POST `/api/onboarding/submit/fleet` | Status = `pending_approval`; admin notified | | 🔲 N/T | | |
| FW-01-04 | Login after admin approval | POST `/login` | Redirect to appropriate dashboard | | 🔲 N/T | | |
| FW-01-05 | Register as owner-driver | POST `/api/onboarding/submit/owner-driver` | Owner-driver created; dual role accessible | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## FW-02 · Driver Management

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FW-02-01 | View fleet drivers list | `/admin/drivers` or fleet manager view | All company drivers listed | | 🔲 N/T | | |
| FW-02-02 | Add driver to fleet | Invite/add action | Invitation sent; driver appears as pending | | 🔲 N/T | | |
| FW-02-03 | Driver accepts invitation | Driver action | Driver added to fleet; company membership created | | 🔲 N/T | | |
| FW-02-04 | Edit driver profile (fleet manager) | Edit action | Changes saved; driver profile updated | | 🔲 N/T | | |
| FW-02-05 | Deactivate driver | Deactivate action | Driver access revoked; no longer appears in active list | | 🔲 N/T | | |
| FW-02-06 | View driver availability status | Fleet view | Real-time availability displayed per driver | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## FW-03 · Vehicle Management

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FW-03-01 | Add vehicle | `/admin/vehicles` or fleet vehicle form | Vehicle created with all required fields | | 🔲 N/T | | |
| FW-03-02 | Edit vehicle details | Edit action | Changes saved correctly | | 🔲 N/T | | |
| FW-03-03 | Assign vehicle to driver | Assignment action | Driver-vehicle association saved | | 🔲 N/T | | |
| FW-03-04 | Upload vehicle document (insurance) | Document upload | File stored in `vehicle-docs` bucket; expiry date saved | | 🔲 N/T | | |
| FW-03-05 | Upload vehicle document (MOT/ITP) | Document upload | File stored; expiry date saved | | 🔲 N/T | | |
| FW-03-06 | Document expiry alert generated | Expiry within threshold | Alert/notification generated for fleet manager | | 🔲 N/T | | |
| FW-03-07 | Deactivate vehicle | Deactivate action | Vehicle no longer assignable to jobs | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## FW-04 · Job Distribution & Monitoring

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FW-04-01 | Fleet driver submits bid on marketplace job | Driver action | Bid appears in fleet manager view | | 🔲 N/T | | |
| FW-04-02 | Assign job directly to specific fleet driver | Assignment action | Driver notified; job in driver's queue | | 🔲 N/T | | |
| FW-04-03 | View all active jobs for fleet | Fleet overview | All in-progress jobs with driver assignment shown | | 🔲 N/T | | |
| FW-04-04 | Monitor driver live position | `/admin/fleet` map | Real-time positions updated from `driver_locations` | | 🔲 N/T | | |
| FW-04-05 | View fleet map — driver tracking | Fleet map view | All active drivers with GPS visible | | 🔲 N/T | | |
| FW-04-06 | View dispatchers list | `/admin/dispatchers` | Fleet dispatchers listed | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## FW-05 · Company Documents & Compliance

| ID | Step | Route / Action | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| FW-05-01 | Upload company document (operator licence) | Document upload | File stored in correct bucket; visible to admin | | 🔲 N/T | | |
| FW-05-02 | Upload company insurance document | Document upload | File stored; expiry date tracked | | 🔲 N/T | | |
| FW-05-03 | Admin can view company documents | Admin → companies | Documents accessible from admin panel | | 🔲 N/T | | |
| FW-05-04 | Document expiry notification | Near-expiry document | Fleet manager and/or admin alerted | | 🔲 N/T | | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| FW-01 Onboarding & Access | 5 | | | | |
| FW-02 Driver Management | 6 | | | | |
| FW-03 Vehicle Management | 7 | | | | |
| FW-04 Job Distribution | 6 | | | | |
| FW-05 Documents & Compliance | 4 | | | | |
| **TOTAL** | **28** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
