# XDrive Automated Audit Report

> Generated: 2026-08-01T18:11:46.530Z
> Script: `scripts/run-automated-audit.mjs`
> Coverage: Static code analysis + lint + typecheck + unit tests
> Note: Checks requiring a live Supabase database or browser are marked ⚠️ MANUAL

---

## DB-01 — Migration Integrity

| ID | Status | Note |
|---|---|---|
| `DB-01-01` | ✅ PASS | Highest numbered migration: 129 |
| `DB-01-02` | ✅ PASS | No duplicate migration version numbers |
| `DB-01-03` | ✅ PASS | Sequence 001–129 is complete |
| `DB-01-04` | ✅ PASS | Migration 129 serialize_overpayment_guard found |
| `DB-01-05` | ✅ PASS | Total migration files: 191 |

**Section: 5 PASS · 0 FAIL · 0 MANUAL**

---

## DB-02 — Schema Integrity (Tables & Columns)

| ID | Status | Note |
|---|---|---|
| `DB-02-TABLE-driver_device_tokens` | ✅ PASS | "driver_device_tokens" implemented as column "device_token" on "drivers" (106_driver_device_tokens) — ✅ confirmed |
| `DB-02-jobs.id` | ✅ PASS | Column "id" found in migrations |
| `DB-02-jobs.company_id` | ✅ PASS | Column "company_id" found in migrations |
| `DB-02-jobs.status` | ✅ PASS | Column "status" found in migrations |
| `DB-02-jobs.pickup_location` | ✅ PASS | Column "pickup_location" found in migrations |
| `DB-02-jobs.delivery_location` | ✅ PASS | Column "delivery_location" found in migrations |
| `DB-02-jobs.created_at` | ✅ PASS | Column "created_at" found in migrations |
| `DB-02-jobs.updated_at` | ✅ PASS | Column "updated_at" found in migrations |
| `DB-02-job_bids.id` | ✅ PASS | Column "id" found in migrations |
| `DB-02-job_bids.job_id` | ✅ PASS | Column "job_id" found in migrations |
| `DB-02-job_bids.driver_id` | ✅ PASS | Column "driver_id" found in migrations |
| `DB-02-job_bids.company_id` | ✅ PASS | Column "company_id" found in migrations |
| `DB-02-job_bids.amount` | ✅ PASS | Column "amount" found in migrations |
| `DB-02-job_bids.status` | ✅ PASS | Column "status" found in migrations |
| `DB-02-job_bids.created_at` | ✅ PASS | Column "created_at" found in migrations |
| `DB-02-companies.id` | ✅ PASS | Column "id" found in migrations |
| `DB-02-companies.name` | ✅ PASS | Column "name" found in migrations |
| `DB-02-companies.status` | ✅ PASS | Column "status" found in migrations |
| `DB-02-companies.created_at` | ✅ PASS | Column "created_at" found in migrations |
| `DB-02-profiles.user_id` | ✅ PASS | Column "user_id" found in migrations |
| `DB-02-profiles.role` | ✅ PASS | Column "role" found in migrations |
| `DB-02-profiles.status` | ✅ PASS | Column "status" found in migrations |
| `DB-02-driver_locations.driver_id` | ✅ PASS | Column "driver_id" found in migrations |
| `DB-02-driver_locations.lat` | ✅ PASS | Column "lat" found in migrations |
| `DB-02-driver_locations.lng` | ✅ PASS | Column "lng" found in migrations |
| `DB-02-driver_locations.updated_at` | ✅ PASS | Column "updated_at" found in migrations |
| `DB-02-invoices.id` | ✅ PASS | Column "id" found in migrations |
| `DB-02-company_documents.id` | ✅ PASS | Column "id" found in migrations |
| `DB-02-company_documents.company_id` | ✅ PASS | Column "company_id" found in migrations |

**Section: 29 PASS · 0 FAIL · 0 MANUAL**

---

## DB-03 — Foreign Keys

