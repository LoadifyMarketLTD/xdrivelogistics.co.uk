# WORKSPACE 3510 — BN17 Customer Loads search regression (2026-11-08)

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
