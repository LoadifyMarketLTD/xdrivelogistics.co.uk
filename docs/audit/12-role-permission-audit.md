# Audit 12 — Role & Permission Audit

> Production Certification Phase · Development Freeze Active
> Verify that every role can access exactly what it should and nothing more.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Environment | https://www.xdrivelogistics.co.uk |

## Roles Under Test

| Role | Dashboard | Test Account |
|---|---|---|
| `customer` | `/customer` | |
| `driver` | `/driver` | |
| `broker` | `/broker` | |
| `fleet_manager` | Fleet admin view | |
| `admin` | `/admin` | |
| `super_admin` | `/super-admin` | |
| Unauthenticated | None | N/A |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## RP-01 · Route Access Matrix

Test each role against each route. Expected: ✅ = access allowed, ❌ = blocked (redirect to `/forbidden` or `/login`).

| Route | customer | driver | broker | fleet_manager | admin | super_admin | unauth |
|---|---|---|---|---|---|---|---|
| `/` (homepage) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/login` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/register` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/customer` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/customer/jobs/[id]` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/driver` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/driver/loads` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/driver/won-work` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/driver/finance` | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/broker` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/admin` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `/admin/marketplace` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `/admin/disputes` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `/admin/invoices` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `/super-admin` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/super-admin/users` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/super-admin/companies` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/forbidden` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/m` (mobile web) | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Actual test results — fill in each cell:**

| Route | customer | driver | broker | admin | super_admin | unauth |
|---|---|---|---|---|---|---|
| `/customer` | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| `/driver` | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| `/broker` | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| `/admin` | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |
| `/super-admin` | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 | 🔲 |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## RP-02 · API Endpoint Authorization

| ID | Endpoint | Authorized Role | Unauthorized Test | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|---|
| RP-02-01 | POST `/api/customer/bids/[id]/award` | customer only | Call as driver JWT | 403 | | 🔲 N/T | CRITICAL | |
| RP-02-02 | POST `/api/driver/mobile/bids` | driver only | Call as customer JWT | 403 | | 🔲 N/T | CRITICAL | |
| RP-02-03 | POST `/api/driver/location` | driver only | Call as customer JWT | 403 | | 🔲 N/T | CRITICAL | |
| RP-02-04 | GET `/api/admin/drivers` | admin / super-admin | Call as customer JWT | 403 | | 🔲 N/T | CRITICAL | |
| RP-02-05 | POST `/api/admin/jobs/[id]/assign-driver` | admin / super-admin | Call as driver JWT | 403 | | 🔲 N/T | CRITICAL | |
| RP-02-06 | GET `/api/super-admin/companies` | super-admin only | Call as admin JWT | 403 | | 🔲 N/T | CRITICAL | |
| RP-02-07 | GET `/api/super-admin/audit` | super-admin only | Call as customer JWT | 403 | | 🔲 N/T | CRITICAL | |
| RP-02-08 | POST `/api/driver/finance/invoices/[id]/submit` | driver (own) only | Call as another driver JWT | 403 or 0 rows | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## RP-03 · Middleware Role Enforcement

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| RP-03-01 | `/super-admin` in `PROTECTED_PATH_PREFIXES` | Review `middleware.ts` | Path listed and enforced | | 🔲 N/T | CRITICAL | |
| RP-03-02 | `/broker` in `PROTECTED_PATH_PREFIXES` | Review `middleware.ts` | Path listed and enforced | | 🔲 N/T | CRITICAL | |
| RP-03-03 | `/admin` in `PROTECTED_PATH_PREFIXES` | Review `middleware.ts` | Path listed and enforced | | 🔲 N/T | CRITICAL | |
| RP-03-04 | `/driver` in `PROTECTED_PATH_PREFIXES` | Review `middleware.ts` | Path listed and enforced | | 🔲 N/T | CRITICAL | |
| RP-03-05 | `/customer` in `PROTECTED_PATH_PREFIXES` | Review `middleware.ts` | Path listed and enforced | | 🔲 N/T | CRITICAL | |
| RP-03-06 | `/m` in `PROTECTED_PATH_PREFIXES` | Review `middleware.ts` | Path listed and enforced | | 🔲 N/T | CRITICAL | |
| RP-03-07 | `isRoleAllowedForPath` correctly maps roles to paths | Unit/functional test | Each role maps to correct set of paths | | 🔲 N/T | CRITICAL | |
| RP-03-08 | Role resolved from `profiles.role` + `company_memberships.role_in_company` | Middleware logic | Most authoritative role selected correctly | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## RP-04 · Database-Level Role Policies

| ID | Check | SQL | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| RP-04-01 | Admin can read all jobs | Auth as admin; `SELECT count(*) FROM jobs` | All jobs returned | | 🔲 N/T | MAJOR | |
| RP-04-02 | Customer can only read own company's jobs | Auth as customer; `SELECT * FROM jobs` | Only own jobs | | 🔲 N/T | CRITICAL | |
| RP-04-03 | Driver can only read own bids | Auth as driver; `SELECT * FROM job_bids WHERE driver_id != auth.uid()` | 0 rows | | 🔲 N/T | CRITICAL | |
| RP-04-04 | Service role bypasses RLS | Auth as service_role; `SELECT count(*) FROM jobs` | All rows (expected bypass) | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| RP-01 Route Access | 6 routes × 6 roles | | | | |
| RP-02 API Authorization | 8 | | | | |
| RP-03 Middleware | 8 | | | | |
| RP-04 DB Policies | 4 | | | | |
| **TOTAL** | **~56** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
