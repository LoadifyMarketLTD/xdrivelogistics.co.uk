# Production Runbook — `20260801163000_p0_fix_fraud_review_case_audit_target_type.sql`

**Status:** NOT APPLICABLE / ARCHIVED / AUTOMATIC-CHAIN NO-OP  
**Migration file:** `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/supabase/migrations/20260801163000_p0_fix_fraud_review_case_audit_target_type.sql`  
**Historical candidate patch SQL:** `/home/runner/work/xdrivelogistics.co.uk/xdrivelogistics.co.uk/docs/ops/20260801163000_p0_fix_fraud_review_case_audit_target_type.historical.sql`

---

## 1. Decisive Production evidence

Captured Production lookup result:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE oid = to_regprocedure(
  'public.owner_decide_fraud_review_case(uuid,uuid,text,text)'
);
-- Result: zero rows
```

Captured Production table inventory result:

```sql
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('fraud_review_cases', 'profiles', 'onboarding_applications')
ORDER BY table_name;
-- Result: profiles, onboarding_applications only (fraud_review_cases absent)
```

---

## 2. Final decision

- `public.owner_decide_fraud_review_case(uuid,uuid,text,text)` does not exist in Production under the exact target signature.
- `public.fraud_review_cases` is absent in Production.
- `20260801163000_p0_fix_fraud_review_case_audit_target_type.sql` is **NOT APPLICABLE** to current Production.
- The automatic migration file is intentionally converted to a notice-only executable no-op.
- The candidate patch SQL is preserved for audit/history in `docs/ops/...historical.sql`.

---

## 3. Required execution posture

- Do **not** create the missing function in this PR.
- Do **not** create `fraud_review_cases` in this PR.
- Do **not** apply candidate patch SQL to Production.
- Do **not** request staging or Production approval for this migration.

This migration track is closed as archived no-op unless future live schema/function evidence materially changes.
