# Production Blocker Resolution Runbook

> **IMPORTANT — Read before touching anything.**
> - DO NOT run `supabase db push` as a single command in production.
> - DO NOT modify historical migration files.
> - DO NOT run `migration repair`.
> - DO NOT manually mark migrations as applied.
> - Always run the preflight SQL and review results before executing each blocked migration.
> - Always run the backup SQL before each blocked migration.

---

## Overview

Four migrations have been identified as requiring manual review before they can be safely applied:

| Migration | Risk | Reason |
|-----------|------|--------|
| `20260720121500_p0_database_security_and_schema_consistency.sql` | DESTRUCTIVE / MANUAL REVIEW | Drops triggers, repairs functions, scrubs notification payloads |
| `20260721221000_reconcile_confirmed_current_accounts.sql` | DESTRUCTIVE / MANUAL REVIEW | Updates `auth.users` metadata and upserts profiles/onboarding for 15 hardcoded addresses |
| `20260723111500_invoice_snapshot_integrity.sql` | DESTRUCTIVE / MANUAL REVIEW | Rebuilds invoice snapshots; may reset status of `submitted`/`approved` invoices to `Pending` |
| `20260723205200_harden_verified_company_claims.sql` | REQUIRES DATA REPAIR FIRST | Deletes `company_registration_claims` rows without provider-backed audit evidence |

---

## Safe Execution Windows

Apply migrations in the following staged windows. **Stop and verify before each blocker.**

### Window A — `001` through `129` (safe, no blockers)

```
001_initial_schema.sql
...
129_serialize_overpayment_guard.sql
```

**STOP** → Run preflight `preflight_20260720121500.sql` and review.  
**STOP** → Run backup `backup_column_inventory.sql`.  
Then apply blocker `20260720121500_p0_database_security_and_schema_consistency.sql`.

---

### Window B — after `20260720121500`, up to (and including) `20260721220900`

```
20260720174900_add_onboarding_workspace_columns.sql
20260720175000_fix_onboarding_compliance_column_alignment.sql
20260720234500_canonical_driver_job_lifecycle.sql
20260721000500_job_creation_idempotency.sql
20260721220900_add_driver_updated_at.sql
```

**STOP** → Run preflight `preflight_20260721221000.sql` and review.  
**STOP** → Run backup `backup_before_20260721221000.sql`.  
**Gate:** All 15 confirmed addresses must have `exists_in_auth_users = true`.  
Then apply blocker `20260721221000_reconcile_confirmed_current_accounts.sql`.

---

### Window C — after `20260721221000`, up to (and including) `20260721224500`

```
20260721223500_scrub_notification_secrets.sql
20260721224500_invoice_delivery_tracking.sql
```

**STOP** → Run preflight `preflight_20260723111500.sql` and review.  
**STOP** → Run backup `backup_before_20260723111500.sql`.  
**Gate:** Review every invoice row where `status_will_be_reset_to_pending = true`. Confirm each is acceptable before proceeding.  
Then apply blocker `20260723111500_invoice_snapshot_integrity.sql`.

---

### Window D — after `20260723111500`, up to (and including) `20260723205100`

```
20260723170500_fix_commercial_agreement_snapshot_defaults.sql
20260723201000_align_bid_compliance_with_live_driver_vehicle_records.sql
20260723201100_driver_vehicle_document_self_upload.sql
20260723201200_driver_job_search_preferences.sql
20260723201300_driver_native_production_workflow_repair.sql
20260723201400_driver_native_status_rpc.sql
20260723201500_post201_review_feedback_fixes.sql
20260723201600_remove_legacy_job_bid_insert_policies.sql
20260723205000_atomic_authenticated_company_registration.sql
20260723205100_require_verified_company_onboarding.sql
```

**STOP** → Run preflight `preflight_20260723205200.sql` and review.  
**STOP** → Run backups `backup_before_20260723205200.sql` (both statements, one at a time).  
**Gate:** If any claim row would be deleted that is linked to an active company still going through onboarding, resolve manually before proceeding.  
Then apply blocker `20260723205200_harden_verified_company_claims.sql`.

---

### Window E — after `20260723205200`, remaining migrations

