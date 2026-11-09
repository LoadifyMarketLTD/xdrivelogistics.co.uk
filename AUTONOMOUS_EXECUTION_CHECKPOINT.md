# WORKSPACE 3510 ÔÇö BN17 Customer Loads search regression (2026-11-08)

## User reproduction
Screenshot from Netlify PR #770 /customer/loads: entered 'bn17', radius 10 mile; zero results and warning 'Collection outcode could not be located'. Another screenshot of same real loads shows completed BN17 -> BN1 job in list. No records should be fabricated.

## Proven technical cause
Production `app/try-xdrive-demo/components/usePublicPickupRadius.ts` used `withinRadius()` to exclude EVERY job if entered centre coordinates unresolved (HTTP error / rate limiting / timeout). It did not special-case identical pickup outward postcodes. `DemoExchangeBoard.tsx` invokes radius before textual match, so BN17 self-matching jobs disappear. HTTP API independently verified 2026-11-08: /api/location/postcode-area?q=BN17 HTTP 200, lat 50.81513267, lng -0.53999216; BN1 and BL1 also valid. Thus data/BN17 validity not root cause; frontend filtering policy and excessive parallel requests are defects.

## Working tree
`D:\XDrive-3510-CustomerLoads-BN17-Fix-20261108`, branch `fix/3510-customer-loads-bn17-radius-20261108` branched cleanly from production main commit 067cb6a6. Other independent Quotes worktree untouched; original 3150 and PWA1099 untouched.

## Changes
- Exported `matchesPublicPickupRadius` pure helper: matching outward postcode always PASS regardless of API failure. Other postcodes still require real centroid calculation and radius; no privacy disclosure.
- Prioritised queried centre and reduced geocoding from ~30 concurrent calls to centre-first / batches of four; no fake coordinates.
- Updated user-facing failure warning to explain only nearby-radius lookup unavailable while exact matches still appear.
- Added regression unit cases for BN17 equal without coordinates, null lookup, geocoded match, nearby BN16, distant BL1.
- Added authenticated Playwright read-only scenario `e2e/customer3150-bn17-search-regression.spec.ts`: mock BN17 endpoint 503, input bn17, assert actual Completed BN17 -> BN1 card still visible.

## Verification
Scoped ESLint and four Vitest suites PASS 13/13 after initial changes. Full TypeScript verification started; results pending. Playwright login credential names already supplied in Desktop .env.test.txt; never expose values. No DB changes, no push/merge/deploy as of this checkpoint.

## Remaining
Finish final ESLint + TypeScript after batching change; build; commit; push PR; preview Netlify; authenticated E2E with induced 503 and normal BN17 search; controlled main merge; Netlify production; Opera screenshots and live E2E. Only declare PASS after all validated.

## Session 2026-11-09 - Driver Workspace full audit (OPEN)
Working tree E:\XDrive-Driver-PWA-Audit-20261109. Do not modify Post Load or revive retired PWA.
PASS: npm ci; npm run typecheck; 13 targeted Vitest tests; Playwright Chromium 10 passed, 8 authenticated tests skipped.
Full driver-filtered Vitest baseline failed: 34 failures (4 missing legacy-file suites, 30 test assertions), with numerous tests referencing retired app/driver-pwa-fresh routes or old redirect /driver rather than current /driver/jobs. Classify stale tests versus current defects; no blanket production changes to satisfy obsolete tests.
No source-code fixes, commits, pushes, deployments or live verification have been made in this session.
Next: inspect active app/driver routes, isolate actionable failures, test fixes and regression, verify authenticated workflows where possible. No deployment until validated.

## Test cleanup progress 10:42 UTC
vitest.config.ts now excludes ONLY two suites that assert removed page-0 demo/legacy routes: driverBookingPage0Acceptance and driverBookingStoryboardPage0. Kept tests for still-reused workflow modules, including legacy-named files imported by the canonical DriverJobExecutionPage; do not exclude them blindly.
New __tests__/driverCanonicalRoutes20261109.test.ts checks canonical Driver routes, absent retired pages, and live POD-before-invoice contract. Targeted 7/7 PASS (3 new, 4 existing). No source runtime changes. Remaining legacy assertions need migration; full suite NOT PASS. Do not deploy yet.

## Further cleanup 10:47 UTC
Excluded retired demo-only storyboard navigation chain (page-0 through page-11 visual-preview routes removed). Updated invoice-issued/payment-tracking contract by removing only assertion that obsolete individual visual-preview URLs exist; preserved three live invoice-state and payment-integrity assertions. Targeted 6/6 PASS. This is test-only; full suite remains unverified.

## Test cleanup continued 10:49 UTC
Migrated driverPwaBookingsCurrentContract.test.ts to canonical /driver/won-work and /driver/jobs, preserving pending offers, mandatory POD, invoice gating. Migrated driverQuoteHistoryVisibilityContract.test.ts to canonical /driver/quotes, preserving real bid identity, canonical quote stage and booking-offer verification. Targeted 8/8 PASS. Broad filtered regression PID 2996 running, log driver-cleanup-regression.log. Never mark full suite PASS without completion. No runtime changes or deployment.

## Driver regression result 10:54 UTC
Broad filtered npx vitest run driver --maxWorkers=2 finished exit 1: 131 suites passed, 19 failed (24 failed assertions plus suite-load errors). Still not PASS; remaining failures include legacy CSS/route expectations and potentially genuine operational contracts requiring triage. Updated driverPodDraftPersistenceContract.test.ts to canonical /driver/jobs/[id] route, retaining authenticated driver-only access, private RLS draft, signature save, idempotent final POD checks. Targeted 4/4 PASS. Full regression log driver-cleanup-regression.log is untracked evidence; do not commit log or claim success.

## 2026-11-09 11:12 UTC
Migrated stale officialDriverHomeRoute expectations to canonical /driver/jobs (role-access checks preserved) and Driver shell test to current DriverMasterLayoutGate (stylesheet check preserved): 6/6 PASS. Targeted ESLint PASS, TypeScript PASS, git diff --check PASS. Full driver regression JSON run PID 3056 still running at checkpoint; do not mark full PASS. No runtime edits. Do not push until regression triage.

## 2026-11-09 11:20 UTC - test cleanup
Regression JSON baseline: 302 suite results, 36 failed suite results, 24 failed assertions. Failure inventory includes current behavior contracts that MUST NOT be blindly excluded (compliance document retention, driver/company quoting scope, operational messages, GPS unknown distances). Updated approvedOwnerDriverAccess, driverStageNavigation and driverBookingStoryboardPage7 for canonical paths; 10 touched test suites / 46 tests PASS. Source runtime unchanged. Targeted ESLint and TypeScript previously PASS; final full regression still FAIL. Do not mark complete or deploy.
