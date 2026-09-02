# Super Admin #431 → Current Main Consolidation Matrix — 2026-09-02

## Purpose

This document is the canonical extraction ledger for PR #431 (`preview/super-admin-visual-rebuild-20260831`). PR #431 is source/reference only and MUST NOT be merged directly into `main`.

Current consolidation baseline:

- `main`: `d51f9613c0ef51fa426c536f4cb9e761e5d2e5db`
- consolidation branch: `consolidate/super-admin-431-into-current-main-20260902`
- consolidation PR: #456 — Draft / DO NOT MERGE
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
- Company 360 component and inspector integration exists in current main.

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

## Active extraction candidates and audit findings

### Platform POD Review

Original #431 source:

- `supabase/migrations/20260831013000_platform_pod_review.sql`
- `app/api/super-admin/pod/[jobId]/route.ts`
- POD operations surfaces
- `__tests__/superAdminPlatformPodReview.test.ts`

Security audit found the #431 migration unsafe to promote as written because it adds Platform Owner review notes/status directly to `public.jobs`. Production confirms `authenticated` has both SELECT and UPDATE table privileges on `jobs`, with tenant/driver RLS policies exposing authorised job rows. RLS is row-scoped, not column-scoped, so internal Platform Owner provenance would become tenant-readable/tamperable.

Safe reconstruction now staged in #456:

- `supabase/migrations/20260902080500_platform_pod_review.sql`
- isolated `public.platform_pod_reviews` registry;
- RLS enabled;
- PUBLIC/anon/authenticated denied;
- service_role-only registry + RPC;
- owner authority + reason + physical-evidence requirement;
- owner audit ledger;
- dedicated `/api/super-admin/pod/[jobId]` GET/PATCH;
- dedicated `/super-admin/operations/pods/[jobId]` review surface;
- generic entity inspector remains READ ONLY;
- operations POD list links to dedicated review surface.

Current #456 state for POD extraction:

- branch was 0 behind baseline main at last compare;
- canonical Netlify passed on the POD implementation HEAD, then returned to PENDING after later documentation-only commits changed the PR HEAD; exact current HEAD must pass again before any release decision;
- Supabase preview branch has not yet been created, so migration replay/security runtime evidence is still missing;
- DO NOT MERGE.

Status: `UNIQUE_TO_431 → SAFE_RECONSTRUCTION_IN_PROGRESS`.

### Platform Finance Reconciliation

Original #431 source:

- `supabase/migrations/20260831015000_platform_finance_reconciliation.sql`
- finance reconcile API/UI deltas
- `__tests__/superAdminFinanceReconciliation.test.ts`

Audit findings:

1. #431 stores `platform_finance_reconciliation_*` internal provenance directly on `public.invoices`.
2. Production confirms `authenticated` has both SELECT and UPDATE table privileges on `invoices`; internal Platform Owner notes/result therefore require a separate service-role-only registry rather than tenant-visible invoice columns.
3. Canonical payment-status calculation is valid for one currency: `paid` when paid total >= invoice amount, `partially_paid` when > 0, else `unpaid`.
4. `invoice_payment_history.amount` is constrained positive and overpayment is row-lock serialized.
5. Current payment-history API accepts a request-provided `currency`, while the overpayment trigger sums amounts without checking currency. Cross-currency rows are structurally possible.
6. Production read-only check currently shows 0 invoice/payment currency-mismatch rows, so there is no known live mismatch incident.
7. Finance reconciliation must therefore fail closed on invoice/payment currency mismatch and must never silently sum mixed currencies.

Required safe design before implementation:

- separate service-role-only reconciliation registry;
- Platform Owner-only semantic RPC with reason/audit;
- verify every payment-history row currency equals invoice currency before summing;
- abort reconciliation if mismatch exists;
- do not create payment rows;
- only repair derived `payment_status` / `paid_at` after canonical ledger validation.

Status: `UNIQUE_TO_431 → RECONSTRUCTION_REQUIRED`.

### Notification Retry / Audit Governance

Original #431 source:

- `supabase/migrations/20260831020000_platform_notification_retry_audit.sql`
- notification API/UI deltas
- notification entity links/audit coverage

Audit findings:

