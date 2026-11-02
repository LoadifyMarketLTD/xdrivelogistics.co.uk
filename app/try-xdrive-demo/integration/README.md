# XDrive DEMO Ã¢â‚¬â€ integrated capability register

XDrive DEMO becomes the operational standby for XDrive Logistics. **Keep DEMO visual identity unchanged**: no copying primary platform CSS, navigation, layout or visual components. Internal contracts, APIs, schema, authorization and backend services may be adapted.

Primary source: GitHub LoadifyMarketLTD/xdrivelogistics.co.uk (main). Target: this repository, DEMO routes and components.

## Integrated into DEMO code; evidence
- Canonical vehicle, cargo and 15-minute schedule options from primary LoadPostingForm -> app/try-xdrive-demo/components/canonicalLoadOptions.ts and PostLoadDemo.tsx. Vitest 3/3 PASS (__tests__/demoCanonicalPostingOptions.test.ts), ESLint and scoped TypeScript PASS.
- Posting draft-to-exchange transition and public exchange listing -> app/api/try-xdrive-demo/loads/route.ts, demoExchange.ts, FindLoads.tsx. Static checks passed; authenticated cross-company E2E unverified.
- Separate received and submitted quote lists -> app/api/try-xdrive-demo/quotes/route.ts, DemoQuotes.tsx, DemoReceivedQuotes.tsx. Static checks passed; two-company E2E unverified.
- Explicit sample invoice preview after POD -> DemoInvoicePreview.tsx. UI-only, no invoice issuance or sent email.

## Not integrated / blocked
- Atomic Award Quote with safety checks, carrier acceptance/decline, driver allocation, stage transitions, persistent private POD, fiscal invoice PDF, AR/AP, member directory backend, live availability, real return journeys, Freight Vision, operational diary, independent disaster recovery.
- Do not mark a module complete merely because a DEMO screen exists. Failover readiness is NOT VERIFIED.

## Required sequence for each import
1. Read actual GitHub main code, dependencies, backend and authorization.
2. Implement only inside DEMO frontend/API/library with adapters; retain DEMO visual identity.
3. Test lint, TypeScript, unit, authenticated two-company positive/negative workflows, desktop/mobile and seven roles.
4. Record source-to-target mapping, test evidence and unresolved gaps here and in _audit/XDRIVE_DEMO_AUTONOMOUS_CHECKPOINT.md.
5. Do not bypass Stripe/legal/payment or commercial protection; keep production writes, notifications and billing separate from synthetic staging tests.
6. No merge/deploy until complete regression verification.

Machine evidence: _audit/XDRIVE_BACKUP_PARITY_MATRIX_20261031.json; _audit/XDRIVE_DEMO_IMPLEMENTATION_20261031.md; _audit/demo-isolated-3118-smoke-20261031.json.

## 2026-10-31 booking integration iteration
- Added JWT-scoped read-only GET /api/try-xdrive-demo/loads?view=bookings; selects own-company and awarded-carrier jobs (status awarded, allocated, in_transit, completed), checks tenant ownership again after RLS, exposes only authorized booking fields. No service-role bypass.
- Added useDemoBookings() to DEMO and wired DemoSharedBookings to actual booking endpoint, not the own-loads cache. Booking view marks source records readOnly and hides unverified write controls so no simulated acceptance/driver assignment/POD success occurs.
- Tests PASS: _audit/demo-bookings-lint-20261031.log, _audit/demo-bookings-tsc-20261031.log, HTTP 200 Customer/Broker/Driver, unauthenticated booking GET 401. Authenticated two-tenant acceptance E2E remains required.

## 31 Oct 2026 - atomic award blocker remediation
- Verified dedicated staging DB via read-only introspection: public.accept_job_bid_atomic(uuid,uuid) is not executable by authenticated and has side-effect triggers (notification). A privileged commercial award cannot be safely simulated with sequential REST writes or unauthorized RPC grants.
- Updated DEMO award API to return explicit code DEMO_AWARD_ATOMIC_UNAVAILABLE, retryable=false, HTTP 503. No false commercial job award or emails. ESLint and scoped TypeScript PASS (_audit/demo-award-blocker-lint-20261031.log and _audit/demo-award-blocker-tsc-20261031.log).
- Remaining concrete blocker: dedicated staging atomic operator with fully authorized payment/legal/Stripe checks or a separately isolated simulated-only job schema, with two-account E2E before enabling award.


