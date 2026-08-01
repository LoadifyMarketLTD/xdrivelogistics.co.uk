# Notification Bridge Live Validation Ledger

**Generated**: 2026-07-25  
**Updated**: 2026-08-01  
**Status**: **MIGRATION APPLIED — SQL VERIFICATION REQUIRED**  
**Rule**: Android notifications are **not CLOSED** based only on trigger existence.

---

## Scope

Bridge implementation exists in code/migration, but the workflow is not considered closed until end-to-end runtime evidence proves:

1. source `notification_events` row exists;
2. bridged `notifications` row exists;
3. recipient `user_id` is correct;
4. Android runtime visibility is confirmed;
5. cross-user RLS denial is confirmed;
6. read/unread persistence is confirmed;
7. duplicate prevention is confirmed.

---

## Manual SQL Checkpoint (one statement per step)

**Bridge migration applied 2026-08-01** — "Success. No rows returned" confirmed.  
Run these verification queries next to confirm all DB objects were created:

**Step 1 (verify trigger):**

```sql
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'trg_bridge_notification_event_to_inbox';
```

Expected: exactly one row.

**Step 2 (verify RLS policies):**

```sql
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications';
```

Expected: `notifications_recipient_select` (SELECT, authenticated) + `notifications_service_role_all` (ALL, service_role).

**Step 3 (verify helper functions):**

```sql
SELECT proname FROM pg_proc
JOIN pg_namespace ON pg_namespace.oid = pronamespace
WHERE nspname = 'public'
  AND proname IN ('fn_notification_event_title', 'fn_notification_event_body', 'fn_bridge_notification_event_to_inbox');
```

Expected: 3 rows.

---

## Runtime Evidence Ledger

| Checkpoint | Required evidence | Status | Evidence link |
|---|---|---|---|
| SQL-1 | Trigger `trg_bridge_notification_event_to_inbox` exists (1 row) | UNVERIFIED — run Step 1 above | TBD |
| SQL-2 | RLS policies `notifications_recipient_select` + `notifications_service_role_all` exist | UNVERIFIED — run Step 2 above | TBD |
| SQL-3 | Helper functions exist (3 rows) | UNVERIFIED — run Step 3 above | TBD |
| C1 | `notification_events` source row for a real recipient-addressed event | BLOCKED (awaiting SQL verification + runtime run) | TBD |
| C2 | Bridged `notifications` row with same `id` | BLOCKED | TBD |
| C3 | `recipient_user_id` = `notifications.user_id` | BLOCKED | TBD |
| C4 | Android app visibly shows the bridged notification | BLOCKED | TBD |
| C5 | Different authenticated user cannot read recipient row (RLS denial) | BLOCKED | TBD |
| C6 | Read/unread transitions persist after refresh/reload | BLOCKED | TBD |
| C7 | Duplicate insertion prevented for same event id | BLOCKED | TBD |

---

## Required Runtime Proof Bundle

For closure, attach links to:

- SQL query output for source row (`notification_events`);
- SQL query output for bridged row (`notifications`);
- SQL query output proving recipient match;
- Android screenshot/video showing notification visibility;
- SQL/API output showing cross-user denial;
- before/after read state evidence (`read_at`);
- duplicate-attempt evidence showing single-row persistence.

---

## Current Execution Notes

- Bridge migration exists in repository: `supabase/migrations/20260725161000_notification_events_to_notifications_bridge.sql`.
- Local E2E baseline executed successfully after installing dependencies: **226 passed, 144 skipped, 0 failed**.
- Super-admin notification runtime tests remain skipped without owner credentials and runtime server service-role configuration.

---

## Closure Gate

Final status remains **IMPLEMENTED BUT NOT LIVE-VALIDATED** until C1–C7 all have live runtime evidence links.
