# POD / invoice / Stripe integrity remediation — 18 October 2026

Base: `62d2bb155a0b1e7666259486c99fb7e747fc26da` (audited financial paths unchanged since `ff58664fc887ab12e014203d04ce2454f3ad5f59`).
Branch: `fix/pod-invoice-payment-integrity`.

## Result and scope

The changes implement the corrections identified in the audit. They have been tested locally; they are not a live E2E certification. No live payment, real email, production migration, or GitHub Actions execution was performed during remediation. Do not merge/deploy until the migration and application rollout are coordinated and the Stripe sandbox checklist below is satisfied.

| Finding | Implementation |
| --- | --- |
| F01 documents | Private document URLs must match issuer and invoice path. External URLs and foreign paths are refused; public upload cannot replace the official invoice PDF. |
| F02 partial payment | A PostgreSQL RPC locks the invoice and reserves the outstanding balance, rather than charging face value. An active reservation blocks external settlement. |
| F03 binding | The settlement transaction verifies account, environment, session, attempt, invoice, buyer, supplier, mode, amount and currency. |
| F04 async | Both completed/paid and async success use atomic settlement; unpaid completion remains processing; definitive async failure/expiration closes only that attempt. |
| F05 old events | Failed card entry retains the same Checkout reservation. Expiration cannot downgrade a settled attempt. Duplicate completion cannot override refund tracking. |
| F06 atomicity | Ledger entry, payment tracking, attempt and event are updated together in one transaction; economic deduplication precedes the overpayment trigger. |
| F07 recipient | Marketplace draft email cannot be changed freely; immutable email snapshots also block later email/job/company/amount changes. |
| F08 PDF | POD-only evidence, supported signature formats and typed attestations are included. Uploaded PDF evidence pages and image overflow are appended, rather than omitted. Corrupt evidence fails the send. |
| F09 POD | Submission revalidates complete, available, tenant/job-bound evidence before preparing the immutable invoice PDF. |
| F10 automation | Generated invoice insertion creates the outbox row transactionally. The pg_cron/pg_net dispatcher retries independently of the browser. |
| F11 cancellation | Nonpayable status is rejected by Checkout; SQL blocks cancellation while Stripe reservation is active. Approval is conditional on the observed invoice status. |
| F12 currency | External payment validates the invoice currency and a finite, positive two-decimal amount; SQL checks currency again. Supported Checkout currencies are GBP/EUR/USD. |
| F13 approval | Normal buyer-linked external payments require approved issued invoices. Direct-client invoices without a buyer account retain issuer-side external recording for issued invoices. Credit notes cannot receive payments. |
| F14 signature | Empty/arbitrary objects are rejected. Canonical POD and finance use the same signature predicate. |
| F15 retries | Attempt-specific Stripe keys and frozen customer/return parameters are reused. Existing Checkout is retrieved. Unknown results beyond 23 hours require reconciliation instead of creating another charge. |
| F16 email recovery | Frozen provider payload/PDF, persistent message acceptance, stale-claim recovery and no blind retry beyond the provider window. Signed Resend events record delivered/bounced/complained/delayed/failed separately from accepted. |
| F17 reversals | Cumulative refunds and terminal disputes are stored idempotently and recalculate net payment state, capped at captured value. Refunded/disputed invoices require finance review before another payment. |

Finance read APIs also require an invoice-capable membership. Owning a parent job no longer gives access to a separately bound downstream buyer invoice.

## Local verification

Run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npx vitest run __tests__/*Pod*.test.ts __tests__/*pod*.test.ts __tests__/*invoice*.test.ts __tests__/*stripe*.test.ts __tests__/driverFinanceEndpointBoundaryContract.test.ts __tests__/xdrivePaymentTermsContract.test.ts --maxWorkers=2
NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit
node .github/scripts/validate-supabase-migration-files.mjs
git diff --check
```

Focused result: **157/157 tests passed across 30 files**. TypeScript, targeted production-file ESLint, migration naming/encoding validation (480 unique versions) and whitespace checks also passed.

The focused suite includes original contract tests, actual handler execution with isolated provider adapters, real HMAC/Svix verification, real PDF generation, and PostgreSQL PL/pgSQL execution via pinned PGlite. The SQL suite applies the new migration against a minimal compatible schema plus the existing production overpayment/payment-apply trigger definitions. It tests reservation, role denial, active-payment exclusion, wrong account/session/mode, rollback on ledger failure, async settlement, same-event and same-payment deduplication, stale expiration/refund/dispute, outbox insertion, and email recipient/order handling.

PGlite serializes local queries: these tests do not prove multi-connection race behavior, production grants/schema equivalence, full Supabase migration replay, pg_net transport, or actual Stripe/Resend delivery. SQL row locks and the unique active-attempt index are part of the design, and need staging multi-session validation.

The actual renderer was used to create and inspect a temporary three-page invoice with typed attestation and overflow evidence. A separate test appends an uploaded POD PDF. Corrupt images are rejected. The temporary sample uses synthetic test fixtures, never production documents.

## Coordinated rollout

1. Apply `supabase/migrations/20261018083904_invoice_payment_integrity.sql` in staging first. Application routes fail closed if the new queue/RPC schema is absent. No historical drafts are automatically backfilled into the outbox by this migration.
2. Deploy this branch to a preview/staging environment with the expected Supabase project and Stripe sandbox credentials. The pg_net dispatcher URL in the migration intentionally points to the established production origin; adapt it to staging before enabling a staging schedule. Disable the staging schedule until its target is explicitly configured.
3. Production deployment requires this migration before the new code receives traffic. The outbox dispatcher uses the existing private `app_settings.supabase_service_role_key` configuration and requires pg_cron + pg_net. Verify its scheduled job and authenticated invocation after deployment. Do not copy credentials into source control.
4. Register `/api/payments/webhooks/email` in Resend and configure `RESEND_WEBHOOK_SECRET`. Subscribe to delivered, bounced, complained, delivery_delayed and failed. This endpoint verifies raw-body Svix signatures. Without the secret, email delivery tracking returns 503; it does not invent a delivered status.
5. Stripe transport endpoint `/api/payments/webhooks/connect` needs completed, async success/failure, expired, payment_intent.payment_failed, charge.refunded, and dispute created/closed. Connected-account and platform events must use the configured environment and appropriate signature secret. Verify actual account/mode routing in sandbox.
6. Inspect Supabase advisors and grants in staging after applying the migration. New data tables are private/RLS-enabled; exposed payment RPC execution is service-role only. No direct grants are added for authenticated/anon.

## Remaining certification checklist

- Complete the real browser flow from POD through buyer approval and Stripe sandbox settlement; verify exactly one economic ledger entry and the supplier account destination.
- Two independent database sessions: simultaneous Checkout calls, external payment vs reservation, cancellation vs reservation, and concurrent webhook delivery.
- Stripe success before session-bind persistence, timeout before/after Checkout creation, expired-session reconciliation, delayed payment success and failure, refund/dispute permutations.
- Actual Resend inbox/attachment hash, unknown timeout, worker restart, persisted acceptance without resend, bounce/complaint and duplicate signed events.
- Compare issuer/buyer/outsider/dispatcher/employed driver access on downstream subcontractor invoices and document paths.
- Verify deployment health, pg_cron execution and provider webhook configuration before claiming live PASS.

No automatic refund, payout, or charge mutation is performed by the reversal handlers. They record and reconcile verified provider events only. Unknown outcomes beyond provider idempotency windows deliberately stop for finance reconciliation.
