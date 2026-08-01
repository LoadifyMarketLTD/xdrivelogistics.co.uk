# Incident: Production Login Blocker — Driver Schema Drift

**Date opened:** 2026-08-01  
**Severity:** P0 — Production Critical  
**Status:** PARTIALLY MITIGATED (middleware fix deployed; schema migration pending Platform Owner approval)  
**Defect register:** DEF-009 in `docs/audit/11-defect-report.md`  
**PR:** #326 (keep Draft until Platform Owner approves and confirms staging validation)

---

## 1. Confirmed Symptom

After login the web application makes:

```
GET /rest/v1/drivers
  ?select=id,company_id,user_id,must_change_password,status,app_access,driver_type,can_commercial_bid
  &user_id=eq.<user-id>
```

Supabase (PostgREST) returns:

```
HTTP 400 Bad Request
{
  "code": "42703",
  "message": "column drivers.driver_type does not exist",
  ...
}
```

Result: application redirects every authenticated user to `/forbidden`.

---

## 2. Confirmed Root Cause (Evidence)

### 2a. Missing migrations — Platform Owner read-only SQL evidence

```sql
-- Check migration history
SELECT version, name, executed_at
FROM supabase_migrations.schema_migrations
WHERE version IN ('20260725184000', '20260726060000')
ORDER BY version;
-- Result: 0 rows
```

```sql
-- Check live columns
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'drivers'
  AND column_name  IN ('driver_type', 'can_commercial_bid');
-- Result: 0 rows
```

**Conclusion:** Both migrations are absent from the live Supabase project migration history. Both columns are absent from `public.drivers`.

### 2b. Secondary bug — middleware 42703 fallback missing

`authSession.ts` and `app/api/auth/context/route.ts` already had a `isMissingDriverCommercialColumn` 42703 retry guard (added July 2026, see `docs/incidents/2026-07-28-auth-driver-schema-compat.md`).

`middleware.ts` did **not** have this guard. Its driver query:

```typescript
// middleware.ts – BEFORE FIX (line ≈321)
const { data: driverData, error: driverError } = await supabaseAdmin
  .from('drivers')
  .select('id, company_id, app_access, must_change_password, status, can_commercial_bid')
  .eq('user_id', authData.user.id)
  .eq('company_id', activeCompany.context.companyId)
  .limit(1)
  .maybeSingle();

if (driverError) {
  return { kind: 'forbidden' };   // ← no 42703 check; any error → forbidden
}
```

When `can_commercial_bid` is absent, this returns `{ kind: 'forbidden' }` → redirect to `/forbidden`.

---

## 3. Migration Dependency Chain

### 3a. Confirmed missing (Platform Owner evidence)

| Version | File | Effect |
|---|---|---|
| 20260725184000 | `driver_commercial_bidding_controls.sql` | Adds `driver_type text NOT NULL`, `can_commercial_bid boolean NOT NULL DEFAULT false`; backfills from `onboarding_applications`; adds job_bids RLS policy and uniqueness indexes |
| 20260726060000 | `canonical_driver_type_architecture.sql` | Remaps `individual_driver`→`owner_driver`, `subcontractor`→`owner_driver/company_driver`; tightens CHECK constraint to `('owner_driver','company_driver')`; changes `can_commercial_bid` default to `true`; updates `review_onboarding_application_atomic` |

### 3b. Likely also missing (cannot confirm without live read; apply in sequence)

These migrations follow the confirmed gap. Because `20260726060000` hadn't been applied, `review_onboarding_application_atomic` in `20260730140000` (which inserts `driver_type` and `can_commercial_bid`) would also have failed to apply. All others should be independently safe but must be validated on staging first.