```
20260723222000_notification_recipient_isolation.sql
20260724093000_rpc_membership_provisioning_hardening.sql
20260724134500_add_individual_driver_onboarding_type.sql
20260724135500_submit_individual_driver_without_company.sql
20260724152500_canonical_company_membership_authorization.sql
```

No blockers in this window. Apply in order.

---

## Preflight SQL Files

| Blocker | Preflight file |
|---------|---------------|
| `20260720121500` | `preflight_20260720121500.sql` |
| `20260721221000` | `preflight_20260721221000.sql` |
| `20260723111500` | `preflight_20260723111500.sql` |
| `20260723205200` | `preflight_20260723205200.sql` |

## Backup SQL Files

| Blocker | Backup file | What it backs up |
|---------|-------------|-----------------|
| `20260721221000` | `backup_before_20260721221000.sql` | `auth.users` metadata for 15+7 addresses |
| `20260723111500` | `backup_before_20260723111500.sql` | `invoices` rows that will be rebuilt |
| `20260723205200` | `backup_before_20260723205200.sql` | Full `company_registration_claims` + to-delete subset |
| All blockers | `backup_column_inventory.sql` | Column schema snapshot for 8 key tables |

---

## Exact Data Impact Per Blocker

### `20260720121500`
- **Modifies:** `public.notification_events.payload` — removes keys `onboarding_url`, `token`, `raw_token`, `onboarding_token` from any row that contains them.
- **Structural:** replaces constraint definitions on `company_memberships` and `job_tracking_events`; validates FK constraints on `drivers`; replaces functions `is_company_member`, `is_company_admin`, `is_company_operator`, `submit_onboarding_application`, `review_onboarding_application_atomic`, `assign_job_driver_atomic`; drops duplicate triggers on `drivers`, `invoices`, `job_bids`, `jobs`.
- **No rows deleted.**

### `20260721221000`
- **Updates** `auth.users.raw_user_meta_data` for 15 confirmed addresses (sets `role`, `requested_role`, `signup_type`, `account_type`, `workspace_mode`, `owner_driver_workspace`).
- **Upserts** `public.profiles` for those 15 addresses (sets `role`, `status`, `is_driver`, `is_internal_account`).
- **Updates** `public.profiles.is_internal_account = true` for 7 internal/owner addresses.
- **Upserts** `public.onboarding_applications` for 15 addresses (sets `account_type`, `workspace_mode`, `owner_driver_workspace`, `status`, `current_step`, `completion_percentage`, `payload`).
- **Updates** `public.drivers.app_access` for any driver row linked to those 15 users.
- **Inserts** snapshot row per matched user into `public.account_reconciliation_confirmed_20260721_snapshot`.

### `20260723111500`
- **Inserts** missing `public.job_commercial_agreements` rows for jobs with a single deterministic accepted bid.
- **Rebuilds** invoice snapshot fields for `repair_targets` (amounts, parties, location, service description, dates, job_ref).
- **Resets** status to `Pending` and nullifies `submitted_*`/delivery fields for `status_reset_targets` — invoices that are `submitted` or `approved` but have no proven provider delivery (no PDF, no delivery message ID).
- **Replaces** RLS policy `invoices_job_owner_read`.
- **Creates** trigger `trg_validate_invoice_snapshot_integrity` on `public.invoices`.

### `20260723205200`
- **Deletes** rows from `public.company_registration_claims` where no provider-backed Companies House audit event (`action IN ('created','reused')`, `source = 'companies_house_server_validation'`, `registry_status = 'active'`) exists.
- Creates/replaces function `public.enforce_verified_company_onboarding_submission()` with stricter audit check.

---

## Execution Gates (pass/fail criteria)

| Blocker | Pass condition |
|---------|---------------|
| `20260720121500` | All `_count` values in preflight = 0. If any orphan or invalid value found, fix data first. |
| `20260721221000` | All 15 confirmed addresses have `exists_in_auth_users = true`. |
| `20260723111500` | Every `status_will_be_reset_to_pending = true` invoice is reviewed and accepted as safe to reset. |
| `20260723205200` | Every row in to-delete list has been manually confirmed as not belonging to an active onboarding process. |

If a gate fails: fix the data, re-run the preflight, confirm clean, then proceed.
