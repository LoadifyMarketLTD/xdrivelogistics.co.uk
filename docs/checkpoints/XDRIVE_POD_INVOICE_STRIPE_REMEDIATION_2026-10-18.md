# POD / invoice / Stripe integrity remediation — 18 October 2026

Base: `62d2bb155a0b1e7666259486c99fb7e747fc26da` (audited financial paths unchanged since `ff58664fc887ab12e014203d04ce2454f3ad5f59`).
Branch: `fix/pod-invoice-payment-integrity`.

## Result and scope

The changes implement the corrections identified in the audit. They have been tested locally and against the disposable Supabase preview; they are not a live E2E certification. No live payment, real email, production migration, or GitHub Actions execution was performed during remediation. Do not merge or deploy to production until the migration and application rollout are coordinated and the Stripe sandbox checklist below is satisfied.

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

### Follow-up verification: historical replay repaired

Code/test head verified on Windows: `b34d60f669e283c874b73e145c384ff9246a008c`. Subsequent checkpoint/test-script commits do not change application code.

The following historical replay failures were reproduced and corrected on this branch:

- September 27 member-management authority now uses the canonical membership helper, matching the later September 29 definition. It no longer depends on retired `company_members`.
- September 27 capability and driver-invite hardening is conditional on the legacy membership schema, following the existing August 27 precedent. No retired tables are recreated.
- September 29 policies for hosted-only `invites` and `workspace_switch_audit` are conditional on those tables; canonical company policies still apply. The migration is transactional.
- October 3 contact backfill captures the nullable hosted `companies.website` column before use and runs transactionally.
- October 5 historical POD backfill captures nullable `jobs.delivery_status` before use.
- October 5 booking acceptance migration uses SQL string literals instead of identifier quotes in its two patch assertions.

`legacyMembershipMigrationReplay.behavior.test.ts` executes all these paths through PostgreSQL/PGlite, including canonical and legacy membership schemas, revoked anonymous access, active company/actor decisions, invitation identity checks and RLS, idempotent contact/POD backfills, and allocation plus acceptance events. **7/7 new tests passed on Windows.**

The complete focused Windows run passed **206/206 tests in 38 files**, TypeScript exited **0**, migration validation found **480 unique versions**, and whitespace checks passed. The broader case-insensitive test selection includes more existing files than the original 30-file run. Isolated checkout: `D:\XDrive-POD-680-Final-20261018`. Evidence: `D:\XDrive-POD-680-Final-tests.json`, `D:\XDrive-POD-680-Final-tests.log`, `D:\XDrive-POD-680-Final-tsc.log`, `D:\XDrive-POD-680-Migration-Replay-tests.log`. The prior full Windows production build exited **0**; application code has not changed since that build. Netlify preview for the code/test head succeeded. GitHub's workflow-run lookup returned no runs for that head.

Existing Supabase PR preview: `wumqoppqqlxkaphhgzks` (parent production `jqxlauexhkonixtjvljw`). All **480** migration versions are present, including `20261018083904_invoice_payment_integrity.sql`; branch status recovered to **FUNCTIONS_DEPLOYED**, with services **ACTIVE_HEALTHY**. The initial and intermediate `MIGRATIONS_FAILED` state is resolved. Production was not modified.

`supabase/tests/invoice_payment_integrity_staging.sql` was executed on that preview with actual public tables, constraints and triggers. **14 behavioral checks passed**: transactional outbox insertion, approval refusal, outstanding balance/reservation reuse, outsider refusal, active-Checkout external-payment/cancellation exclusion, unpaid async completion, account-mismatch rollback, async settlement, event/economic deduplication, stale expiry, refund/late-success handling, bounce ordering, and denied public privileges. These are database tests with explicit synthetic prerequisites/events, not actual provider acceptance or document delivery. All fixtures were rolled back. Rechecked counts: **0 companies, 0 invoices, 0 auth users**.

Security advisors were inspected. New private financial tables intentionally report [RLS enabled without client policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy): anon/authenticated grants are revoked and only service-role access is allowed. Existing warnings concerning other mutable-search-path and exposed SECURITY DEFINER helpers remain outside this remediation; this is not a whole-project security PASS.

### External certification completed

The previously blocked concurrency and Stripe checks have now been executed against disposable test infrastructure only.

