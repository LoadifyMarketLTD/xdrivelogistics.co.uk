# Marketplace Governance — Production Patch Runbook

**Migration:** `supabase/migrations/20260801091000_fix_owner_audit_log_target_type.sql`  
**Function patched:** `public.apply_marketplace_governance_action(uuid, uuid, text, text)`  
**Status:** PATCH VALIDATED IN REPO — NOT YET APPLIED TO PRODUCTION  
**Approval required before Production application**

---

## Safety constraints

- Do **not** execute this SQL on Production without explicit Platform Owner approval.
- Do **not** apply via `supabase db push` or migration repair.
- Do **not** modify Production data, RLS policies, driver schema, or unrelated functions.
- Keep PR #326 Draft until all release-gate conditions are met.

---

## 1. Exact function signature

```
public.apply_marketplace_governance_action(
  p_actor_user_id uuid,
  p_job_id        uuid,
  p_action        text,
  p_reason        text DEFAULT NULL
)
RETURNS TABLE (
  id                 uuid,
  status             text,
  company_id         uuid,
  exchange_visibility text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
```

---

## 2. Exact live-vs-patch difference

### Original function body (migration 078 — the bug)

`owner_audit_log` INSERT in `078_marketplace_governance_atomic_action.sql`:

```sql
INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    created_at
)
VALUES (
    p_actor_user_id,
    v_company_id,
    v_audit_action_type,
    v_old_value,
    v_new_value,
    v_reason,
    now()
);
```

**Bug:** `target_type` (NOT NULL), `target_id`, and `target_name` are absent. Any call emits
`null value in column "target_type" of relation "owner_audit_log" violates not-null constraint`.

### Patched function body (migration 20260801091000 — the fix)

`owner_audit_log` INSERT in `20260801091000_fix_owner_audit_log_target_type.sql`:

```sql
INSERT INTO public.owner_audit_log (
    actor_user_id,
    target_type,
    target_id,
    target_name,
    target_company_id,
    action_type,
    old_status,
    new_status,
    reason,
    created_at
)
VALUES (
    p_actor_user_id,
    'job',
    p_job_id,
    format('Marketplace job %s', p_job_id),
    v_company_id,
    v_audit_action_type,
    v_old_value,
    v_new_value,
    v_reason,
    now()
);
```

**Only three columns are added:** `target_type = 'job'`, `target_id = p_job_id`,
`target_name = format('Marketplace job %s', p_job_id)`.  
All business logic, guards, status transitions, and return query are identical to 078.

---

## 3. Preserved contracts — explicit confirmation

| Contract element | Original (078) | Patch (20260801091000) | Preserved |
|---|---|---|---|
| Function name & schema | `public.apply_marketplace_governance_action` | identical | ✅ |
| Parameter names & types | `(uuid, uuid, text, text DEFAULT NULL)` | identical | ✅ |
| RETURNS TABLE columns | `(id uuid, status text, company_id uuid, exchange_visibility text)` | identical | ✅ |
| LANGUAGE | `plpgsql` | identical | ✅ |
| SECURITY DEFINER | present | present | ✅ |
| SET search_path | `public` | `public` | ✅ |
| Input validation guards | actor/job NOT NULL, action whitelist, status/visibility checks | identical | ✅ |
| Status transition logic | publish / hide / force_dispute / force_cancel branches | identical | ✅ |
| Job UPDATE statements | `exchange_visibility`, `status` updates per action | identical | ✅ |
| RETURN QUERY | `SELECT id, status::text, company_id, exchange_visibility::text FROM jobs WHERE id = p_job_id` | identical | ✅ |
| REVOKE PUBLIC | present | present | ✅ |
| GRANT service_role | present | present | ✅ |
| PostgREST reload | `NOTIFY pgrst` | present | ✅ |

---

## 4. Exact objects changed

| Object type | Object name | Change |
|---|---|---|
| Function (replace) | `public.apply_marketplace_governance_action(uuid,uuid,text,text)` | Audit INSERT adds `target_type`, `target_id`, `target_name` |
| Column alter (no-op if already correct) | `public.owner_audit_log.target_type` | `DROP DEFAULT`, confirm `NOT NULL` |

**No table DDL, no RLS policy, no driver schema, no other function is touched.**

---

## 5. Transaction boundaries

The entire migration executes inside a single `BEGIN … COMMIT` block.

- If the column-validation `DO $$` block raises (missing `target_id` or `target_name`), the transaction aborts before `CREATE OR REPLACE FUNCTION`.
- If `CREATE OR REPLACE FUNCTION` fails for any reason, the transaction rolls back and the live function body is unchanged.
- Grants are applied inside the same transaction.

