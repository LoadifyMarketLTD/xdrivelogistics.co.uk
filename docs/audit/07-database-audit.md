# Audit 07 — Database Audit

> Production Certification Phase · Development Freeze Active
> Run all SQL checks in Supabase SQL Editor against the production database.

## Metadata

| Field | Value |
|---|---|
| Auditor | |
| Date | |
| Supabase project | |
| Last migration applied | 129_serialize_overpayment_guard |

## Legend

`✅ PASS` · `❌ FAIL` · `⚠️ PARTIAL` · `🔲 N/T` — Severity: `CRITICAL` `MAJOR` `MINOR` `COSMETIC`

---

## DB-01 · Migration Integrity

| ID | Check | SQL | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DB-01-01 | All migrations applied | `SELECT version FROM supabase_migrations ORDER BY version` | Continuous sequence; last = 129 | | 🔲 N/T | CRITICAL | |
| DB-01-02 | No duplicate migration versions | `SELECT version, count(*) FROM supabase_migrations GROUP BY version HAVING count(*) > 1` | 0 rows | | 🔲 N/T | CRITICAL | |
| DB-01-03 | No migration gaps | Compare file names in repo vs DB | No version missing | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DB-02 · Schema Integrity (Tables & Columns)

| ID | Check | SQL | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DB-02-01 | `jobs` table — required columns exist | `\d jobs` or `information_schema.columns` | id, company_id, status, pickup_address, delivery_address, created_at, updated_at | | 🔲 N/T | CRITICAL | |
| DB-02-02 | `job_bids` table — required columns | `\d job_bids` | id, job_id, driver_id, company_id, amount, status, created_at | | 🔲 N/T | CRITICAL | |
| DB-02-03 | `companies` table — required columns | `\d companies` | id, name, type, status, created_at | | 🔲 N/T | CRITICAL | |
| DB-02-04 | `profiles` table — required columns | `\d profiles` | user_id, role, status, must_change_password, company_id | | 🔲 N/T | CRITICAL | |
| DB-02-05 | `driver_locations` tracking columns | `\d driver_locations` | driver_id, latitude, longitude, updated_at (migration 119) | | 🔲 N/T | MAJOR | |
| DB-02-06 | `driver_device_tokens` table exists | `SELECT 1 FROM driver_device_tokens LIMIT 1` | Table exists (migration 106) | | 🔲 N/T | MAJOR | |
| DB-02-07 | Finance tables exist | `SELECT 1 FROM invoices LIMIT 1` | Table exists (migrations 125–129) | | 🔲 N/T | CRITICAL | |
| DB-02-08 | `company_documents` table exists | `SELECT 1 FROM company_documents LIMIT 1` | Table exists (migration 123) | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DB-03 · Foreign Keys & Referential Integrity

| ID | Check | SQL | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DB-03-01 | `jobs.company_id → companies.id` FK exists | `SELECT conname FROM pg_constraint WHERE conrelid='jobs'::regclass AND contype='f'` | FK `jobs_company_id_fkey` present | | 🔲 N/T | CRITICAL | |
| DB-03-02 | `job_bids.job_id → jobs.id` FK exists | Same method | FK present | | 🔲 N/T | CRITICAL | |
| DB-03-03 | `job_bids.company_id → companies.id` FK exists | Same method | FK `job_bids_company_id_fkey` present | | 🔲 N/T | CRITICAL | |
| DB-03-04 | `profiles.user_id → auth.users.id` FK exists | Same method | FK present | | 🔲 N/T | CRITICAL | |
| DB-03-05 | Cascade DELETE on `job_bids` when job deleted | `DELETE FROM jobs WHERE id = <test_id>` | `job_bids` rows deleted automatically | | 🔲 N/T | MAJOR | |
| DB-03-06 | No orphaned `job_bids` rows | `SELECT count(*) FROM job_bids WHERE job_id NOT IN (SELECT id FROM jobs)` | 0 | | 🔲 N/T | MAJOR | |
| DB-03-07 | No orphaned `driver_locations` rows | `SELECT count(*) FROM driver_locations WHERE driver_id NOT IN (SELECT id FROM drivers)` | 0 | | 🔲 N/T | MINOR | |
| DB-03-08 | `notification_events.recipient_id` FK (migration 114) | `SELECT conname FROM pg_constraint WHERE conrelid='notification_events'::regclass` | FK present | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DB-04 · Triggers

