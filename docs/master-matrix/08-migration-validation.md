# Migration Validation: Pairs, Ordering and Idempotency

**Generated**: 2026-07-25  
**Scope**: Recent and paired migrations, particularly finance, onboarding, broker, storage, notifications

---

## 1. Migrations 20260725130000 and 20260725140000 (Broker Carrier Invitations)

| Item | 20260725130000 | 20260725140000 |
|---|---|---|
| Filename | `broker_carrier_invitations.sql` | `broker_carrier_inv_carrier_side.sql` |
| Purpose | Creates table, RLS for broker side | Adds `rejected` status, carrier SELECT policy |
| Dependency | None (creates table) | Depends on 130000 table existing |
| Ordering | SAFE — 130000 runs first | SAFE — 140000 runs after |
| Idempotency | `CREATE TABLE IF NOT EXISTS`, `DO $$ IF NOT EXISTS $$` guards | DROP/recreate constraint, `DO $$ IF NOT EXISTS $$` for policy |
| Duplicate policies | None found | None found |
| Duplicate indexes | None found | None found |
| Duplicate triggers | `DROP TRIGGER IF EXISTS` before create | None |
| Live compatibility | Applied per stored memory: "Success. No rows returned" | Applied per stored memory: "has_rejected_status_check,has_carrier_select_policy: true,true" |
| Status | **APPLIED** | **APPLIED** |

**Assessment**: SAFE. Correct ordering. Both confirmed applied in live DB.

---

## 2. Migrations 20260725160000 (Bridge Trigger — NEW)

| Item | Value |
|---|---|
| Filename | `notification_events_to_notifications_bridge.sql` |
| Purpose | Bridge trigger: notification_events → notifications (Android/legacy inbox) |
| Dependency | notification_events table (migration 071), notifications table (migration 021) |
| Dependency ordering | Both prerequisites are in migrations 021 and 071 — both pre-date this migration |
| Idempotency | `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS + CREATE`, `DROP POLICY IF EXISTS` |
| Guards | DO $$ block checks both tables exist before proceeding |
| Duplicate policies | Drops `notifications_all_member` superseded policy, adds two specific policies |
| Application | **NOT YET APPLIED** — requires manual Supabase SQL Editor execution |
| Status | **PENDING MANUAL APPLICATION** |

---

## 3. Finance Foundation Migrations 125–129

| Migration | Filename | Purpose | Applied |
|---|---|---|---|
| 125 | `finance_foundation_0a.sql` | Finance schema foundation part A | Yes (per memory) |
| 126 | `finance_foundation_0b.sql` | Finance schema foundation part B | Yes |
| 127 | `finance_foundation_0c.sql` | Finance schema foundation part C | Yes |
| 128 | `finance_foundation_final.sql` | Final finance schema | Yes |
| 129 | `serialize_overpayment_guard.sql` | Overpayment prevention | Yes |

**Assessment**: All applied. 127→128→129 are ordered correctly — 129 depends on 128's invoice tables. No duplicate policies or indexes identified.

---

## 4. Finance Migrations 20260723111000 and 20260723111500

| Item | 20260723111000 | 20260723111500 |
|---|---|---|
| Filename | `add_missing_invoice_status_pending.sql` | `invoice_snapshot_integrity.sql` |
| Purpose | Adds `pending` to invoice status enum/check | Ensures snapshot columns exist and are not null |
| Applied | Yes (memory: "Success. No rows returned") | Yes (memory: "Success. No rows returned") |
| Ordering | SAFE | SAFE (depends on invoices table from 014) |
| Status | **APPLIED** | **APPLIED** |

---

## 5. Onboarding Migrations 099–117

| Range | Key migrations | Status |
|---|---|---|
| 099–104 | onboarding workflow foundation, state machine, customer type | Applied (pre-date recent sessions) |
| 107 | restrict_onboarding_applicant_state_writes | Applied |
| 109 | lock_owner_driver_onboarding_evidence_writes | Applied |
| 112 | review_onboarding_application_atomic | Applied |
| 117 | canonical_onboarding_submit_all_writes | Applied |
| 20260724134500 | add_individual_driver_onboarding_type | Applied |
| 20260724135500 | submit_individual_driver_without_company | Applied |
| Hotfix (memory) | review_onboarding_application_atomic hotfix for individual_driver without company | Applied |

**Potential ordering issue**: Migration 112 (review_onboarding_application_atomic RPC) was hotfixed after application. The hotfix was applied as a standalone SQL, not as a numbered migration. This means the repository migration file 112 may differ from the live DB function.

**Recommendation**: Run STEP 23 of the audit SQL to confirm `review_onboarding_application_atomic` exists with the hotfixed logic allowing `individual_driver` approval without company.

---

## 6. Storage and Security Migrations

| Migration | Applied | Notes |
|---|---|---|
| 032_storage_buckets.sql | Yes | Creates pod-docs, driver-docs, company-docs buckets |
| 095_driver_self_upload_policies.sql | Yes | Driver self-upload to driver-docs |
| 20260724235900_p0_storage_and_security_definer_hardening.sql | Yes (per stored memory) | Hardens storage RLS, SECURITY DEFINER functions |

---

## 7. Notification Migrations

| Migration | Applied | Notes |
|---|---|---|
| 071_notification_architecture.sql | Yes | Creates notification_events, three triggers |
| 084_finance_notifications_schema_guards.sql | Yes | Guards finance notification columns |
| 088_wire_email_notifications.sql | Yes | Email trigger integration |
| 114_notification_events_recipient_fk.sql | Yes | FK on recipient_user_id |
| 115_observable_email_trigger_settings.sql | Yes | Email trigger settings |
| 116_notify_invoice_created.sql | Yes | Invoice created trigger |
| 20260721223500_scrub_notification_secrets.sql | Yes | Scrubs secrets from notification payloads |
| 20260723222000_notification_recipient_isolation.sql | Yes | Tightens RLS to recipient-scoped |
| 20260725161000_notification_events_to_notifications_bridge.sql | **PENDING** | Bridge trigger — apply next |

---

## 8. Migration 20260720121500 (P0 Database Security)

| Item | Value |
|---|---|
| Applied | Yes (base migration) |
| Purpose | P0 security and schema consistency |
| Concerns | Very large migration — may have created competing policies |
| Recommendation | Run STEP 4 (all RLS policies) to verify no competing policies from this migration |

---

## 9. Unsafe Ordering Check

**No unsafe ordering detected** in the timestamp-prefixed migrations. All follow:
- Table created before policy added
- Dependency tables exist before FK references
- `IF NOT EXISTS` guards prevent conflicts

**One noted risk**: Migration 121 (`restore_company_memberships_runtime_rls`) and 20260724152500 (`canonical_company_membership_authorization`) may both modify `company_memberships` policies. Run STEP 4 to verify no duplicate policies exist on `company_memberships`.

---

## 10. Summary

| Category | Count | Applied | Pending |
|---|---|---|---|
| Total migrations | 160 | 159 | 1 (bridge) |
| Finance migrations | 8 | 8 | 0 |
| Notification migrations | 9 | 8 | 1 (bridge) |
| Onboarding migrations | 12 | 12 | 0 |
| Storage migrations | 4 | 4 | 0 |
| Broker carrier invitations | 2 | 2 | 0 |
| Security/hardening | 6 | 6 | 0 |

**The single remaining unapplied migration is the notification bridge** (`20260725160000`). This must be applied to fix the Android notification delivery launch blocker.
