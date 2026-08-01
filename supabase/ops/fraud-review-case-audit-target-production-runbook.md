# Production Runbook — `20260801163000_p0_fix_fraud_review_case_audit_target_type.sql`

**Status:** BLOCKED PENDING LIVE EVIDENCE  
**Migration file:** `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801163000_p0_fix_fraud_review_case_audit_target_type.sql`

---

## 1. Preconditions

Do not apply this migration unless all of the following are satisfied first:

1. Raw Production output is archived for:
   - `SELECT pg_get_functiondef(oid) ... to_regprocedure('public.owner_decide_fraud_review_case(uuid,uuid,text,text)')`
   - `SELECT table_name, table_type ... WHERE table_name = 'fraud_review_cases'`
2. The raw Production function body proves that the live function exists and still omits `target_type = 'fraud_case'`.
3. `public.fraud_review_cases` exists in Production as a `BASE TABLE`.
4. Disposable or staging validation is available before any Production approval.
5. Platform Owner gives explicit written approval after reviewing the staged evidence.

If any precondition fails, classify the migration as **NOT APPLICABLE** and stop.

---

## 2. Exact objects changed

If this migration becomes applicable, it changes exactly these objects:

- `public.owner_decide_fraud_review_case(uuid, uuid, text, text)`
- PostgREST schema cache notification channel via `NOTIFY pgrst, 'reload schema'`

It must not change any table DDL, RLS policy, driver schema, or unrelated governance function.

---

## 3. Captured live function body

**Required before any apply:** paste the raw `pg_get_functiondef` output here and archive the exact SQL result with the release evidence.

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE oid = to_regprocedure(
  'public.owner_decide_fraud_review_case(uuid,uuid,text,text)'
);
```

### Current repository state

- Repo-canonical baseline: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260730100000_owner_decide_fraud_review_case_atomicity_backfill.sql`
- Staged candidate patch: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801163000_p0_fix_fraud_review_case_audit_target_type.sql`
- Superseded no-op: `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801130000_fix_fraud_review_case_audit_target.sql`

---

## 4. Live-vs-patch diff that must be reviewed

The only intended functional delta versus the repo-canonical body is the `owner_audit_log` INSERT enrichment below:

- `target_type = 'fraud_case'`
- `target_id = p_case_id`
- `target_name = format('Fraud review case %s', p_case_id)`

Everything else must remain semantically identical:

- same function signature
- same return type
- same `SECURITY DEFINER`
- same `search_path = public, pg_temp`
- same business-logic guards
- same profile-blocking side effects
- same onboarding-application side effects
- same grant / revoke posture

If the live body already contains that enrichment, classify the migration as **NOT APPLICABLE**.

---

## 5. Staging / disposable validation

Run only on a disposable or staging database that mirrors the captured live body.

1. Load or confirm the current Production-equivalent function body.
2. Run the two preflight queries from Section 1 and archive raw output.
3. Reproduce the failure path with a fraud-review action that would write to `owner_audit_log`.
4. Apply `20260801163000_p0_fix_fraud_review_case_audit_target_type.sql` in one transaction.
5. Re-run the fraud-review action.
6. Verify exactly one audit row is written with:
   - `target_type = 'fraud_case'`
   - `target_id = <case uuid>`
   - deterministic `target_name`
7. Verify the function still blocks / clears profiles and updates onboarding records exactly as before.
8. Capture the post-apply `pg_get_functiondef` result.
9. Capture schema-cache reload success evidence.

If staging cannot prove the before/after behavior, do not approve Production apply.

---

## 6. Transaction boundaries

- The migration itself is designed to run inside one explicit `BEGIN; ... COMMIT;` block.
- Do not combine it with any other migration or ad-hoc SQL in the same Production window.
- If the migration becomes applicable, execute it alone.

---

## 7. Post-apply verification

Immediately after any staged or Production apply, archive all of the following:

1. `SELECT pg_get_functiondef(oid) ...` for the exact function signature
2. A verification query showing the new audit row contains `target_type`, `target_id`, and `target_name`
3. A verification query showing `public.fraud_review_cases` is still a base table
4. Evidence that the functional branch still updates:
   - `public.fraud_review_cases`
   - `public.profiles`
   - `public.onboarding_applications`
5. `NOTIFY pgrst, 'reload schema'` / schema-cache reload confirmation

---

## 8. Rollback

Rollback must use the captured live Production function body from Section 3.

1. Save the raw pre-apply `pg_get_functiondef` output.
2. If rollback is needed, restore that exact function definition in a standalone transaction.
3. Reapply the original grants and revokes if the rollback script does not already include them.
4. Re-run schema-cache reload verification.
5. Re-run the fraud-review smoke scenario and verify behavior matches the captured pre-apply baseline.

Do not invent a rollback body from repo assumptions once live drift has been observed.

---

## 9. Schema-cache reload verification

The migration emits `NOTIFY pgrst, 'reload schema'` after commit. Verification must include one of:

- an observed successful PostgREST schema refresh in the platform logs, or
- a follow-up RPC invocation proving the updated function signature/body is visible after apply.

Absence of reload evidence keeps the rollout incomplete.

---

## 10. Platform Owner approval gate

Production SQL remains blocked until the Platform Owner explicitly confirms all of the following in writing:

- raw Production evidence reviewed
- decision matrix result accepted
- staging/disposable validation passed
- rollback artifact captured
- schema-cache reload verification plan accepted
- Production window approved

**Current verdict:** `20260801163000_p0_fix_fraud_review_case_audit_target_type.sql` is **not approved for Production apply**.
