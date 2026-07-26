# Notification Bridge Live Validation Ledger

**Generated**: 2026-07-25  
**Status**: **IMPLEMENTED BUT NOT LIVE-VALIDATED**  
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

**Step 1 (run first):**

```sql
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'trg_bridge_notification_event_to_inbox';
```

Expected: exactly one row.

---

## Runtime Evidence Ledger

| Checkpoint | Required evidence | Status | Evidence link |
|---|---|---|---|
| C1 | `notification_events` source row for a real recipient-addressed event | BLOCKED (awaiting SQL checkpoint + runtime run) | TBD |
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