| ID | Status | Note |
|---|---|---|
| `DB-03-jobs.company_id` | ✅ PASS | FK jobs.company_id → companies found |
| `DB-03-job_bids.job_id` | ✅ PASS | FK job_bids.job_id → jobs found |
| `DB-03-job_bids.company_id` | ✅ PASS | FK job_bids.company_id → companies found |
| `DB-03-profiles.user_id` | ✅ PASS | FK profiles.user_id → auth.users found |

**Section: 4 PASS · 0 FAIL · 0 MANUAL**

---

## DB-04 — Triggers

| ID | Status | Note |
|---|---|---|
| `DB-04-updated_at@jobs` | ✅ PASS | Trigger/function "updated_at" found in migrations |
| `DB-04-updated_at@job_bids` | ✅ PASS | Trigger/function "updated_at" found in migrations |
| `DB-04-notify_invoice_created` | ✅ PASS | Trigger/function "notify_invoice_created" found in migrations |
| `DB-04-serialize_overpayment` | ✅ PASS | Trigger/function "serialize_overpayment" found in migrations |

**Section: 4 PASS · 0 FAIL · 0 MANUAL**

---

## DB-07 — Indexes & Performance

| ID | Status | Note |
|---|---|---|
| `DB-07-jobs.status` | ✅ PASS | Index on jobs(status) found in migrations |
| `DB-07-jobs.company_id` | ✅ PASS | Index on jobs(company_id) found in migrations |
| `DB-07-job_bids.job_id` | ✅ PASS | Index on job_bids(job_id) found in migrations |
| `DB-07-driver_locations.driver_id` | ✅ PASS | Index on driver_locations(driver_id) found in migrations |

**Section: 4 PASS · 0 FAIL · 0 MANUAL**

---

## SEC-01 — Row Level Security

| ID | Status | Note |
|---|---|---|
| `SEC-01-jobs` | ✅ PASS | RLS or policy found for table "jobs" |
| `SEC-01-job_bids` | ✅ PASS | RLS or policy found for table "job_bids" |
| `SEC-01-companies` | ✅ PASS | RLS or policy found for table "companies" |
| `SEC-01-profiles` | ✅ PASS | RLS or policy found for table "profiles" |
| `SEC-01-drivers` | ✅ PASS | RLS or policy found for table "drivers" |
| `SEC-01-vehicles` | ✅ PASS | RLS or policy found for table "vehicles" |
| `SEC-01-invoices` | ✅ PASS | RLS or policy found for table "invoices" |
| `SEC-01-company_documents` | ✅ PASS | RLS or policy found for table "company_documents" |
| `SEC-01-notifications` | ✅ PASS | RLS or policy found for table "notifications" |
| `SEC-01-driver_locations` | ✅ PASS | RLS or policy found for table "driver_locations" |
| `SEC-01-company_memberships` | ✅ PASS | RLS or policy found for table "company_memberships" |
| `SEC-01-job_disputes` | ✅ PASS | RLS or policy found for table "job_disputes" |

**Section: 12 PASS · 0 FAIL · 0 MANUAL**

---

## PR-03 — Storage Buckets

| ID | Status | Note |
|---|---|---|
| `PR-03-03-driver-docs` | ✅ PASS | Bucket "driver-docs" referenced in migrations |
| `PR-03-03-vehicle-docs` | ✅ PASS | Bucket "vehicle-docs" referenced in migrations |
| `PR-03-03-pod-photos` | ✅ PASS | Bucket "pod-photos" referenced in migrations |

**Section: 3 PASS · 0 FAIL · 0 MANUAL**

---

## PR-03 / DB-08 — Realtime Publications

| ID | Status | Note |
|---|---|---|
| `PR-03-05-jobs` | ⚠️ MANUAL | Realtime for "jobs" must be verified in Supabase dashboard (no migration evidence) |
| `PR-03-05-job_bids` | ⚠️ MANUAL | Realtime for "job_bids" must be verified in Supabase dashboard (no migration evidence) |
| `PR-03-05-driver_locations` | ⚠️ MANUAL | Realtime for "driver_locations" must be verified in Supabase dashboard (no migration evidence) |
| `PR-03-05-notifications` | ⚠️ MANUAL | Realtime for "notifications" must be verified in Supabase dashboard (no migration evidence) |

