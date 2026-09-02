# Super Admin #431 → Current Main Consolidation Matrix — 2026-09-02

## Purpose

This document is the canonical extraction ledger for PR #431 (`preview/super-admin-visual-rebuild-20260831`). PR #431 is source/reference only and MUST NOT be merged directly into `main`.

Current consolidation baseline:

- `main`: `d51f9613c0ef51fa426c536f4cb9e761e5d2e5db`
- consolidation branch: `consolidate/super-admin-431-into-current-main-20260902`
- PR #431 HEAD: `afa1712b837f63fd2674abce5c97ebf5c3b21251`
- PR #431: OPEN / DRAFT / NOT MERGED
- #431 is materially diverged from current main and must be mined module-by-module.

## Rules

1. Never merge #431 directly.
2. Never copy an existing main file wholesale unless its patch is proven current-main-compatible.
3. Classify each #431 capability as `ALREADY_IN_MAIN`, `PARTIAL_RECONCILIATION`, `UNIQUE_TO_431`, or `REJECT/OBSOLETE`.
4. Migrations are treated as independent security/runtime releases and require Supabase preview validation before merge.
5. Existing main functionality wins over stale #431 variants.
6. No Production mutations during extraction/validation.
7. #431 stays open until all useful unique capability has been accounted for.

## Confirmed already in current main

### Read-only Platform Owner control plane

- Global Search page/API exists in current main.
- Entity inspector control-plane foundation exists in current main.
- Company 360 component and inspector integration exist in current main.

Status: `ALREADY_IN_MAIN` — preserve current main implementation; only reconcile truly missing deltas.

### Platform Case Centre

Promoted through validated current-main reconstruction and merged previously.

Status: `ALREADY_IN_MAIN`.

### Onboarding document request backend

Current main contains:

- `platform_document_requests` migration/registry;
- `owner_request_onboarding_documents` backend flow;
- Super Admin request-documents API;
- operational notification worker support;
- regression coverage.

Status: `ALREADY_IN_MAIN` for backend. User-side checklist/verification UX remains separate and must be reconciled independently.

## Confirmed not present in current main under #431 contracts

The following #431 migration/capability contracts did not resolve in current-main code search and remain extraction candidates:

### Platform POD Review

Source migration in #431:

- `supabase/migrations/20260831013000_platform_pod_review.sql`

Related #431 surfaces include:

- `app/api/super-admin/pod/[jobId]/route.ts`
- operations POD UI/navigation
- `__tests__/superAdminPlatformPodReview.test.ts`

Status: `UNIQUE_TO_431` pending full security/runtime audit.

### Platform Finance Reconciliation

Source migration in #431:

- `supabase/migrations/20260831015000_platform_finance_reconciliation.sql`

Related #431 surfaces include:

- `app/api/super-admin/finance/invoices/[invoiceId]/reconcile/route.ts`
- finance API/UI deltas
- `__tests__/superAdminFinanceReconciliation.test.ts`

Status: `UNIQUE_TO_431` pending audit against current finance/VAT/payment truth.

### Notification Retry / Audit Governance

Source migration in #431:

- `supabase/migrations/20260831020000_platform_notification_retry_audit.sql`

Related #431 surfaces include:

- notification API/UI deltas
- operational worker deltas
- notification entity links/audit coverage

Status: `UNIQUE_TO_431` pending audit against current notification worker/idempotency/retry implementation.

### Platform Settings Governance

Source migration in #431:

- `supabase/migrations/20260831022000_platform_settings_governance.sql`

Related #431 surfaces include:

- `app/api/super-admin/settings/route.ts`
- settings/global, feature-flags, roles-permissions, audit logs
- `__tests__/superAdminSettingsFlags.test.ts`

Status: `UNIQUE_TO_431` pending authority/RLS/atomicity audit.

### XDrive Enquiry Governance

Source migrations in #431:

- `supabase/migrations/20260831235900_owner_manage_xdrive_enquiry.sql`
- `supabase/migrations/20260831235930_owner_manage_xdrive_enquiry_vehicle_type_compat.sql`

Related #431 surfaces include:

- `app/api/super-admin/xdrive-logistics/enquiries/[id]/route.ts`
- enquiries list/detail governance
- `__tests__/superAdminXdriveEnquiryGovernance.test.ts`

Status: `UNIQUE_TO_431` pending audit against current XDrive enquiry schema and business workflow.

## Partial reconciliation candidates

These areas exist in current main but #431 contains additional or alternative implementation. They MUST be patch-audited rather than copied:

- Super Admin notifications UI/API;
- finance page/API;
- operations page/API;
- compliance pages/APIs;
- support/cases surfaces;
- users/canonical role surfaces;
- Company Verification / onboarding remediation UI;
- Super Admin settings pages;
- XDrive Logistics internal pages;
- premium shell/navigation/CSS convergence;
- Platform Owner action/decision controls.

Status: `PARTIAL_RECONCILIATION`.

## Deferred separate workstream

### Onboarding document checklist / Company Verification UX

An earlier validation branch was started but intentionally paused when the #431 full-inventory risk was identified. Do not merge that work independently until its overlap with the consolidated #431 matrix is resolved.

## Extraction order

1. Complete module inventory and exact current-main overlap map.
2. POD Review.
3. Finance Reconciliation.
4. Notification Retry/Audit.
5. Settings Governance.
6. XDrive Enquiry Governance.
7. Onboarding document checklist / Company Verification UX.
8. Remaining partial UI/API/control-plane deltas.
9. Final visual/nav parity audit.
10. Only after every useful #431 capability is classified and either promoted or rejected may #431 be closed.

## Promotion gate for every extracted module

Each module must be reconstructed on top of the then-current `main` and must pass:

- exact diff review;
- 0-behind check immediately before merge;
- targeted unit/contract tests;
- typecheck/lint/build as applicable;
- canonical Netlify exact-head PASS;
- Supabase preview replay/health for migrations;
- privilege/RLS/security verification for new DB contracts;
- second anti-regression review of any existing file touched;
- SHA-guarded merge.

No green CI result alone is sufficient proof of merge safety.
