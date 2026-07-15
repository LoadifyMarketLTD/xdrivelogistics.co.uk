# Audit 06 — Security Audit

> Production Certification Phase · Development Freeze Active
> All checks must be run against the real production database and real API endpoints.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Environment | https://www.xdrivelogistics.co.uk |
| Supabase project | |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## SEC-01 · Row Level Security (RLS)

### Verification SQL for each table (run in Supabase SQL editor as service role, then as authenticated user)

| ID | Table | Check | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| SEC-01-01 | `jobs` | RLS enabled | `SELECT rowsecurity FROM pg_class WHERE relname = 'jobs'` → `true` | | 🔲 N/T | CRITICAL | |
| SEC-01-02 | `job_bids` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-03 | `companies` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-04 | `profiles` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-05 | `drivers` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-06 | `vehicles` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-07 | `invoices` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-08 | `company_documents` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-09 | `notifications` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-10 | `driver_locations` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-11 | `company_memberships` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-12 | `job_disputes` | RLS enabled | `rowsecurity = true` | | 🔲 N/T | CRITICAL | |
| SEC-01-13 | All critical tables | Complete list | Run: `SELECT relname FROM pg_class WHERE rowsecurity = false AND relkind = 'r' AND relnamespace = 'public'::regnamespace` → 0 rows for any business table | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## SEC-02 · Cross-Company Data Isolation