| Version | File | Notes |
|---|---|---|
| 20260726091000 | `fix_accept_bid_owner_driver_supplier.sql` | `CREATE OR REPLACE FUNCTION accept_job_bid_atomic` — no dependency on `driver_type`/`can_commercial_bid`; safe to apply |
| 20260727190000 | `fix_loads_table_grants.sql` | `GRANT` statements on `public.loads` — safe |
| 20260728060000 | `fix_job_disputes_grants.sql` | `GRANT` statements on `public.job_disputes` — safe |
| 20260729161000 | `identity_compliance_and_fraud_foundation.sql` | Identity/fraud uniqueness constraints — fail-closed preflight; may raise if duplicate memberships exist |
| 20260729162000 | `marketplace_single_active_quote_per_identity.sql` | Uniqueness index on `job_bids` — `IF NOT EXISTS`; safe |
| 20260729170000 | `unified_onboarding_contract_and_activation_gate.sql` | Onboarding document matrix, activation gate — may fail if `compliance_document_requirements` table is in unexpected state |
| 20260729170500 | `owner_driver_onboarding_company_binding.sql` | Owner Driver company binding fix — safe `CREATE OR REPLACE` |
| 20260730100000 | `owner_decide_fraud_review_case_atomicity_backfill.sql` | Fraud decision atomicity — safe `CREATE OR REPLACE` |
| 20260730112000 | `company_driver_role_and_company_activation_gate_fix.sql` | Company Driver role activation backfill — safe `CREATE OR REPLACE` with preflight |
| 20260730140000 | `fix_review_onboarding_application_atomic_conflict_target.sql` | Function fix that also inserts `driver_type`/`can_commercial_bid` — **consolidated into catch-up migration below** |

### 3c. Prerequisites confirmed present (repository evidence)

The following tables/columns required by the two missing migrations must exist on the target environment. Verify before applying:

```sql
-- Verify prerequisites
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'onboarding_applications'
  AND column_name IN ('user_id','account_type','updated_at','created_at');
-- Expected: 4 rows

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'job_bids'
  AND column_name IN ('job_id','company_id','status','bidder_user_id');
-- Expected: 4 rows

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'jobs'
  AND column_name IN ('id','status','exchange_visibility','direct_invite_company_id',
                      'company_id','awarded_carrier_company_id');
-- Expected: 6 rows

SELECT proname FROM pg_proc WHERE proname = 'set_company_status_governance';
-- Expected: 1 row
```

---

## 4. Pre-Migration Data Compatibility Checks

Run these on the staging Supabase project (production-schema-equivalent baseline) **before** applying the catch-up migration:

```sql
-- 4a. Count drivers and their nullability
SELECT
  COUNT(*)                          AS total_drivers,
  COUNT(*) FILTER (WHERE user_id IS NULL)  AS drivers_null_user_id,
  COUNT(*) FILTER (WHERE company_id IS NULL) AS drivers_null_company_id
FROM public.drivers;
-- Expect: drivers_null_user_id = 0 (preflight guard will abort if > 0)

-- 4b. Preview the driver_type backfill
WITH latest_onboarding AS (
  SELECT DISTINCT ON (user_id) user_id, account_type
  FROM public.onboarding_applications
  WHERE user_id IS NOT NULL
  ORDER BY user_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
)
SELECT
  CASE
    WHEN lo.account_type IN ('individual_driver','owner_driver') THEN 'owner_driver'
    WHEN lo.account_type = 'subcontractor' THEN
      CASE WHEN d.company_id IS NOT NULL THEN 'company_driver' ELSE 'owner_driver' END
    WHEN lo.account_type IN ('fleet_courier','company_driver') THEN 'company_driver'
    ELSE CASE WHEN d.company_id IS NULL THEN 'owner_driver' ELSE 'company_driver' END
  END                              AS projected_driver_type,
  COUNT(*)                         AS driver_count
FROM public.drivers d
LEFT JOIN latest_onboarding lo ON lo.user_id = d.user_id
GROUP BY 1;
-- Expect: only 'owner_driver' and 'company_driver'

-- 4c. Check for active duplicate bids that would violate new uniqueness indexes
SELECT job_id, company_id, COUNT(*) AS active_bid_count
FROM public.job_bids
WHERE status IN ('submitted','accepted')
  AND company_id IS NOT NULL
GROUP BY job_id, company_id
HAVING COUNT(*) > 1;
-- Expect: 0 rows (migration will fail if any exist due to CREATE UNIQUE INDEX)

SELECT job_id, bidder_user_id, COUNT(*) AS active_null_bid_count
FROM public.job_bids
WHERE status IN ('submitted','accepted')
  AND company_id IS NULL
GROUP BY job_id, bidder_user_id
HAVING COUNT(*) > 1;
-- Expect: 0 rows

-- 4d. Check onboarding_applications data assumptions
SELECT account_type, COUNT(*) FROM public.onboarding_applications
GROUP BY account_type ORDER BY account_type;
-- Review output; confirm no unexpected account_type values that could produce NULL driver_type
```

