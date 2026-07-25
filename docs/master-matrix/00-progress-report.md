# Master Matrix — Inventory Progress Report

**Generated**: 2026-07-25  
**Commit**: Current HEAD on branch `copilot/zero-baseline-enterprise-audit`

---

## A. COMPLETE INVENTORY PROGRESS

| Item | Total | Classified | Remaining |
|---|---|---|---|
| Pages | 165 | 165 | 0 |
| API routes | 72 | 72 | 0 |
| Migrations | 160 | 160 | 0 |
| Expo mobile source files | 19 | 19 | 0 |
| Android Kotlin source files | 11 | 11 | 0 |
| Workflow controls (decomposed) | ~180 | ~180 | 0 |
| E2E test specs | 16 | 16 | 0 |
| Skipped tests (unique) | 72 | 72 | 0 |

**Page inventory**: See `docs/master-matrix/01-page-inventory.md`  
**API inventory**: See `docs/master-matrix/02-api-inventory.md`  
**Workflow decomposition**: See `docs/master-matrix/03-workflow-decomposition.md`  
**Mobile identity**: See `docs/master-matrix/04-mobile-identity-matrix.md`  
**Notification architecture**: See `docs/master-matrix/05-notification-architecture-reconciliation.md`  
**Skipped test ledger**: See `docs/master-matrix/06-skipped-test-ledger.md`  
**Prior fix contradictions**: See `docs/master-matrix/07-prior-fix-contradiction-analysis.md`  
**Migration validation**: See `docs/master-matrix/08-migration-validation.md`

---

## B. TRUE STATUS TOTALS

### Workflow Controls (~180 decomposed items across 12 workflows)

| Status | Count | Notes |
|---|---|---|
| CLOSED | 8 | Static contract tests only (state machines, serialization) |
| PARTIAL | 148 | Implementation exists, missing test or secondary control |
| PLACEHOLDER | 3 | Static UI only, no backend |
| BROKEN | 1 | Android notification delivery (WF 9.10) |
| DUPLICATE | 0 | — |
| OBSOLETE | 0 | — |
| BLOCKED | 8 | Requires live DB verification |
| NOT_IMPLEMENTED | 3 | Retry endpoint, push FCM for Android, job status notification |
| NOT_AUDITED | 0 | — |

### Pages (165 total)

| Status | Count |
|---|---|
| PARTIAL (real implementation, needs auth test) | ~130 |
| PLACEHOLDER (static UI or redirect) | ~15 |
| BLOCKED (requires live DB) | ~15 |
| CLOSED | 0 |

### API Routes (72 total)

| Status | Count |
|---|---|
| PARTIAL (implemented, no authenticated test) | ~60 |
| PLACEHOLDER (stub or not implemented) | ~5 |
| BROKEN | 0 (no confirmed code bugs) |
| CLOSED | 0 |

**Zero items qualify for CLOSED under the full standard.**

---

## C. ARCHITECTURE CONTRADICTIONS

### C1: Notification Model Dual Architecture

| Dimension | Value |
|---|---|
| Current implementation | `notification_events` as canonical outbox, `notifications` as empty inbox |
| Competing implementation | Android reads `notifications`; all web reads `notification_events` |
| Canonical recommendation | `notification_events` is canonical; `notifications` is Android-compatible inbox bridged by trigger |
| Evidence | android-native/data/ApiClient.kt:298, supabase/migrations/071 |
| Risk | **LAUNCH BLOCKER** — Android drivers see zero notifications |
| Safe remediation | Apply bridge migration 20260725160000 |

### C2: Web /m/ Driver Notification Source

| Dimension | Value |
|---|---|
| Previous implementation | `supabase.from('notifications')` — empty zombie table |
| Fixed implementation | `supabase.from('notification_events')` — canonical table |
| Evidence | app/m/_components/DriverMobileAppVariant.tsx |
| Risk | Drivers using web mobile shell saw no notifications |
| Fix status | **APPLIED in this PR** |

### C3: Retry Workflow — Claimed vs Actual

| Dimension | Value |
|---|---|
| Claimed | Retry endpoint and UI implemented |
| Actual | NOT implemented — status badge colour only |
| Evidence | app/super-admin/notifications/page.tsx (read-only), app/api/super-admin/platform/route.ts (GET only) |
| Risk | Failed notifications cannot be retried — P2 operational issue |
| Fix status | NOT_IMPLEMENTED — P2 priority |

### C4: Mobile Application Dual Identity

| Dimension | Value |
|---|---|
| Current | Two apps: Expo (canonical, .preview bundle) + Native Android (active, main bundle) |
| Risk | Inconsistent notification state, push model gap (FCM unimplemented in Android) |
| Recommendation | Determine which APK is on driver devices before archiving either |
| Fix status | Investigation required — do not archive without device verification |

---

## D. TEST COVERAGE

| Metric | Value |
|---|---|
| Tests passed | 226 |
| Tests failed | 0 |
| Tests skipped | 144 |
| Unique tests skipped | 72 |
| Browser duplicates | 72 (each test runs on chromium + mobile-safari) |
| Workflows with zero authenticated E2E | 10 of 12 |
| Workflows with static tests only | 8 |
| Workflows with authenticated runtime tests | 2 (super-admin finance, super-admin support — skipped, need credentials) |

