# Audit 18 — API Contract Audit

> Production Certification Phase · Development Freeze Active
> Verify that every API endpoint returns the correct shape, status codes, and enforces auth.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Base URL | https://www.xdrivelogistics.co.uk |
| Tool | Postman / curl / browser DevTools |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

## Test Protocol

For each endpoint:
1. Test **unauthenticated** → expect `401`
2. Test **wrong role** → expect `403`
3. Test **authenticated, correct role** → expect `2xx` with valid body
4. Test **invalid input** → expect `4xx` with error message

---

## API-01 · Onboarding Endpoints

| ID | Method | Endpoint | Auth Role | Expected Status | Expected Body Shape | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|---|---|
| API-01-01 | POST | `/api/onboarding/init` | authenticated | 200 | `{ token: string }` | | 🔲 N/T | CRITICAL | |
| API-01-02 | POST | `/api/onboarding/customer/session` | authenticated + token | 200 | `{ step: string, sessionData: object }` | | 🔲 N/T | MAJOR | |
| API-01-03 | POST | `/api/onboarding/broker/session` | authenticated + token | 200 | Session state | | 🔲 N/T | MAJOR | |
| API-01-04 | POST | `/api/onboarding/fleet/session` | authenticated + token | 200 | Session state | | 🔲 N/T | MAJOR | |
| API-01-05 | POST | `/api/onboarding/owner-driver/session` | authenticated + token | 200 | Session state | | 🔲 N/T | MAJOR | |
| API-01-06 | POST | `/api/onboarding/documents` | authenticated + token | 200 | `{ url: string }` or file ref | | 🔲 N/T | MAJOR | |
| API-01-07 | POST | `/api/onboarding/submit/customer` | authenticated | 200 | `{ status: 'pending_approval' }` | | 🔲 N/T | CRITICAL | |
| API-01-08 | POST | `/api/onboarding/submit/broker` | authenticated | 200 | Same | | 🔲 N/T | CRITICAL | |
| API-01-09 | POST | `/api/onboarding/submit/fleet` | authenticated | 200 | Same | | 🔲 N/T | CRITICAL | |
| API-01-10 | POST | `/api/onboarding/submit/owner-driver` | authenticated | 200 | Same | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## API-02 · Customer Endpoints

| ID | Method | Endpoint | Auth Role | Expected Status | Notes | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|---|---|
| API-02-01 | POST | `/api/customer/bids/[id]/award` | customer | 200 | Awards bid; validates ownership | | 🔲 N/T | CRITICAL | |
| API-02-02 | POST | `/api/customer/bids/[id]/award` | driver (wrong role) | 403 | | | 🔲 N/T | CRITICAL | |
| API-02-03 | POST | `/api/customer/bids/[id]/award` | no auth | 401 | | | 🔲 N/T | CRITICAL | |
| API-02-04 | POST | `/api/customer/bids/[id]/award` | customer, already awarded | 4xx | Idempotent guard | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## API-03 · Driver Web Endpoints

| ID | Method | Endpoint | Auth Role | Expected Status | Notes | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|---|---|
| API-03-01 | GET | `/api/driver/search-loads` | driver | 200 | Array of job objects | | 🔲 N/T | MAJOR | |
| API-03-02 | POST | `/api/driver/location` | driver | 200 | Location upserted | | 🔲 N/T | CRITICAL | |
| API-03-03 | POST | `/api/driver/password` | driver | 200 | Password updated | | 🔲 N/T | MAJOR | |
| API-03-04 | GET | `/api/driver/finance/invoices` | driver | 200 | Array of own invoices | | 🔲 N/T | MAJOR | |
| API-03-05 | GET | `/api/driver/finance/invoices/[id]` | driver (own) | 200 | Invoice object | | 🔲 N/T | MAJOR | |
| API-03-06 | GET | `/api/driver/finance/invoices/[id]` | driver (other) | 403 | | | 🔲 N/T | CRITICAL | |
| API-03-07 | POST | `/api/driver/finance/invoices/[id]/submit` | driver (own) | 200 | Invoice status → submitted | | 🔲 N/T | CRITICAL | |
| API-03-08 | POST | `/api/driver/finance/invoices/[id]/disputes` | driver | 200 | Dispute created | | 🔲 N/T | MAJOR | |
| API-03-09 | POST | `/api/driver/finance/jobs/[jobId]/generate-invoice` | driver | 200 | `{ invoiceId: string }` | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## API-04 · Driver Mobile Endpoints