| ID | Scenario | Test Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| SEC-02-01 | Customer A cannot read Customer B's jobs | Auth as Customer B; `SELECT * FROM jobs WHERE company_id = <A's company>` | 0 rows | | 🔲 N/T | CRITICAL | |
| SEC-02-02 | Customer A cannot read Customer B's bids | Auth as Customer B; `SELECT * FROM job_bids WHERE job_id IN (<A's job IDs>)` | 0 rows | | 🔲 N/T | CRITICAL | |
| SEC-02-03 | Driver A cannot read Driver B's bids | Auth as Driver B; query `job_bids` for Driver A's rows | 0 rows | | 🔲 N/T | CRITICAL | |
| SEC-02-04 | Driver A cannot read Driver B's invoices | Auth as Driver B; query `invoices` for Driver A | 0 rows | | 🔲 N/T | CRITICAL | |
| SEC-02-05 | Company A cannot read Company B's documents | Auth as member of Company B; query `company_documents` for Company A | 0 rows | | 🔲 N/T | CRITICAL | |
| SEC-02-06 | Driver A cannot update Driver B's profile | Auth as Driver B; `UPDATE drivers SET ... WHERE id = <Driver A's id>` | Error or 0 rows updated | | 🔲 N/T | CRITICAL | |
| SEC-02-07 | Unauthenticated user cannot read any jobs | No auth; `SELECT * FROM jobs` via API | 401 or 0 rows | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## SEC-03 · Authentication & Session Security

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| SEC-03-01 | Protected route without token | GET `/customer` with no session cookie | Redirect to `/login` | | 🔲 N/T | CRITICAL | |
| SEC-03-02 | Protected API without ****** | GET `/api/driver/mobile/resources` with no Authorization | 401 JSON response | | 🔲 N/T | CRITICAL | |
| SEC-03-03 | Expired JWT token | Send request with manually expired JWT | 401; session invalidated | | 🔲 N/T | CRITICAL | |
| SEC-03-04 | Forged JWT (wrong signature) | Alter payload; send | 401; Supabase rejects | | 🔲 N/T | CRITICAL | |
| SEC-03-05 | Logout invalidates session | Logout → GET `/customer` | Redirect to `/login` | | 🔲 N/T | CRITICAL | |
| SEC-03-06 | Session cookie secure & httpOnly flags | Browser DevTools → Application → Cookies | `Secure`, `HttpOnly`, `SameSite=Lax` set | | 🔲 N/T | MAJOR | |
| SEC-03-07 | Password reset flow | POST `/reset-password` | Token sent; old session not valid for password operations | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## SEC-04 · Authorization & Role Enforcement

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| SEC-04-01 | Customer accessing `/admin` | Customer session → navigate | Redirect to `/forbidden` or `/login` | | 🔲 N/T | CRITICAL | |
| SEC-04-02 | Driver accessing `/customer` | Driver session → navigate | Redirect to `/forbidden` | | 🔲 N/T | CRITICAL | |
| SEC-04-03 | Broker accessing `/admin` | Broker session | Redirect to `/forbidden` | | 🔲 N/T | CRITICAL | |
| SEC-04-04 | Admin accessing `/super-admin` | Admin (non-super) session | Redirect to `/forbidden` | | 🔲 N/T | CRITICAL | |
| SEC-04-05 | Customer calling admin API | POST `/api/super-admin/companies` as customer | 401 or 403 | | 🔲 N/T | CRITICAL | |
| SEC-04-06 | Driver awarding a bid (customer action) | POST `/api/customer/bids/[id]/award` as driver JWT | 403 | | 🔲 N/T | CRITICAL | |
| SEC-04-07 | Middleware role enforcement | Inspect `middleware.ts` path checks | `/super-admin`, `/broker`, `/admin`, `/driver`, `/customer`, `/m` all protected | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## SEC-05 · File Upload & Storage Security

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| SEC-05-01 | Upload rejected mime type (e.g. `.exe`) | POST to storage with `.exe` file | Rejected; bucket `allowed_mime_types` enforced | | 🔲 N/T | CRITICAL | |
| SEC-05-02 | Upload oversized file (>10MB) | POST file >10485760 bytes | Rejected; `file_size_limit` enforced | | 🔲 N/T | MAJOR | |
| SEC-05-03 | Direct URL access to private bucket object | GET `storage/v1/object/driver-docs/...` unauthenticated | 403 Access Denied | | 🔲 N/T | CRITICAL | |
| SEC-05-04 | Company A cannot access Company B's documents via storage path | Auth as Company B member; try Company A path | 403 | | 🔲 N/T | CRITICAL | |
| SEC-05-05 | Signed URL expires correctly | Generate signed URL; wait past expiry | 403 after expiry | | 🔲 N/T | MAJOR | |
| SEC-05-06 | `driver-docs` bucket not public | Supabase Storage dashboard | `public = false` | | 🔲 N/T | CRITICAL | |
| SEC-05-07 | `vehicle-docs` bucket not public | Supabase Storage dashboard | `public = false` | | 🔲 N/T | CRITICAL | |
| SEC-05-08 | `pod-photos` bucket not public | Supabase Storage dashboard | `public = false` | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## SEC-06 · API Security & Secrets

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| SEC-06-01 | `SUPABASE_SERVICE_ROLE_KEY` not exposed in client JS | Browser → DevTools → Sources → search bundle | Not found in any client-side JS | | 🔲 N/T | CRITICAL | |
| SEC-06-02 | `SUPABASE_SERVICE_ROLE_KEY` set in production env | Server response headers / health check | API endpoints return data (not 503) | | 🔲 N/T | CRITICAL | |
| SEC-06-03 | `NEXT_PUBLIC_*` env vars are non-secret | Review `.env.example` and codebase | Only anon key and URL in public vars | | 🔲 N/T | MAJOR | |
| SEC-06-04 | No secrets committed to git | `git log -p --all \| grep -i 'service_role\|secret\|password'` | No secrets in history | | 🔲 N/T | CRITICAL | |
| SEC-06-05 | Mobile API endpoint `/api/driver/mobile/config` returns only anon key | GET `/api/driver/mobile/config` | Only `supabaseUrl` and `supabaseAnonKey` in response | | 🔲 N/T | CRITICAL | |
| SEC-06-06 | API responses do not leak internal stack traces | Trigger 500 error | Generic error message; no stack trace | | 🔲 N/T | MAJOR | |
| SEC-06-07 | CORS — origin restriction | Request from unauthorized origin | CORS policy rejects | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| SEC-01 RLS Tables | 13 | | | | |
| SEC-02 Cross-Company Isolation | 7 | | | | |
| SEC-03 Auth & Sessions | 7 | | | | |
| SEC-04 Authorization & Roles | 7 | | | | |
| SEC-05 File Upload & Storage | 8 | | | | |
| SEC-06 API Security & Secrets | 7 | | | | |
| **TOTAL** | **49** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