### Skip breakdown by cause

| Cause | Unique tests | Skipped runs |
|---|---|---|
| Missing E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD | 33 | 66 |
| Missing E2E_DRIVER_EMAIL + E2E_DRIVER_PASSWORD | 10 | 20 |
| Missing E2E_BROKER_EMAIL | 10 | 20 |
| Missing E2E_CARRIER_EMAIL | 3 | 6 |
| Missing E2E_CUSTOMER_EMAIL | 7 | 14 |
| Missing E2E_OWNER_EMAIL + E2E_OWNER_PASSWORD | 6 | 12 |
| Production safety guard | 3 | 6 |
| **TOTAL** | **72** | **144** |

---

## E. REMEDIATION COMPLETED IN THIS PR

### E1: Notification Bridge Migration

| Field | Value |
|---|---|
| Issue | Android drivers see zero notifications |
| File | `supabase/migrations/20260725160000_notification_events_to_notifications_bridge.sql` |
| Endpoint / DB object | Trigger `trg_bridge_notification_event_to_inbox` on `notification_events` |
| Functions added | `fn_notification_event_title()`, `fn_notification_event_body()` |
| Policies modified | `notifications`: replaced `notifications_all_member` with `notifications_recipient_select` + `notifications_service_role_all` |
| Test added | None (requires live DB + Android device) |
| Result | Migration prepared — requires manual application in Supabase SQL Editor |

### E2: Web /m/ Driver Notification Fix

| Field | Value |
|---|---|
| Issue | Web mobile driver variant read from `notifications` (zombie table) → empty notification list |
| File | `app/m/_components/DriverMobileAppVariant.tsx` |
| Change | Changed from `supabase.from('notifications')` to `supabase.from('notification_events')` with mapping |
| Typecheck | No new errors (pre-existing errors unrelated to this change) |
| Test added | Existing E2E would cover this with driver credentials |
| Result | Fixed in this PR |

---

## F. MANUAL CHECKPOINT — Live DB SQL Required

### ⚠️ STOP — Manual SQL Application Required

**Migration to apply**:
- File: `supabase/migrations/20260725160000_notification_events_to_notifications_bridge.sql`
- Content: Full SQL in that file
- Purpose: Bridge `notification_events` → `notifications` for Android + fix RLS on notifications table
- Expected result: `Success. No rows returned`
- Risk: READ-ONLY except for trigger/function/policy creation — does NOT modify data or migration history

**After applying, run verification**:

```sql
-- Verify bridge trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'trg_bridge_notification_event_to_inbox';
-- Expected: 1 row (AFTER INSERT on notification_events)

-- Verify new RLS policies on notifications
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications';
-- Expected: notifications_recipient_select (SELECT, authenticated) + notifications_service_role_all (ALL, service_role)

-- Verify helper functions exist
SELECT proname FROM pg_proc
JOIN pg_namespace ON pg_namespace.oid = pronamespace
WHERE nspname = 'public'
  AND proname IN ('fn_notification_event_title', 'fn_notification_event_body', 'fn_bridge_notification_event_to_inbox');
-- Expected: 3 rows
```

**After verification, the next session can proceed to**:
1. Enable Groups A and F skipped tests (set E2E_ADMIN_EMAIL + E2E_OWNER_EMAIL in CI secrets)
2. Verify notification delivery end-to-end with an Android device
3. Implement notification retry (P2)
4. Add FCM push to Android native app (P2)
5. Determine which mobile app is on driver devices

---

## Priority Queue: Remaining Unblocked Work

### P0 — Security and Data Integrity

| Item | Status after this PR | Next action |
|---|---|---|
| Android notification delivery | Bridge migration prepared | **Apply migration manually** |
| Web /m/ notification source | **FIXED** | Verify with driver credentials |
| notifications RLS tightened | Bridge migration prepared | **Apply migration manually** |
| Live DB RLS audit | BLOCKED | Run live_db_audit_package.sql |

### P1 — Launch-Blocking Workflows

| Item | Status | Next action |
|---|---|---|
| Notification delivery end-to-end | PARTIAL (after bridge) | Apply bridge, test with Android |
| Driver onboarding authenticated E2E | NOT_IMPLEMENTED | Create test driver account |
| Job creation E2E | PARTIAL | Set E2E_ADMIN_EMAIL to enable tests |
| Invoice lifecycle E2E | PARTIAL | Same |
| POD E2E | NOT_IMPLEMENTED | Requires device/emulator |
| Broker invitation E2E | PARTIAL | Set E2E_BROKER_EMAIL |

### P2 — Operational Governance

| Item | Status | Priority |
|---|---|---|
| Notification retry endpoint | NOT_IMPLEMENTED | P2 |
| Notification retry UI | NOT_IMPLEMENTED | P2 |
| FCM push for Android | NOT_IMPLEMENTED | P2 |
| Failure detail in super-admin | PLACEHOLDER | P2 |
| Super-admin notifications E2E | PARTIAL (skipped) | Set E2E_OWNER_EMAIL |
