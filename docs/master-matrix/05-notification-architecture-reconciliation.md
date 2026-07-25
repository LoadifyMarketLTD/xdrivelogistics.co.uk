# Notification Architecture Reconciliation

**Generated**: 2026-07-25  
**Classification**: LAUNCH BLOCKER — Android drivers receive zero operational notifications
**Delivery status**: **IMPLEMENTED BUT NOT LIVE-VALIDATED** (not CLOSED until runtime evidence)

---

## 1. Two Models — Architecture Ruling

### `notifications` table (migration 021)

| Dimension | Value |
|---|---|
| Schema source | `021_prelaunch_alignment_entities.sql` |
| Migration | 021 |
| Columns | id, company_id, user_id, title, body, type, read_at, created_at |
| Writers (static analysis) | **NONE** — no INSERT found in application code |
| Readers | Native Android (Supabase REST), Web /m/ driver variant (fixed → now reads notification_events) |
| RLS | `notifications_all_member` — company membership check (too broad, fixed in bridge migration) |
| Status values | n/a (no status column) |
| Verdict | **ZOMBIE INBOX** — exists, RLS enabled, no writers |

### `notification_events` table (migration 071)

| Dimension | Value |
|---|---|
| Schema source | `071_notification_architecture.sql` |
| Migration | 071 |
| Columns | id, event_type, entity_type, entity_id, company_id, recipient_user_id, payload, status, created_at, processed_at |
| Writers | DB triggers (job_assigned, bid_accepted, pod_uploaded); APIs: broker-invitations, disputes, onboarding, invoice |
| Readers | Expo mobile (`/api/driver/mobile/resources`), web NotificationBell, admin ops-centre, super-admin, customer updates, web /m/ (fixed) |
| RLS | `notification_events_select_recipient_or_company_broadcast` (migration 20260723222000) |
| Status values | pending, sent, failed, skipped |
| Edge function | `notify-operational-event` processes pending → sent/failed |
| Retry model | No retry UI or endpoint (confirmed NOT_IMPLEMENTED — see contradiction analysis) |
| Verdict | **CANONICAL OUTBOX** — the authoritative event system |

---

## 2. Canonical Architecture Definition

```
Event producers                    notification_events (canonical outbox)
─────────────────                  ──────────────────────────────────────
DB triggers                ──────► id, event_type, entity_id, company_id,
  trg_notify_job_assigned           recipient_user_id, payload,
  trg_notify_bid_accepted           status (pending→sent/failed/skipped),
  trg_notify_pod_uploaded           processed_at
API endpoints
  broker-invitations                      │
  disputes                                │ Edge function: notify-operational-event
  onboarding                              │ (processes queue, updates status)
  invoices                                │
                                          ▼
                                    Web NotificationBell ─────── notification_events
                                    Expo mobile (resources API) ─ notification_events
                                    Customer updates page ──────── notification_events
                                    Admin ops-centre ────────────── notification_events
                                    Super-admin ─────────────────── notification_events

                            NEW (bridge trigger):
                            trg_bridge_notification_event_to_inbox
                                          │
                                          ▼
                                    notifications (inbox)
                                    ─────────────────────
                                    id, user_id, title, body, type, created_at
                                          │
                                          ▼
                                    Native Android ─ REST /rest/v1/notifications?user_id=eq.xxx
                                    (mark-read/delete also against notifications)
```

---

## 3. Producer/Consumer Map

### Producers