| ID | Method | Endpoint | Auth Role | Expected Status | Notes | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|---|---|
| API-04-01 | GET | `/api/driver/mobile/config` | public | 200 | `{ supabaseUrl, supabaseAnonKey }` only | | 🔲 N/T | CRITICAL | |
| API-04-02 | GET | `/api/driver/mobile/resources` | driver | 200 | Driver, company, vehicle, documents, invoices, alerts | | 🔲 N/T | CRITICAL | |
| API-04-03 | GET | `/api/driver/mobile/nearby-jobs` | driver | 200 | Array of nearby jobs | | 🔲 N/T | CRITICAL | |
| API-04-04 | GET | `/api/driver/mobile/jobs` | driver | 200 | Driver's jobs array | | 🔲 N/T | MAJOR | |
| API-04-05 | GET | `/api/driver/mobile/jobs/[id]` | driver (own) | 200 | Job detail object | | 🔲 N/T | MAJOR | |
| API-04-06 | POST | `/api/driver/mobile/bids` | driver | 200 | Bid created | | 🔲 N/T | CRITICAL | |
| API-04-07 | POST | `/api/driver/mobile/jobs/[id]/[action]` | driver | 200 | Status updated | | 🔲 N/T | CRITICAL | |
| API-04-08 | POST | `/api/driver/mobile/device-token` | driver | 200 | Token saved | | 🔲 N/T | MAJOR | |
| API-04-09 | All mobile endpoints — no auth | No Authorization header | 401 | | | 🔲 N/T | CRITICAL | |
| API-04-10 | All mobile endpoints — service role required | Without `SUPABASE_SERVICE_ROLE_KEY` | 503 with clear message | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## API-05 · Admin Endpoints

| ID | Method | Endpoint | Auth Role | Expected Status | Notes | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|---|---|
| API-05-01 | GET | `/api/admin/drivers` | admin | 200 | Array of drivers | | 🔲 N/T | MAJOR | |
| API-05-02 | GET | `/api/admin/dispatchers` | admin | 200 | Array of dispatchers | | 🔲 N/T | MINOR | |
| API-05-03 | POST | `/api/admin/jobs/[id]/assign-driver` | admin | 200 | Job assigned | | 🔲 N/T | MAJOR | |
| API-05-04 | POST | `/api/admin/bids/[id]/accept` | admin | 200 | Bid accepted | | 🔲 N/T | MAJOR | |
| API-05-05 | POST | `/api/admin/bids/[id]/reject` | admin | 200 | Bid rejected | | 🔲 N/T | MAJOR | |
| API-05-06 | GET | `/api/admin/bids/identities` | admin | 200 | Bid identity data | | 🔲 N/T | MINOR | |
| API-05-07 | GET | `/api/admin/invoices/[id]/payment-history` | admin | 200 | Payment history array | | 🔲 N/T | MAJOR | |
| API-05-08 | GET | `/api/admin/operations-centre` | admin | 200 | Ops overview data | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## API-06 · Super-Admin Endpoints

| ID | Method | Endpoint | Auth Role | Expected Status | Notes | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|---|---|
| API-06-01 | GET | `/api/super-admin/companies` | super-admin | 200 | Array of companies | | 🔲 N/T | MAJOR | |
| API-06-02 | GET | `/api/super-admin/companies/[id]` | super-admin | 200 | Company detail | | 🔲 N/T | MAJOR | |
| API-06-03 | PATCH/DELETE | `/api/super-admin/companies/[id]` | super-admin | 200 | Updated/deleted | | 🔲 N/T | MAJOR | |
| API-06-04 | GET | `/api/super-admin/audit` | super-admin | 200 | Audit log array | | 🔲 N/T | MAJOR | |
| API-06-05 | GET | `/api/super-admin/finance` | super-admin | 200 | Finance summary | | 🔲 N/T | MAJOR | |
| API-06-06 | GET | `/api/super-admin/stats` | super-admin | 200 | Platform stats | | 🔲 N/T | MINOR | |
| API-06-07 | GET | `/api/super-admin/email-readiness` | super-admin | 200 | `{ ready: true }` | | 🔲 N/T | CRITICAL | |
| API-06-08 | GET | `/api/super-admin/compliance` | super-admin | 200 | Compliance data | | 🔲 N/T | MINOR | |
| API-06-09 | GET | `/api/super-admin/marketplace` | super-admin | 200 | All marketplace jobs | | 🔲 N/T | MINOR | |
| API-06-10 | All super-admin endpoints as admin (not super) | admin JWT | 403 | | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## API-07 · Public & Support Endpoints

| ID | Method | Endpoint | Auth | Expected Status | Notes | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|---|---|
| API-07-01 | POST | `/api/public/quote-request` | public | 200 | Quote request saved | | 🔲 N/T | MAJOR | |
| API-07-02 | POST | `/api/support/tickets` | authenticated | 200 | Ticket created | | 🔲 N/T | MINOR | |
| API-07-03 | GET | `/api/super-admin/platform` | super-admin | 200 | Platform config | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## API-08 · Error Response Standards

| ID | Check | Test | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| API-08-01 | 401 response is JSON | Unauthenticated request | `{ error: string }` — not HTML | | 🔲 N/T | MAJOR | |
| API-08-02 | 403 response is JSON | Wrong role request | `{ error: string }` — not HTML | | 🔲 N/T | MAJOR | |
| API-08-03 | 500 does not expose stack trace | Force a server error | Generic error message only | | 🔲 N/T | MAJOR | |
| API-08-04 | 422 validation errors are descriptive | POST with invalid body | Field-level error details returned | | 🔲 N/T | MINOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| API-01 Onboarding | 10 | | | | |
| API-02 Customer | 4 | | | | |
| API-03 Driver Web | 9 | | | | |
| API-04 Driver Mobile | 10 | | | | |
| API-05 Admin | 8 | | | | |
| API-06 Super-Admin | 10 | | | | |
| API-07 Public & Support | 3 | | | | |
| API-08 Error Standards | 4 | | | | |
| **TOTAL** | **58** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
