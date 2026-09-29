# XDrive Contract Protection E2E Evidence — 26 September 2026

## Scope

Fresh evidence for the Contract Protection Layer implemented on branch `feat/contract-payment-protection-20260926`.

Rules used for this closeout:

- no historical PASS is inherited;
- no browser/authenticated PASS is claimed without a real authenticated runtime;
- DB smoke data is synthetic, executed against the real XDrive Supabase schema, and removed by `ROLLBACK`;
- Loadify Market is not used as a staging environment;
- all contract-protection migrations are replayed in order before each DB smoke scenario.

## Fresh runtime evidence

| Scenario | Runtime | Result | Evidence |
| --- | --- | --- | --- |
| Customer → Carrier/Owner Driver | Real XDrive Supabase schema, transaction + rollback | PASS | Award creates pending carrier acceptance only; payment obligation acknowledgement persists; no agreement exists before carrier acceptance; carrier acceptance forms agreement; contract snapshot/hash valid; amendment v2 accepted; dispute row persists; lifecycle audit events persist. |
| Broker → Carrier/Owner Driver | Real XDrive Supabase schema, transaction + rollback | PASS | Same assertions as Customer flow, with Broker company as contractual buyer. |
| Carrier/Fleet → Subcontractor | Real XDrive Supabase schema, transaction + rollback | PASS | Same assertions as Customer flow, with Carrier/Fleet company as contractual buyer and compliant Owner Driver as performing subcontractor. |
| Commercial amendment | Real XDrive Supabase schema | PASS | Accepted amendment becomes contract version 2 and is projected by `job_commercial_agreements_effective`; immutable hash is present. |
| Dispute persistence | Real XDrive Supabase schema | PASS | Job dispute created and verified inside the same synthetic transaction. |
| Multilingual electronic signing | Node/Vitest with real PDF generation | PASS | EN, RO, FR, ES and PL each generate a valid signed PDF with SHA-256 PDF hash and signature-payload hash; tampered controlled-document hash is rejected. |
| Browser-authenticated Customer/Broker/Carrier/Owner Driver flows | Playwright master on Chromium + Mobile Safari | BLOCKED | Fresh run completed with 10 explicit skips and 0 failures because protected E2E passwords and production mutation opt-in are absent. No browser PASS is claimed. |

## Real account preflight

Approved XDrive test identities were verified in the real database for:

- Customer;
- Broker;
- Carrier/Fleet Admin;
- Owner Driver / Driver.

The account bindings and active company memberships exist. Passwords are not exposed through database or connector tooling and are intentionally not reconstructed or reset for this audit.

## Environment constraints

- XDrive has no separate staging Supabase project available in the connected account.
- The Loadify Market Supabase project is a separate product and was not used.
- Browser mutation tests remain blocked until protected E2E credentials or an approved authenticated browser session are supplied.

## Defects found by fresh E2E replay and fixed

1. **Tracking-event constraint mismatch** — Contract Protection introduced new event types but the live `job_tracking_events_event_type_check` did not permit them. Added migration `20260926191551_extend_job_tracking_event_types_for_contract_flows.sql` covering booking-offer, payment-obligation, commercial-amendment and execution-extra events.
2. **pgcrypto schema qualification** — `digest(...)` was unqualified while pgcrypto is installed in schema `extensions`. Contract snapshot, amendment snapshot and execution-extra snapshot hashing now use `extensions.digest(...)`.
3. **E2E fixture identity drift** — stale auth UUIDs and legacy bidder attribution were corrected to the current canonical test identities. The fixture now uses the exact driver ID where legacy `bidder_id` requires it.
4. **E2E rate-limit interference** — the three role flows are executed as separate rollback transactions so the production five-minute quote rate limit remains enabled and unmodified.
5. **Next.js dynamic-route collision** — the new buyer-risk API was initially placed under `[companyId]` while the same route level already used `[id]`. Playwright webServer startup failed with the slug-name conflict. The endpoint was moved to `[id]/buyer-risk`; typecheck and Buyer Risk tests passed afterward, and the Playwright master reached the intended explicit BLOCKED guards.
6. **Explicit restricted-mode override loss** — the Buyer Risk snapshot treated every established buyer as `cleared` unless explicitly `blocked` or `cleared`, thereby ignoring an explicit `restricted` control. The effective-mode CASE now preserves `risk_mode='restricted'`; regression test added.
7. **Blocked-risk event durability** — trigger-side `INSERT ...; RAISE EXCEPTION` cannot provide durable audit history because the insert rolls back with the rejected transaction. The publish/award APIs now write `publish_blocked` / `award_blocked` through the risk precheck before returning the rejection; documentation distinguishes this durable API event from the trigger-local rollback attempt.

## Reproducible DB smoke

Canonical SQL fixture:

`supabase/tests/contract_protection_role_flows_e2e.sql`

The fixture requires one of these transaction-local values:

- `customer_to_carrier`
- `broker_to_carrier`
- `carrier_to_subcontractor`

Each run must set `xdrive.e2e.scenario`, replay the pending Contract Protection migrations, execute the smoke, and end in `ROLLBACK`.

## Buyer Risk runtime evidence

All Buyer Risk checks below were run against the real XDrive database with the pending Contract Protection migrations loaded transaction-locally and the outer transaction rolled back:

| Buyer | Paid invoices | Active commitments | Outstanding exposure | Mode | Limits | £500 projection | Over-limit proof |
| --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Loadify Market | 0 | 0 | £543 | restricted | 3 / £2,500 | allowed (£1,043 projected total) | £1,958 projection blocked at £2,501 total |
| Broker company | 0 | 0 | £0 | restricted | 3 / £2,500 | allowed | £2,501 projection blocked |
| Danny Fleet | 0 | 0 | £0 | restricted | 3 / £2,500 | allowed | £2,501 projection blocked |

No permanent risk-control override was written.

## Final executable gates

- Targeted Contract Protection Vitest: **11 files, 82/82 tests PASS**.
- Multilingual signed-PDF subset: **8/8 PASS** within that run, including EN/RO/FR/ES/PL.
- Real DB smoke: **Customer→Carrier PASS; Broker→Carrier PASS; Carrier/Fleet→Subcontractor PASS**, each rolled back.
- `npm run typecheck`: first rerun exposed the new publish-audit actor-reference bug; after correction, **PASS / exit code 0**.
- `npm run build`: **PASS / exit code 0**. Existing non-fatal Next.js ESLint-plugin warning remains visible.
- Playwright master: **10 skipped, 0 failed, exit code 0** because credentials and production mutation opt-in remain absent.
- Supabase advisors: historical security/performance advisories remain; no "advisor clean" claim is made. Contract Protection migrations are not persistently deployed in production at this checkpoint.

## Current release-gate interpretation

The Contract Protection **database/runtime contract is freshly verified** for all three commercial relationships plus amendments, disputes, Buyer Risk boundaries, and corrected blocked-event semantics. Multilingual signed-PDF generation is freshly verified for all five controlled languages.

The wider release gate must remain **BLOCKED for browser-authenticated E2E** until the required protected credentials or approved authenticated browser session exists. This is an environment evidence gap, not a claimed product PASS.