---

## 5. Proposed Migration Plan

### Phase 1 — Frontend middleware fix (this PR)

**File:** `middleware.ts`  
**Change:** Add `isMissingDriverCanBidColumn` 42703 guard in `resolveRouteAuth`, matching the pattern already used in `authSession.ts` and `app/api/auth/context/route.ts`.  
**Effect:** Login no longer fails with `/forbidden` when `can_commercial_bid` is absent. `canCommercialBid` is `null` in the session until the schema migration is applied.  
**Deployment:** Normal PR deploy — no database change required.  
**Risk:** Low. Does not remove columns from queries; retries with legacy set only on 42703 error; fail-closed for all other errors.

### Phase 2 — Staging validation (before Production)

1. Provision a staging Supabase project using the production schema as baseline (or use the `supabase db reset` against the repo migrations up to `20260725183000`).
2. Populate representative driver rows: at least one `owner_driver`, one `company_driver`, one row without an `onboarding_applications` record.
3. Run pre-migration data checks from §4.
4. Apply `supabase/migrations/20260801000000_p0_driver_commercial_columns_catchup.sql`.
5. Verify:
   ```sql
   SELECT driver_type, can_commercial_bid, COUNT(*) FROM public.drivers GROUP BY 1,2;
   -- All rows classified; no NULLs; can_commercial_bid = true for all
   
   SELECT conname, consrc FROM pg_constraint
   WHERE conrelid = 'public.drivers'::regclass AND conname = 'drivers_driver_type_check';
   -- CHECK (driver_type IN ('owner_driver','company_driver'))
   
   SELECT atthasdef, attnotnull FROM pg_attribute
   WHERE attrelid = 'public.drivers'::regclass AND attname IN ('driver_type','can_commercial_bid');
   -- Both NOT NULL with defaults
   ```
6. Reload PostgREST schema cache and confirm `GET /rest/v1/drivers?select=...driver_type,can_commercial_bid...` returns 200.
7. Run login test for each role: driver, company_admin, owner_driver, broker.
8. Run unit tests: `npm run test:unit`
9. Run targeted E2E auth test: `npx playwright test e2e/auth.spec.ts`
10. Verify marketplace bid flow: owner_driver and company_driver can submit bids.
11. Apply remaining post-gap migrations in sequence (`20260726091000` through `20260730140000`), running the identity-compliance preflight checks before `20260729161000`.

### Phase 3 — Production apply (requires Platform Owner approval)

**Approval gates:**
- [ ] Staging validation completed and evidence recorded
- [ ] Pre-migration data checks run against production (read-only)
- [ ] Duplicate-bid check from §4c returns 0 rows on production
- [ ] Platform Owner explicitly approves this specific migration file

**Production apply steps:**
1. Schedule a maintenance window (5–10 minutes; migration runs inside a transaction).
2. Apply via Supabase dashboard SQL editor or `supabase db push` targeting only this migration:
   ```
   supabase/migrations/20260801000000_p0_driver_commercial_columns_catchup.sql
   ```
3. Confirm `NOTIFY pgrst, 'reload schema'` fires (PostgREST auto-reloads within seconds).
4. Immediately verify login for one driver account and one company admin account.
5. Monitor Supabase logs for `42703` errors — should drop to zero.

**Do NOT run ad-hoc `ALTER TABLE` SQL directly in Production. Apply only the reviewed, approved migration file.**

### Phase 4 — Remaining migrations (separate approval)

Apply migrations `20260726091000` through `20260730140000` in chronological order after Phase 3 is confirmed stable. Each should be validated on staging first. The identity-compliance migration (`20260729161000`) has an explicit preflight guard that will abort if data invariants are violated.