| Producer | Table | Event types | Migration / File |
|---|---|---|---|
| trg_notify_job_assigned (DB trigger) | notification_events | job_assigned | 071 |
| trg_notify_pod_uploaded (DB trigger) | notification_events | pod_uploaded | 071 |
| trg_notify_bid_accepted (DB trigger) | notification_events | bid_accepted | 071 |
| POST /api/broker/carrier-invitations | notification_events | carrier_invited | app/api/broker/carrier-invitations/route.ts:169 |
| PATCH /api/broker/carrier-invitations/[id] | notification_events | carrier_accepted, carrier_rejected | app/api/broker/carrier-invitations/[id]/route.ts:138 |
| POST /api/driver/finance/invoices/[id]/disputes | notification_events | invoice_dispute | app/api/driver/finance/invoices/[id]/disputes/route.ts:115 |
| POST /api/onboarding/init | notification_events | onboarding_submitted | app/api/onboarding/init/route.ts:135 |
| POST /api/onboarding/submit/* | notification_events | onboarding_approved, onboarding_rejected | app/api/onboarding/_lib/handlers.ts:354 |
| migration 116 trigger | notification_events | invoice_created | 116_notify_invoice_created.sql |

### Consumers

| Consumer | Table | How | Read by |
|---|---|---|---|
| Web NotificationBell | notification_events | supabase.from('notification_events') | All web users |
| Expo mobile resources API | notification_events | supabaseAdmin.from('notification_events') | Expo app |
| Customer updates page | notification_events | supabase.from('notification_events') direct | Customer users |
| Admin ops-centre | notification_events | /api/admin/operations-centre | Admin users |
| Super-admin platform | notification_events | /api/super-admin/platform?section=notifications | Owner |
| Super-admin email-readiness | notification_events | /api/super-admin/email-readiness | Owner |
| Native Android | notifications | Supabase REST /rest/v1/notifications | Android drivers (BROKEN) |
| Web /m/ driver (fixed) | notification_events | supabase.from('notification_events') | Web mobile drivers |

---

## 4. Is `notifications` Legacy?

**YES** — `notifications` is a legacy pre-architectural inbox. Evidence:
- Created in migration 021 (very early) as part of a "launch entities" dump
- No producers were ever wired to it
- All subsequent notification work (migration 071+) targets `notification_events`
- The architectural name `notification_events` with a status/processing model is clearly the intended outbox

**`notification_events` is canonical.** `notifications` is a legacy table retained only for Android compatibility.

---

## 5. Is one an outbox and the other a user inbox?

| Role | Table |
|---|---|
| Canonical event outbox | `notification_events` |
| User inbox (Android/legacy) | `notifications` |

The bridge trigger converts outbox rows into inbox rows automatically.

> Closure rule: Trigger existence alone is insufficient. Android notifications stay **IMPLEMENTED BUT NOT LIVE-VALIDATED** until producer → bridge → notifications → Android runtime is proven with recipient-level evidence.

---

## 6. Bridge Trigger

**Migration**: `20260725160000_notification_events_to_notifications_bridge.sql`

The trigger `trg_bridge_notification_event_to_inbox` fires AFTER INSERT on `notification_events`:
- Skips broadcast rows (`recipient_user_id IS NULL`)
- Maps `event_type` → human `title` via `fn_notification_event_title()`
- Maps `event_type + payload` → human `body` via `fn_notification_event_body()`
- Inserts into `notifications` with `ON CONFLICT (id) DO NOTHING` (idempotent)
- SECURITY DEFINER — executes with elevated privilege to bypass user-facing RLS

The trigger also tightens `notifications` RLS to:
- `notifications_recipient_select`: `user_id = auth.uid()` (Android reads own rows only)
- `notifications_service_role_all`: service_role bypass for the trigger

**This migration requires manual application in Supabase SQL Editor.**  
**Expected result**: `Success. No rows returned`  
**Effect**: All future `notification_events` inserts with a `recipient_user_id` automatically appear in `notifications` for Android.

---

## 7. Does the bridge already exist in the live DB?

Unknown — requires live DB access to verify. Run this check:

```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_bridge_notification_event_to_inbox';
```

Expected: 0 rows (bridge does not yet exist). If 1 row returned, bridge was applied in a prior session.

---

## 8. Is this a launch blocker?

**YES** — classification: **P0 / LAUNCH BLOCKER**

Reason: Native Android driver app receives zero operational notifications (job assignments, bid acceptances, POD events). Drivers using the Android APK are operationally blind to platform events. This creates:
- Drivers missing job assignments → jobs not collected on time
- Drivers missing bid acceptance → revenue loss
- No visibility of invoice or dispute events

The bridge migration is the minimum safe fix. FCM push (not implemented) is a separate future item.

---

## 9. Retry Model Analysis

**Finding**: No retry model exists for `notification_events` failures.

| Layer | Status |
|---|---|
| `notification_events.status = 'failed'` | Status is set and displayed in super-admin with red badge |
| Retry endpoint | NOT IMPLEMENTED |
| Retry UI button | NOT IMPLEMENTED |
| Manual re-queue mechanism | NOT IMPLEMENTED |
| Edge function retry loop | Unknown — live DB required |

The super-admin notifications page (`/super-admin/notifications`) renders rows with colour-coded status but has no actionable retry button. The API at `/api/super-admin/platform?section=notifications` is GET-only — no POST retry action.

**Classification**: NOT_IMPLEMENTED. Status: P2 (operational governance).

---

## 10. Status Values Reference

| Table | Status values |
|---|---|
| `notification_events` | `pending`, `sent`, `failed`, `skipped` |
| `notifications` | No status column — use `read_at IS NULL` for unread |