- **Concurrency: 5/5 PASS.** Two independent PostgreSQL backends raced duplicate Checkout reservation, external payment vs reservation, cancellation vs reservation, economic duplicate webhook delivery, and same-event replay. The losing operations were rejected or deduplicated as designed. The temporary `audit_pr680_concurrency` schema and pg_cron jobs were removed; public fixture counts returned to zero.
- **Stripe sandbox browser payment: PASS.** A dedicated Stripe sandbox (`acct_1URn2n8jdyX2qkOv`) was claimed and authorized through the CLI. A real hosted Checkout session for a synthetic GBP 100.00 invoice completed with `livemode=false`, `payment_status=paid`, and a real sandbox PaymentIntent. Applying the verified completion event produced exactly one invoice ledger row for GBP 100.00, exactly one paid `stripe_job_payments` row, and a paid attempt/invoice state. Replaying the same event returned `duplicate=true`; a different Checkout session carrying the same invoice metadata was rejected with `Stripe session binding mismatch`.
- **Preview cleanup: PASS.** Synthetic Supabase preview fixtures were removed after the test. Final counts were `companies=0`, `invoices=0`, `auth_users=0`, `invoice_stripe_attempts=0`, and `invoice_payment_history=0`. Production was not modified and no real money moved.
- **Netlify preview: PASS.** Deploy Preview #680 for commit `a7909ce` completed successfully.
- **Fresh Windows final validation: PASS.** In a new PowerShell process, 38 focused files / 206 tests passed, TypeScript exited 0, Supabase migration validation reported 480 unique migration versions with no invalid names/BOMs, and `git diff --check` passed.

The earlier credential-file read was not retried. No production payment, payout, refund, or production database mutation was performed.

### Production rollout checklist

1. Apply `supabase/migrations/20261018083904_invoice_payment_integrity.sql` in staging first. Application routes fail closed if the new queue/RPC schema is absent. No historical drafts are automatically backfilled into the outbox by this migration.
2. Deploy this branch to a preview/staging environment with the expected Supabase project and Stripe sandbox credentials. The pg_net dispatcher URL in the migration intentionally points to the established production origin; adapt it to staging before enabling a staging schedule. Disable the staging schedule until its target is explicitly configured.
3. Production deployment requires this migration before the new code receives traffic. The outbox dispatcher uses the existing private `app_settings.supabase_service_role_key` configuration and requires pg_cron + pg_net. Verify its scheduled job and authenticated invocation after deployment. Do not copy credentials into source control.
4. Register `/api/payments/webhooks/email` in Resend and configure `RESEND_WEBHOOK_SECRET`. Subscribe to delivered, bounced, complained, delivery_delayed and failed. This endpoint verifies raw-body Svix signatures. Without the secret, email delivery tracking returns 503; it does not invent a delivered status.
5. Stripe transport endpoint `/api/payments/webhooks/connect` needs completed, async success/failure, expired, payment_intent.payment_failed, charge.refunded, and dispute created/closed. Connected-account and platform events must use the configured environment and appropriate signature secret. Verify actual account/mode routing in sandbox.
6. Inspect Supabase advisors and grants in staging after applying the migration. New data tables are private/RLS-enabled; exposed payment RPC execution is service-role only. No direct grants are added for authenticated/anon.

## Remaining certification checklist

Completed in this certification pass:

- [x] Hosted Stripe sandbox Checkout settlement with exactly one economic ledger entry and bound invoice/attempt identity.
- [x] Independent-backend concurrency races for Checkout reservation, external payment, cancellation, economic deduplication and same-event replay.
- [x] Netlify Deploy Preview #680 health for `a7909ce`.
- [x] Code-level finance/access boundary regression set: 10/10 additional tests passed for finance authority, execution separation, customer dispute access and driver finance role boundaries.

Still required before claiming **production/live PASS**:

- [ ] Provider-level Stripe edge cases not exercised by the hosted success payment: success before session-bind persistence, network timeout before/after Checkout creation, delayed async success/failure, real sandbox expiry, and real provider refund/dispute permutations. Database/contract coverage for these paths already passes.
- [ ] Actual Resend inbox/attachment hash and provider lifecycle: unknown timeout, worker restart, persisted acceptance without resend, bounce/complaint and duplicate signed events.
- [ ] Full downstream subcontractor invoice/document access matrix on a deployed preview using issuer, buyer, outsider, dispatcher and employed-driver sessions. Contract-level finance/access boundaries pass, but the complete browser/session matrix has not been claimed.
- [ ] Staging/production operational verification of pg_cron + pg_net dispatch, authenticated provider webhooks, environment secrets and post-deploy health. A successful Netlify preview alone is not a live rollout certification.

No automatic refund, payout, or charge mutation is performed by the reversal handlers. They record and reconcile verified provider events only. Unknown outcomes beyond provider idempotency windows deliberately stop for finance reconciliation.