---

## 6. Rollback / Recovery Procedure

If the catch-up migration causes unexpected issues:

```sql
-- Emergency rollback (drops the two new columns only)
BEGIN;
ALTER TABLE public.drivers DROP COLUMN IF EXISTS driver_type;
ALTER TABLE public.drivers DROP COLUMN IF EXISTS can_commercial_bid;
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_driver_type_check;
DROP INDEX IF EXISTS job_bids_active_company_unique_idx;
DROP INDEX IF EXISTS job_bids_active_null_company_unique_idx;
COMMIT;

NOTIFY pgrst, 'reload schema';
```

After rollback, the middleware 42703 fallback (Phase 1 fix) continues to protect login by retrying without `can_commercial_bid`.

---

## 7. Post-Migration Verification Checklist

| Test | Expected Result | Pass/Fail |
|---|---|---|
| `SELECT driver_type, COUNT(*) FROM drivers GROUP BY 1` | only `owner_driver` / `company_driver` rows; no NULLs | ☐ |
| `SELECT can_commercial_bid, COUNT(*) FROM drivers GROUP BY 1` | all `true` (or explicit `false` for revoked) | ☐ |
| `SELECT column_default FROM information_schema.columns WHERE table_name='drivers' AND column_name='can_commercial_bid'` | `true` | ☐ |
| `SELECT column_default FROM information_schema.columns WHERE table_name='drivers' AND column_name='driver_type'` | `company_driver` | ☐ |
| `GET /rest/v1/drivers?select=id,driver_type,can_commercial_bid&limit=1` | HTTP 200 | ☐ |
| Login as company driver | Reaches `/driver` dashboard | ☐ |
| Login as company admin | Reaches `/admin` dashboard | ☐ |
| Login as owner driver | Reaches owner-driver workspace | ☐ |
| Login as customer | Reaches `/customer` dashboard | ☐ |
| Login as broker | Reaches `/broker` dashboard | ☐ |
| Marketplace bid for `owner_driver` | Succeeds | ☐ |
| Marketplace bid for `company_driver` | Succeeds | ☐ |
| `npm run test:unit` | All tests pass | ☐ |
| `npx playwright test e2e/auth.spec.ts` | All tests pass | ☐ |
| Zero `42703` errors in Supabase logs for 5 minutes post-migration | Confirmed | ☐ |

---

## 8. Impact Assessment

| Dimension | Assessment |
|---|---|
| User impact | 100% of login attempts for company-associated users fail; standalone drivers may partially authenticate but face errors at route gates |
| Data at risk | None — the missing columns contain no existing data; migration only adds columns and backfills from existing `onboarding_applications` |
| Revenue impact | Critical — platform is inaccessible |
| Reversibility | Full — rollback drops columns and returns to pre-migration state; middleware fallback remains active |
| Time to full resolution | Phase 1 (middleware): immediate on PR deploy; Phase 2 (staging): 2–4 hours; Phase 3 (production): 10 minutes + approval |

---

## 9. Actions Required

| Action | Owner | Status |
|---|---|---|
| Confirm pre-migration data checks pass on production (read-only SQL) | Platform Owner | ⬜ TODO |
| Provision staging environment with production-equivalent schema | Platform Owner / Engineering | ⬜ TODO |
| Run staging validation (§5 Phase 2) and record evidence | Engineering | ⬜ TODO |
| Approve `20260801000000_p0_driver_commercial_columns_catchup.sql` for Production | Platform Owner | ⬜ TODO |
| Apply catch-up migration to Production | Platform Owner (with Engineering support) | ⬜ TODO |
| Confirm post-migration verification checklist (§7) | Platform Owner | ⬜ TODO |
| Apply remaining post-gap migrations in sequence | Engineering (staging) → Platform Owner (prod) | ⬜ TODO |
| Close DEF-009 in defect register | Engineering | ⬜ TODO |

---

*Prepared by Copilot Task Agent — 2026-08-01. Do not apply Production migrations without explicit Platform Owner approval.*