**Section: 0 PASS · 0 FAIL · 4 MANUAL**

---

## SEC-04 / RP-03 — Middleware Route Protection

| ID | Status | Note |
|---|---|---|
| `RP-03-super_admin` | ✅ PASS | "/super-admin" present in PROTECTED_PATH_PREFIXES |
| `RP-03-broker` | ✅ PASS | "/broker" present in PROTECTED_PATH_PREFIXES |
| `RP-03-admin` | ✅ PASS | "/admin" present in PROTECTED_PATH_PREFIXES |
| `RP-03-driver` | ✅ PASS | "/driver" present in PROTECTED_PATH_PREFIXES |
| `RP-03-customer` | ✅ PASS | "/customer" present in PROTECTED_PATH_PREFIXES |
| `RP-03-m` | ✅ PASS | "/m" present in PROTECTED_PATH_PREFIXES |
| `SEC-04-07` | ✅ PASS | isRoleAllowedForPath called in middleware for role enforcement |
| `SEC-03-01` | ✅ PASS | Unauthenticated requests redirected to /login in middleware |
| `SEC-04-01` | ✅ PASS | Forbidden redirect present in middleware |

**Section: 9 PASS · 0 FAIL · 0 MANUAL**

---

## SEC-06 — Environment & Secrets

| ID | Status | Note |
|---|---|---|
| `SEC-06-03` | ✅ PASS | NEXT_PUBLIC_ vars (NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) contain no sensitive n |
| `SEC-06-01` | ✅ PASS | SUPABASE_SERVICE_ROLE_KEY is not prefixed NEXT_PUBLIC_ in .env.example |
| `SEC-06-04-service_role` | ✅ PASS | No "service_role" commits found in git history  |
| `SEC-06-04-jwt_prefix` | ✅ PASS | No "eyJ" commits found in git history (JWT prefix (may be false positive for anon key)) |

**Section: 4 PASS · 0 FAIL · 0 MANUAL**

---

## PR-02-03 — ESLint

| ID | Status | Note |
|---|---|---|
| `PR-02-03` | ✅ PASS | ESLint passed with 0 warnings/errors |

**Section: 1 PASS · 0 FAIL · 0 MANUAL**

---

## PR-02-02 — TypeScript Typecheck

| ID | Status | Note |
|---|---|---|
| `PR-02-02` | ✅ PASS | TypeScript typecheck passed — 0 errors |

**Section: 1 PASS · 0 FAIL · 0 MANUAL**

---

## Unit Tests — Role & Permission (Audit 12)

| ID | Status | Note |
|---|---|---|
| `UNIT-TESTS` | ✅ PASS | All unit tests passed ilter decoding[2m > [22mpreserves URLSearchParams decoding for "customer=ACME%2BLogistics"[32m  |

**Section: 1 PASS · 0 FAIL · 0 MANUAL**

---

## Summary

| Status | Count |
|---|---|
| ✅ PASS | **77** |
| ❌ FAIL | **0** |
| ⚠️ MANUAL | **4** |
| **TOTAL** | **81** |

> 🟢 **All automatable checks PASS.** Proceed to manual audit phase for live DB and browser checks.

---

### Checks NOT covered by automation (require live platform)

| Audit | Section | Reason |
|---|---|---|
| SEC-01 | Cross-company RLS enforcement | Requires authenticated Supabase queries |
| SEC-02 | Cross-company data isolation | Requires two live user sessions |
| SEC-03 | Session cookies, JWT expiry | Requires browser DevTools |
| DB-04 | Trigger behaviour | Requires live DB mutations |
| DB-05 | RPC functions | Requires live Supabase connection |
| DB-08 | Realtime events | Requires live Supabase Realtime |
| PR-04 | SSL / HTTPS | Requires live deployment |
| PR-05 | Monitoring / observability | Requires production dashboard |
| PR-06 | Android APK | Requires physical device |
| Audit 01-05 | All workflow audits | Require live platform + test accounts |
| Audit 08 | Android functional | Requires physical device + APK |
| Audit 09 | Performance | Requires Lighthouse + live endpoints |
| Audit 17 | GPS tracking | Requires physical device |