- current queue uses durable `lease_token` + `lease_expires_at` and `FOR UPDATE SKIP LOCKED` claim authority;
- claim RPC will not claim a row while an unexpired lease remains;
- worker clears lease fields after normal completion/failure;
- #431 manual retry resets status/processed_at/error/next_attempt_at but does not explicitly clear lease fields;
- a hardened manual Platform Owner requeue must set `lease_token = NULL` and `lease_expires_at = NULL` atomically;
- `attempt_count` should remain monotonic; worker increments it and backoff is capped at 60 minutes rather than enforcing a hard max-attempt limit;
- service-role-only semantic retry + owner audit model is otherwise directionally sound.

Status: `UNIQUE_TO_431 → HARDENING_REQUIRED`.

### Platform Settings Governance

Original #431 source:

- `supabase/migrations/20260831022000_platform_settings_governance.sql`
- `app/api/super-admin/settings/route.ts`
- settings/global, feature-flags, roles-permissions, audit logs
- `__tests__/superAdminSettingsFlags.test.ts`

Audit findings:

- `platform_feature_flags` and `platform_settings` both have RLS enabled;
- current table grants include authenticated SELECT/UPDATE capability, so RLS is the effective boundary;
- `platform_feature_flags` currently has no authenticated policy and is therefore RLS-blocked for direct authenticated access;
- `platform_settings` currently has authenticated owner SELECT/ALL policies checking `profiles.role='owner'` but not active profile status;
- current `/api/super-admin/settings` uses a local owner verifier checking role only, not active status;
- current PATCH upserts settings/flags directly through service-role client without mandatory reason and without atomic `owner_audit_log` writes;
- adding #431 RPC alone would not close the existing unaudited direct mutation path.

Required convergence:

- use shared `verifyPlatformOwner` active-owner boundary;
- Deploy Preview writes remain fail-closed;
- route mutations must use semantic audited RPC instead of direct upsert;
- reason required;
- atomic setting/flag mutation + owner audit;
- tighten/replace direct RLS write policy so it cannot bypass governed mutation requirements;
- handle roles-permissions section explicitly rather than leaving it as a separate unaudited direct write.

Status: `UNIQUE_TO_431 + CURRENT_MAIN_GOVERNANCE_GAP → CONVERGENCE_REQUIRED`.

### XDrive Enquiry Governance

Original #431 source:

- `supabase/migrations/20260831235900_owner_manage_xdrive_enquiry.sql`
- `supabase/migrations/20260831235930_owner_manage_xdrive_enquiry_vehicle_type_compat.sql`
- `app/api/super-admin/xdrive-logistics/enquiries/[id]/route.ts`
- enquiry governance tests/UI deltas

Audit findings:

1. Current main performs price/status mutations and enquiry→job conversion in application code with multiple separate DB writes.
2. Current main can create a job and then fail to update the enquiry, leaving split-brain state.
3. Current main has a fallback that removes `creation_idempotency_key` and retries job insertion after an idempotency-key-related error; this weakens duplicate protection and must not survive convergence.
4. #431 improves this materially by moving quote mutation, job conversion and owner audit into one row-locked transaction with reason and Platform Owner authority.
5. #431 adds an `expected_updated_at` optimistic-concurrency guard and reuses an existing job with `creation_idempotency_key = enquiry.id` for safe replay.
6. The public intake source was independently checked in `LoadifyMarketLTD/app.xdrivelogistics.co.uk`: it sends collection and delivery **postcodes** into the upstream `pickupLocation`/`deliveryLocation`, so using those values as `pickup_postcode`/`delivery_postcode` is correct for this specific source contract.
7. The #431 vehicle compatibility migration is stale against current Production enum truth. Current application mapper emits slugs such as `van_small`, `van_large`, `truck_7_5t`; current Production `vehicle_type` enum includes values such as `small_van`, `large_van`, `7_5t` plus many granular values. #431's compatibility branches do not correctly cover the current combination.
8. Therefore #431 cannot be promoted verbatim even though its transaction model is superior.

Required safe reconstruction:

- retain atomic SECURITY DEFINER transaction and row lock;
- retain active Platform Owner authority and mandatory reason;
- retain expected-updated-at concurrency guard;
- retain durable owner audit;
- never drop idempotency protection as a fallback;
- resolve vehicle type against the **current actual enum** using a deterministic, tested compatibility map;
- reject unsupported/ambiguous vehicle mapping instead of silently converting to a broad default when commercial execution could be affected;
- preserve intake source guard and configured intake-company boundary;
- validate own_fleet/direct_carrier/marketplace execution semantics against current job publication rules before enabling conversion.

Status: `UNIQUE_TO_431 → ATOMIC MODEL VALUABLE / VEHICLE COMPATIBILITY REBUILD REQUIRED`.

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