## 2026-10-31 12:08 award authorization implementation
- Implemented role/tenant/stale-bid precondition contract in lib/try-xdrive-demo/demoRolePolicy.ts; wired into DEMO POST /api/try-xdrive-demo/quotes/award. Verified 7/7 Vitest authorization cases, targeted ESLint PASS, scoped TypeScript PASS. No changes to DEMO appearance.
- This is a genuine reusable server-side guard, not an award transaction. Award persistence remains blocked until dedicated safe atomic staging function/permissions and two-tenant E2E are implemented. Do not claim Award functional.


## 31 Oct 2026 12:33 booking logic
- Added reusable state transition guard lib/try-xdrive-demo/bookingTransitions.ts for booking acceptance/rejection, allocation, driver milestones, POD and completion. Requires assigned driver and vehicle for allocation and delivery steps, and real evidence to accept POD. 8 new Vitest cases PASS plus 7 role-policy cases PASS, lint and scoped tsc PASS.
- No claim of operational Booking / POD: this is domain validation only; persistence, authenticated route and E2E remain pending.


## 31 Oct 2026 12:46 - quote route recovery
- Actual integration: GET /api/try-xdrive-demo/quotes now resolves quote job IDs to authorized canonical jobs, returns sanitized outcodes plus vehicle (not full private addresses). My Quotes displays that route even when own-loads cache cannot see other companies' jobs. Both submitted and received quote flows supported.
- Verified scoped tsc PASS and targeted lint PASS: _audit/demo-quote-route-tsc-20261031.log, _audit/demo-quote-route-lint-20261031.log. Authenticated two-company E2E still outstanding. No DEMO CSS or layout changed.


## 2026-10-31 13:46 — read-only booking status correction
- Backend returns authoritative jobs.status in operationalStatus for awarded / allocated / in_transit / completed bookings. In read-only cards, DEMO no longer renders the fictional step-0 Accepted timeline, mock quote price, or unverified acceptance/assignment. It shows source status explicitly. No visual CSS change.
- A JSX parser error was caught by ESLint, fixed immediately and verified with lint PASS, scoped tsc PASS; all 22 core regression tests PASS (_audit/demo-regression-20261031-1345.log).
- Still missing operational write paths (Award, acceptance, assignment, POD), two-tenant auth E2E and validated failover. Work not declared done.


## 2026-10-31 13:54 — sequential module remediation: postcode
- Fixed stale postcode lookup options and pending state when the user clears input below two characters, without DEMO style changes: app/try-xdrive-demo/components/DemoPostcodeField.tsx.
- Targeted lint PASS, scoped TypeScript PASS, existing postcode/tenant tests 4/4 PASS. This is a UI correctness repair, not complete postcode provider coverage or persisted private addresses. Still requires authenticated address/stop persistence and postal API fallback E2E.


## 31 Oct 2026 14:04 device + postcode real HTTP test
- POSTCODE live API: BB1 9QL and DA8 1NY HTTP 200, malformed !!! HTTP 400, empty prefix HTTP 200 (empty suggestions). Customer, Broker, Driver shells HTTP 200.
- ADB is installed at C:/Users/xdriv/AppData/Local/Android/Sdk/platform-tools/adb.exe but only OPPO CPH2125 is visible. User explicitly forbids any tests on OPPO. Pixel 7 is not connected to ADB, and available AVD Medium_Phone_API_37.0 is not a Pixel 7. No OPPO actions or installations were performed.
- Postal full-address lookup may return no addresses when paid GetAddress provider unavailable; preserve honest manual entry. Persistent private addresses and two-company lifecycle E2E remain unverified.


