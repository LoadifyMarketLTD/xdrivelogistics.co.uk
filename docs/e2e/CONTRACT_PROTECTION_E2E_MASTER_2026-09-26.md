# XDrive Contract Protection — E2E Master Ledger

Date: 26 September 2026
Scope: Contract Protection Layer steps 1–14
Canonical repo: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Validation branch: `feat/contract-payment-protection-20260926`

## Evidence rules

A status is `PASS` only when the relevant runtime was executed and its assertions completed successfully. Missing credentials, missing browser connection, or missing production mutation opt-in is `BLOCKED`, never PASS. Synthetic DB records used by the contract-flow smoke run only inside explicit transactions and are removed by `ROLLBACK`.

## Runtime ledger

| Area | Runtime evidence | Status |
| --- | --- | --- |
| Customer → Carrier | Real XDrive Supabase schema; pending migrations loaded in transaction; Award → payment acknowledgement → pending booking offer → explicit carrier acceptance → immutable commercial agreement/hash → amendment v2 → dispute → lifecycle events → rollback | PASS |
| Broker → Carrier | Same real-schema transaction and assertions, using approved Broker buyer identity and compliant Owner Driver carrier | PASS |
| Carrier → Subcontractor | Same real-schema transaction and assertions, using approved Carrier/Fleet company as buyer and compliant Owner Driver as subcontractor | PASS |
| Agreement immutability | `contract_snapshot_hash`, buyer/supplier/job snapshots asserted after carrier acceptance | PASS |
| Agreement amendmenting | Accepted version 2 and `job_commercial_agreements_effective` projection asserted | PASS |
| Dispute persistence | `job_disputes` open record asserted inside transaction | PASS |
| Buyer payment acknowledgement | Mandatory acknowledgement persisted before carrier acceptance | PASS |
| Event log | `booking_offer_created` + canonical `awarded` audit events asserted | PASS |
| Multilingual signing | Signed PDF generation executed for `en`, `ro`, `fr`, `es`, `pl`; PDF and signature hashes asserted | PASS |
| Authenticated browser Customer | Playwright master executed on Chromium + Mobile Safari; credential guard skipped the test because protected credentials are absent | BLOCKED |
| Authenticated browser Broker | Playwright master executed on Chromium + Mobile Safari; credential guard skipped the test because protected credentials are absent | BLOCKED |
| Authenticated browser Carrier/Fleet | Playwright master executed on Chromium + Mobile Safari; credential guard skipped the test because protected credentials are absent | BLOCKED |
| Authenticated browser Owner Driver | Playwright master executed on Chromium + Mobile Safari; credential guard skipped the test because protected credentials are absent | BLOCKED |
| Live browser mutation | Playwright master executed; production mutation gate skipped because `E2E_ALLOW_PRODUCTION_MUTATION=true` is not enabled | BLOCKED |

## Defects discovered by the E2E runtime

1. `job_tracking_events_event_type_check` rejected new contract events such as `payment_obligation_acknowledged`. Fixed by `20260926191551_extend_job_tracking_event_types_for_contract_flows.sql`.
2. Contract snapshot/amendment/extra hash functions called `digest()` without the Supabase extension schema in their locked `search_path`. Fixed by using `extensions.digest(...)` in all three contract migrations.
3. Super Admin buyer-risk API initially used dynamic segment `[companyId]` beside the existing `[id]` route. Playwright webServer startup exposed the Next.js route conflict; the endpoint was moved to `[id]/buyer-risk`, preserving the public URL and restoring application startup.
4. Buyer-risk effective-mode logic ignored an explicit `risk_mode='restricted'` after a buyer became established and could silently treat it as `cleared`. Fixed by preserving explicit `restricted` as the effective mode; regression coverage added.
5. Database blocked-event trigger inserts occurred in the same transaction immediately before `RAISE EXCEPTION`, so those inserts roll back with the rejected mutation. Durable `publish_blocked` / `award_blocked` logging is now performed by the API precheck before returning the risk rejection. Documentation no longer treats the rolled-back trigger insert itself as durable evidence.

Fresh Playwright preflight after the routing and risk-control repairs: **10 tests skipped by explicit credential/mutation guards, 0 failed, exit code 0** across Chromium and Mobile Safari.

These defects were found by executing the real database lifecycle, not by static inspection.

## Browser credential preflight

`e2e/contract-protection-master.spec.ts` uses the existing XDrive Playwright credential convention:

- `E2E_CUSTOMER_EMAIL` / `E2E_CUSTOMER_PASSWORD`
- `E2E_BROKER_EMAIL` / `E2E_BROKER_PASSWORD`
- `E2E_CARRIER_EMAIL` / `E2E_CARRIER_PASSWORD`
- `E2E_DRIVER_EMAIL` / `E2E_DRIVER_PASSWORD`
- `E2E_ALLOW_PRODUCTION_MUTATION=true` only for explicitly approved live mutations

Without those values the tests report `BLOCKED` through explicit Playwright skip reasons. They must not be reported as PASS.

## Real test identities verified in XDrive DB

The XDrive database contains approved active accounts/company bindings for Customer, Broker, Carrier Admin, and Owner Driver roles. Passwords are intentionally not stored in this ledger or source tree.

## Buyer Risk closeout evidence

Transaction-local replay against the real XDrive Supabase schema confirmed the current buyer snapshots without persistent production changes:

- Loadify Market: new buyer, 0 paid invoices, 0 active commitments, £543 outstanding exposure, explicit/effective `restricted`, limits 3 commitments / £2,500; £500 projected award remains allowed; £1,958 projection is blocked because total exposure would become £2,501.
- Broker company: new buyer, 0 paid invoices, 0 active commitments, £0 outstanding exposure, explicit/effective `restricted`, limits 3 / £2,500; £500 is allowed and £2,501 is blocked.
- Danny Fleet: new buyer, 0 paid invoices, 0 active commitments, £0 outstanding exposure, explicit/effective `restricted`, limits 3 / £2,500; £500 is allowed and £2,501 is blocked.

No buyer was permanently switched to `cleared`; all migration/snapshot verification was enclosed by `ROLLBACK`.

## Final executable gates

- Contract Protection targeted Vitest suite: **11 files / 82 tests PASS**.
- Signed legal agreement PDF: **8 tests PASS**, including EN/RO/FR/ES/PL real PDF generation and integrity checks.
- Contract DB smoke: **3/3 commercial scenarios PASS**, each in its own rollback transaction.
- TypeScript: `npm run typecheck` **PASS, exit code 0** after correcting the authenticated actor reference in the new publish-blocked audit call.
- Production build: `npm run build` **PASS, exit code 0**; the existing Next.js ESLint-plugin warning remains non-fatal.
- Playwright Contract Protection master: **10 skipped, 0 failed, exit code 0**. This is evidence that the guard executed correctly, not an authenticated-browser PASS.
- Supabase advisors: not clean; historical/pre-existing security/performance advisories remain in production. Contract Protection migrations are still pending and were not persistently applied for this closeout.

## Rerun requirements

When protected E2E secrets are available, run the authenticated browser preflight and then the existing role-specific suites. Any mutation test against production must require the explicit production mutation opt-in and dedicated approved test identities. No test should mutate Loadify Market or use it as an XDrive staging substitute.