---

## 6. Pre-apply Production checks

Run each statement individually in a read-only session before applying the migration:

```sql
-- A. Confirm target columns exist with correct types
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'owner_audit_log'
  AND column_name IN ('target_type', 'target_id', 'target_name', 'target_company_id')
ORDER BY column_name;
-- Expected: 4 rows — target_type text NOT NO, target_id uuid YES, target_name text YES, target_company_id uuid YES

-- B. Confirm live function signature matches the patch assumption
SELECT pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'apply_marketplace_governance_action';
-- Expected: uuid, uuid, text, text

-- C. Capture the live function body for rollback reference
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'apply_marketplace_governance_action'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text';
-- Save the full output as the rollback baseline before proceeding.

-- D. Confirm no DEFAULT currently on target_type (migration idempotently drops it)
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'owner_audit_log'
  AND column_name = 'target_type';
```

---

## 7. Post-apply verification

Run immediately after applying the migration in Production:

```sql
-- A. Confirm function body now includes target_type = 'job'
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'apply_marketplace_governance_action'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text';
-- Verify the returned body contains target_type and 'job'.

-- B. Confirm SECURITY DEFINER is still set
SELECT prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'apply_marketplace_governance_action'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid, text, text';
-- Expected: t (true)

-- C. Confirm grants
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name = 'apply_marketplace_governance_action';
-- Expected: service_role / EXECUTE; no PUBLIC grant.

-- D. Confirm no recent owner_audit_log rows have target_type IS NULL
SELECT count(*) AS null_target_type_count
FROM public.owner_audit_log
WHERE target_type IS NULL;
-- Expected: 0
```

---

## 8. Rollback SQL

Restore the exact captured live function body (from pre-apply check C above).
Replace the body below with the exact `pg_get_functiondef` output saved before applying:

```sql
BEGIN;

-- Paste the full pg_get_functiondef output captured in pre-apply step C here.
-- Example structure (replace body with actual captured text):
CREATE OR REPLACE FUNCTION public.apply_marketplace_governance_action(
  p_actor_user_id uuid,
  p_job_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  status text,
  company_id uuid,
  exchange_visibility text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- <<< INSERT EXACT CAPTURED LIVE BODY HERE >>>
$$;

REVOKE ALL ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_marketplace_governance_action(uuid, uuid, text, text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
```

**Do not execute the rollback template as-is.** The `<<< INSERT EXACT CAPTURED LIVE BODY HERE >>>`
placeholder must be replaced with the actual saved body before running.

---

## 9. Scope boundary statement

This migration **exclusively**:

- Replaces the body of `public.apply_marketplace_governance_action(uuid, uuid, text, text)` to
  add three missing audit-insert columns (`target_type`, `target_id`, `target_name`).
- Issues a no-op `ALTER COLUMN target_type DROP DEFAULT` on `public.owner_audit_log`
  to ensure no implicit default exists.

It does **not** modify:
- Any table structure (no `CREATE TABLE`, `ALTER TABLE ADD COLUMN`, `DROP TABLE`)
- Any RLS policy
- `public.drivers` schema
- Onboarding logic or any other RPC
- `public.set_company_status_governance`
- `public.owner_review_compliance_document`
- `public.owner_decide_fraud_review_case`
- Any production data rows

---

## 10. Staging validation requirement

Before Production application:

1. Restore a Production-equivalent disposable environment.
2. Run pre-apply checks A–D above.
3. Apply `20260801091000_fix_owner_audit_log_target_type.sql`.
4. Run post-apply checks A–D above.
5. Execute `supabase/tests/marketplace_governance_atomicity.sql` on the disposable environment.
6. Confirm all four test blocks pass without exception.
7. Record pass output and attach to PR #326 before requesting Production approval.

---

## 11. Related tests

- **Unit (static, runs in CI):** `__tests__/marketplaceGovernanceAudit.test.ts`
- **SQL atomicity (disposable only):** `supabase/tests/marketplace_governance_atomicity.sql`

---

## 12. Current approval status

| Gate | Status |
|---|---|
| Patch migration authored | ✅ `20260801091000_fix_owner_audit_log_target_type.sql` |
| Patch narrows to one function only | ✅ confirmed |
| No broad four-function overwrite | ✅ confirmed |
| Static tests written and passing | ✅ `__tests__/marketplaceGovernanceAudit.test.ts` |
| SQL atomicity test written | ✅ `supabase/tests/marketplace_governance_atomicity.sql` |
| Staging validation completed | ⛔ BLOCKED — no disposable environment available |
| Platform Owner Production approval | ⛔ PENDING — requires staging evidence |
| Production application | ⛔ NOT APPROVED |