| ID | Check | SQL | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DB-04-01 | `updated_at` trigger on `jobs` | `UPDATE jobs SET status='open' WHERE id=<id>` → `SELECT updated_at` | Timestamp updated automatically | | 🔲 N/T | MAJOR | |
| DB-04-02 | `updated_at` trigger on `job_bids` | Same approach | Timestamp updated | | 🔲 N/T | MAJOR | |
| DB-04-03 | Notification trigger on bid insert | `INSERT INTO job_bids (...)` | Row created in `notification_events` or `notifications` | | 🔲 N/T | MAJOR | |
| DB-04-04 | Invoice notification trigger (migration 116) | Complete a job | `notify_invoice_created` trigger fires | | 🔲 N/T | MAJOR | |
| DB-04-05 | Onboarding state machine trigger (migration 102) | Submit onboarding | Status transitions atomic; no partial state | | 🔲 N/T | MAJOR | |
| DB-04-06 | Serialize overpayment guard (migration 129) | Double-submit invoice payment | Second payment rejected by trigger/RPC | | 🔲 N/T | CRITICAL | |
| DB-04-07 | Trigger list — verify all expected triggers exist | `SELECT trigger_name, event_manipulation, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public'` | Expected triggers present; no unexpected triggers | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DB-05 · RPC Functions

| ID | Function | SQL | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DB-05-01 | `update_driver_status` | `SELECT update_driver_status(<driver_id>, 'in_progress')` | Returns success; `driver_locations` updated | | 🔲 N/T | MAJOR | |
| DB-05-02 | `auth_company_id()` | `SELECT public.auth_company_id()` as authenticated user | Returns correct company UUID | | 🔲 N/T | MAJOR | |
| DB-05-03 | `is_company_member()` | `SELECT public.is_company_member(<company_id>)` | Returns true for member, false for non-member | | 🔲 N/T | MAJOR | |
| DB-05-04 | All RPCs use `security definer` where appropriate | `SELECT proname, prosecdef FROM pg_proc WHERE pronamespace = 'public'::regnamespace` | Sensitive RPCs are `security definer` | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DB-06 · Views

| ID | View | SQL | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DB-06-01 | `job_bids_with_job_owner` (migration 122) | `SELECT * FROM job_bids_with_job_owner LIMIT 5` | Rows returned; company_owner_id column present | | 🔲 N/T | MAJOR | |
| DB-06-02 | View returns correct data | Join logic matches expectation | bid + job + owner company data correct | | 🔲 N/T | MAJOR | |
| DB-06-03 | All views accessible to authenticated role | Auth as driver; `SELECT * FROM <view>` | No permission denied | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DB-07 · Indexes & Performance

| ID | Check | SQL | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DB-07-01 | Index on `jobs.status` | `SELECT indexname FROM pg_indexes WHERE tablename='jobs'` | Index on `status` exists (migration 118) | | 🔲 N/T | MAJOR | |
| DB-07-02 | Index on `jobs.company_id` | Same | Index on `company_id` exists | | 🔲 N/T | MAJOR | |
| DB-07-03 | Index on `job_bids.job_id` | `SELECT indexname FROM pg_indexes WHERE tablename='job_bids'` | Index on `job_id` exists | | 🔲 N/T | MAJOR | |
| DB-07-04 | Index on `driver_locations.driver_id` | `SELECT indexname FROM pg_indexes WHERE tablename='driver_locations'` | Index exists | | 🔲 N/T | MINOR | |
| DB-07-05 | Query plan for main job feed | `EXPLAIN ANALYZE SELECT * FROM jobs WHERE status='open' ORDER BY created_at DESC LIMIT 50` | Uses index scan (not Seq Scan) | | 🔲 N/T | MAJOR | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## DB-08 · Realtime

| ID | Check | Method | Expected | Result | Status | Severity | Defect ID |
|---|---|---|---|---|---|---|---|
| DB-08-01 | `jobs` table has realtime replication | Supabase Dashboard → Database → Replication | `jobs` in publication | | 🔲 N/T | MAJOR | |
| DB-08-02 | `job_bids` table realtime | Same | `job_bids` in publication | | 🔲 N/T | MAJOR | |
| DB-08-03 | `driver_locations` table realtime | Same | `driver_locations` in publication | | 🔲 N/T | CRITICAL | |
| DB-08-04 | `notifications` or `notification_events` realtime | Same | Table in publication | | 🔲 N/T | MAJOR | |
| DB-08-05 | Realtime event received in browser | Subscribe in DevTools; update row | `POSTGRES_CHANGES` event in <2s | | 🔲 N/T | CRITICAL | |

**Section result:** ☐ PASS ☐ FAIL — Notes: _______________

---

## Summary

| Section | Tests | PASS | FAIL | PARTIAL | N/T |
|---|---|---|---|---|---|
| DB-01 Migration Integrity | 3 | | | | |
| DB-02 Schema Integrity | 8 | | | | |
| DB-03 Foreign Keys & Referential | 8 | | | | |
| DB-04 Triggers | 7 | | | | |
| DB-05 RPC Functions | 4 | | | | |
| DB-06 Views | 3 | | | | |
| DB-07 Indexes & Performance | 5 | | | | |
| DB-08 Realtime | 5 | | | | |
| **TOTAL** | **43** | | | | |

**Overall Result:** ☐ PASS ☐ FAIL

**Defects raised:**

| Defect ID | Description | Severity |
|---|---|---|
| | | |