## 2026-10-31 14:12 role enforcement in Quotes API
- Wired server-side can-submit and can-withdraw role checks in app/api/try-xdrive-demo/quotes/route.ts using existing canonical DEMO role policy; can-view-received quotes also now shares same role policy. Company Driver/nonoperator cannot submit or cancel quotes by invoking endpoint directly.
- Scoped ESLint PASS, tsc PASS, 11/11 policy/postcode test suite PASS. Full live two-tenant E2E and atomic Award remain unverified.


## 2026-10-31 14:25 Staging DEMO isolated atomic award
- Created public.xdrive_demo_awards in Staging ONLY: FK jobs/job_bids, unique job/bid atomic one-award enforcement, tenant RLS with active membership, buyer operator authorization, validated posted exchange + submitted bid. Revoked anon privileges; authenticated SELECT/INSERT only, no UPDATE/DELETE. Confirmed RLS enabled, two policies, anon SELECT disabled.
- Wired POST /api/try-xdrive-demo/quotes/award to dedicated table, returns 201 upon insert. No writes to commercial jobs and no notification trigger side effects. eslint PASS, scoped tsc PASS.
- Not yet an end-to-end completed award/booking: 2-company authenticated E2E and bookings GET/acceptance must be wired. Staging table insert not exercised without authenticated fixtures; do not claim operational PASS.


## 2026-10-31 14:30 DEMO Award to Bookings read integration
- GET /api/try-xdrive-demo/loads?view=bookings now reads tenant-scoped xdrive_demo_awards and joins accessible job detail, returning pending acceptance stage and awarded bid ID while retaining legacy commercial bookings (deduplicated). Awards created via isolated staging table can now appear on DEMO Bookings lists without modifying commercial jobs, assuming authenticated JWT RLS access.
- Encountered JSX/TS parsing failure in array spread and repaired; final lint PASS, scoped tsc PASS, 19/19 regression PASS, git diff check PASS. Authenticated two-company E2E and Booking Acceptance write remain NOT verified, no production deploy.


## 2026-10-31 14:38 carrier booking response
- STAGING xdrive_demo_awards: added responded_at and carrier-only RLS UPDATE policy requiring active operator membership and pending acceptance; grants restrict authenticated UPDATE to stage/responded_at, no changes to immutable company/job/bid identifiers. Confirmed job_id UPDATE privilege false.
- Implemented POST /api/try-xdrive-demo/bookings/respond and wired Accept/Reject booking buttons for pending carrier DEMO booking; refreshes booking query. No visual CSS change or OPPO action.
- Verified lint PASS; scoped tsc PASS; 15/15 policy/transition tests PASS; anonymous API POST 401; git diff check PASS. Authenticated two-company E2E remains outstanding; not released to production.


## 31 Oct 2026 14:47 DEMO driver allocation
- Staging-only xdrive_demo_awards: carrier operator-only allocation transition accepted to allocated, stored assigned_driver_name and assigned_vehicle_label plus allocated_at; PostgreSQL check constraints and limited UPDATE columns. Verified driver field writable by authenticated but job_id immutable; separate row-level policy restricts carrier ownership.
- Implemented bookings/allocate API and DEMO form wiring for carrier views, plus booking GET fields. ESLint PASS, scoped TypeScript PASS, 15/15 domain tests PASS. Actual authenticated two-company E2E not yet run, so do not declare full flow complete. OPPO untouched, no production publish.


## 31 Oct 2026 15:10 driver DEMO authentication UX
- User found no-session HTTP401 on dedicated 3118 Driver Alerts. Integrated staging-restricted password sign-in inside existing Alerts panel; refreshes exchange on successful session. Does not bypass authentication or expose other tenants, no CSS changes. Targeted ESLint PASS and scoped TypeScript PASS. Credentialed 2-company E2E not yet verified.


## 31 Oct 2026 - received/submitted quote route correction
- Corrected escaped whitespace bug in canonical UK full postcode to public outcode reduction in GET /api/try-xdrive-demo/quotes. This previously hid valid job origin/destination as Area unavailable. ESLint PASS and scoped TypeScript PASS. No CSS edits, production writes or OPPO interaction. Authenticated two-company E2E and persistent POD/invoice integrations remain NOT VERIFIED.

