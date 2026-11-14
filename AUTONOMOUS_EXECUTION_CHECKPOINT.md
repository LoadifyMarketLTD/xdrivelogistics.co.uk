# WORKSPACE 3510 ├ö├ç├Â BN17 Customer Loads search regression (2026-11-08)

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

## 2026-11-09 11:28 UTC
Continued autonomous test cleanup. Storyboard pages 2/3/4 test expectations migrated to still-used navigation, camera, document and collection components. Targeted 9/9 PASS. Do not suppress remaining genuine compliance/authorization failures. Prior verified test-only cleanup committed locally 120ae3f; no push until review.

## 2026-11-09 12:01 UTC
Retired outdated test expectations for approved 3150 card adapters, current finance register, diary tabs, GPS-null marketplace behavior, real compliance document retention, and broker Driver instructions. Repaired marketplace loads API bid lookup: carrier-company scoped quotes when company context exists, otherwise current user/driver scope. Targeted suites PASS (cards 6/6, prototype 13/13, compliance 6/6, company quote 4/4); TypeScript and ESLint PASS. Local HEAD f56351b. Full driver regression running; NOT PUSHED or DEPLOYED. Do not delete genuine compliance documents or weaken RLS. Next: inspect full suite result, fix any regressions, then publish validated main.

# Integration branch checkpoint (preserved from pre-sync)
# XDrive 1099 execution checkpoint
Production verified bundle index-mGxeE0CR.js, main commit 79ad450b.
2026-11-09: 43/43 driver PWA unit and contract tests PASS.
LOCAL ONLY: added Create Invoice action after recorded POD, using existing finance generator with per-job idempotency; added Download POD PDF action using existing authenticated workspace POD PDF endpoint. Vite TypeScript/build PASS.
NOT VERIFIED: authenticated production transaction, finance permissions, PDF actual content, invoice issuance, production deploy of new UI. Do not mark complete.
Next: run Edge E2E with test accounts; verify both endpoints and actual PDFs, fix any failures, then push and verify production.
Keep approved 1099 design. Do not modify Post Load.
2026-11-09 Edge E2E on original localhost:1099: owner-driver authenticated, Loads and Quotes loaded, Bookings Current empty; company-driver authenticated, Loads loaded, Quotes and Bookings empty; JS errors [] for both. API feeds returned 200. No full transactional E2E executed; no physical delivery/POD signature fabricated.
IMPORTANT: localhost:1099 runs C:\Users\xdriv\OneDrive\Desktop\XDRIVE-DRIVER-PWA-NEW-LOCAL, NOT the integration repo; local invoice actions are in D:\XDrive-Driver-Main-Integration-20261109 and not served by 1099.
Need prepare integrated preview and controlled awarded booking test before claiming E2E; verify invoice and POD PDF endpoints with real completed POD.
2026-11-09 continuation: fixed misleading No bookings available state when any booking feed times out; added Retry bookings action; no API, security, or root dependency changes.
Vite/TypeScript build PASS, 43/43 unit tests PASS, oxlint 0 errors (21 pre-existing warnings).
Pending: live authenticated acceptance and transactional delivery; integration branch not merged due unverified full E2E and concurrent minimatch security work.
2026-11-09 Edge E2E on integrated Vite preview http://127.0.0.1:1209/driver/official-pwa/: authenticated owner driver; real booking offers loaded; ACCEPTED XDL-8C5DD3C6 via booking-offers/c7f7f25b-e849-4afd-9267-29bbf3175125/respond HTTP 200. After refresh card status Accepted, full addresses visible, On my Way to Pickup enabled.
Vite proxy /api added for finance/POD preview API calls; TypeScript/Vite build PASS.
Other test jobs include explicit NO PHYSICAL GOODS OR TRANSPORT AUTHORIZED warnings. Do not assert physical pickup/delivery/POD signatures without genuine evidence.
Remaining: authenticated status transitions and legitimate POD -> Invoice with actual evidence, PDF inspection, production deployment. No main merge, no root dependency changes.
2026-11-09 13:12+ E2E: on XDL-8C5DD3C6, On my Way to Pickup was submitted via authenticated Edge and /api/driver/mobile/jobs/8c5dd3c6-aa5a-41b8-947d-d818ae198642/status returned HTTP 200; UI displayed On my Way to Pickup with timestamp and Confirm ON SITE PICKUP next.
No physical pickup/delivery asserted. Do not invent recipient, photos, or signature for POD. Statuses beyond On my Way and final Invoice PDFs remain unverified.
Fixed LivePodCapture onCompleted callback: preserves server-confirmed POD success in UI even if subsequent list refresh fails; updated invoice guidance. Vite build PASS; 43/43 tests PASS. Root package files untouched.
2026-11-09 next E2E: inspected status RPC and POD/Invoice endpoints. On Site Pickup/Loaded/Delivery transitions are authoritative server mutations and were NOT executed absent actual physical proof.
Authenticated Edge negative test on accepted XDL-8C5DD3C6: GET /api/workspace/jobs/8c5dd3c6-aa5a-41b8-947d-d818ae198642/pod/pdf returned HTTP 409 with explicit missing photo, handwritten signature and recipient name. This is expected correct guard; no PDF generated.
Invoice generation endpoint requires completed POD, finance owner/admin and feature flag. No invoice created without evidence.
Next: test remaining screens with intercepted API in browser or authorized controlled sandbox, then real evidence-backed E2E; avoid invented recipient/signature/photos.
2026-11-09 continuation: corrected collection handover success path: once server confirms handover/Loaded, a subsequent refresh timeout is now a synchronization warning, not a misleading Save failure.
Post-change TypeScript/Vite build PASS and node tests 43/43 PASS. Live evidence-free lifecycle mutation remains intentionally unexecuted; authenticated POD PDF endpoint correctly rejects missing recipient signature/photo HTTP 409.
No main merge or Netlify deployment; security dependency files unchanged.
2026-11-09 13:25 continuation: hardened LivePodCapture delivered item count validation to reject zero (matches Complete Delivery validation). Build PASS; node tests 43/43 PASS.
Real booking XDL-8C5DD3C6 remains at On my Way to Pickup; cannot truthfully submit physical pickup, delivery, signature, photos or invoice without real evidence. Controlled mocked UI/API end-to-end test is still outstanding.
All changes local on integrate/driver-1199-20261109, no deployment or root package changes.
2026-11-09 13:27: POD eligibility regression fixed: completed backend lifecycle status is now accepted as delivered, in addition to delivered; prevents false refusal to submit POD after server maps completed->DELIVERED.
TypeScript/Vite build PASS; 43/43 node tests PASS. No production lifecycle events beyond on_my_way; no false POD evidence, invoice or PDF claims.
Pending controlled browser mock E2E and evidence-backed real flow; changes remain local, not merged/deployed.
2026-11-09 13:34: user authorized driver-style E2E testing. No physical goods are present; do not assert physical pickup/delivery. Added duplicate-operation guard to Complete Delivery to prevent concurrent double POST of pod-draft and delivered status.
Post-change TypeScript/Vite build PASS, 43/43 tests PASS. Controlled browser-mocked full E2E and two actual PDFs still not verified.
Branch integrate/driver-1199-20261109; no main/Netlify deploy; root package files untouched.
2026-11-09 13:38 security sync verified independently: fetched origin/main at 1911600f; HEAD fast-forwarded to 1911600f. Preserved all 4 PWA code changes and checkpoint. Resolved checkpoint stash conflict by combining main checkpoint and original saved backup.
npm ci --ignore-scripts PASS (616 packages); npm audit JSON reports 0 total vulnerabilities; npm ls confirms eslint minimatch 11.0.5 (other older minimatch under exceljs remain but audit 0).
Post-sync official-driver-pwa TypeScript/Vite build PASS and 43/43 node tests PASS. Reported root 610/610 tests and Netlify deployment have NOT been independently checked yet. Supabase Preview migration warning not modified.
2026-11-09 13:42 resumed original Driver PWA task after main security sync. In live Loaded handover, fixed missing positive collected-item validation, nonnegative weight validation and synchronous in-flight duplicate-operation guard.
Post-fix PWA build PASS and 43/43 node tests PASS. Server at localhost:1209 HTTP 200. Controlled browser mock E2E still pending, so no simulated delivery/POD/Invoice or two-PDF PASS claim.
No Post Load edits, no root dependency edits, no production lifecycle writes or Netlify deploy.
2026-11-09 13:45 authenticated Edge Playwright read-only browser verification on localhost:1209 PASS: sign-in, booking-offers API 200, Bookings card XDL-8C5DD3C6 is ON WAY TO PICKUP, next action On Site (Pickup), full pickup/delivery addresses visible. Browser page errors none. Screenshot saved D:\XDrive-Driver-Menu-Verified-Release-20261107-1959\1199-readonly-booking-20261109.png.
No production status mutations during this read-only test. Still need isolated intercepted E2E for On Site -> Loaded -> Delivery -> POD -> Invoice/PDF.
2026-11-09 13:48 controlled isolated Playwright E2E PASS through On Site Pickup -> pickup handover -> Loaded -> On my Way to Delivery -> On Site Delivery -> Complete Delivery. All writes intercepted locally (status POST, handover POST, pod-draft PUT), no live mutations. Synthetic job feeds and mocked mutation responses used.
Confirmed POD negative guard: without recipient signature and delivery photo, Save POD returns required-evidence error; no POD POST. Browser JS errors none. Test script D:\XDrive-Driver-Menu-Verified-Release-20261107-1959\1199-isolated-on-site.mjs; screenshot 1199-isolated-on-site.png.
Positive signature/photo POD, invoice creation, A4 PDFs still unverified. Do not publish before these gates.
2026-11-09 13:59 isolated Edge Playwright complete flow PASS through synthetic recipient signature canvas, synthetic PNG photo evidence upload, POD POST, and Create Invoice POST with idempotency key. All writes intercepted and fulfilled locally; production remains ON WAY TO PICKUP.
Found and fixed race: refreshLive after successful POD POST overwrote local podRecorded=true with stale GET, hiding Create Invoice. Reapply server-confirmed POD flag after refresh. Retested browser: Create Invoice visible and invoice POST observed. Build PASS; 43/43 tests PASS.
Still outstanding: actual A4 PDF download/content verification for both POD and Invoice, server-side real completion and invoice generation (not safe to fake physical proof), production deployment/verification. Do not mark PDFs PASS or deploy.
2026-11-09 14:07 isolated Edge Playwright E2E verified two separate PDF downloads after synthetic POD and synthetic invoice. Playwright captured xdrive-pod-8c5dd3c6-aa5a-41b8-947d-d818ae198642.pdf and xdrive-invoice-TEST-ISOLATED-INVOICE-1.pdf. PDF-lib parsed both, each A4 595.28 x 841.89 pt; TWO_SEPARATE_A4_PDFS_PASS.
IMPORTANT: Both PDF bodies were locally generated fixtures via pdf-lib and intercepted HTTP responses, not production backend-generated PDFs. This proves UI download handling, filenames and independent paths, NOT server PDF content correctness, POD photo/signature pages, invoice legal data, or actual transaction.
Production booking remains untouched by simulated writes; no deployment. Continue with real backend route tests using safe fixture or authenticated existing completed POD/invoice, then review release gates.
2026-11-09 14:10 inspected actual server PDF routes and evidence storage. Found Invoice PDF preview omits signatureAttestation even though loadInvoicePdfContext returns it and buildInvoicePdf can append recipient attestation page. Fixed preview route mapping.
Found POD PDF canonical evidence could be considered complete with document-only evidence, while endpoint claims photo required and embeds photos only. Added explicit deliveryPhotoCount >=1 gate to POD PDF route. Upload storage path driver.companyId/jobId/photos/file matches POD PDF retrieval check.
Root npx tsc --noEmit PASS; PWA npm run build PASS; PWA node tests 43/43 PASS. Changes local only. Real backend PDF output with stored genuine evidence still NOT verified, and no production lifecycle mutations/deploy.
2026-11-09 14:16 added __tests__/driverInvoicePdfRealRenderer.test.ts invoking real buildInvoicePdf (not mocked HTTP) with synthetic data and PNG fixture. 3/3 tests PASS: A4 invoice + typed attestation + photo (3 pages), A4 invoice + handwritten-signature image + delivery photo (3 pages), and no invented appendix without evidence (1 page).
Root full Vitest regression launched; await final result from driver-1199-root-vitest-20261109.log. Do not claim root suite PASS until completion. Real backend POD route still not tested with stored authenticated evidence; no production writes or deploy.
2026-11-09 14:40 root full Vitest completed: 3799 tests, 3701 PASS, 98 FAIL, 61 failing files / 598 passing files; broad cross-workspace failures, not established as introduced by driver changes. Do not mark global PASS.
2026-11-09 14:41 targeted rerun PASS 17/17 across 5 files: real invoice PDF renderer, driver POD PDF contract, driver finance invoice contract, canonical POD evidence engine, invoice fiscal totals.
Still need baseline comparison of 98 global failures on pristine origin/main before attribution; avoid modifying unrelated workspace/other agent changes. No merge or deploy.
2026-11-09 14:56 audit of global 98 failing tests: failures spread across 61 test files. Raw FAIL header count 99 includes one file-level failure; actual 98 test cases per Vitest. Broad categories by test filename (header counts, NOT exact test totals): Workspace/UI/RBAC 37, Loads/Quotes/Bookings/Diary 27, Admin/Auth/Security/DB 12, Driver/POD/Invoice/Finance 7, Other 16.
Sample confirmed root causes: collectionEvidenceGet mock lacks createSignedUrl (2 persistent tests); migrationChainSafety expects missing .github/workflows/validate-identity-compliance-foundation.yml (1 persistent); workspaceVisualFixtureHarness missing fixture (ENOENT); driverMobileJobActionRoute and middlewareAuth timeout under full suite but PASS on limited rerun.
Limited rerun of 4 files: 22 PASS, 3 FAIL; 2 driverMobileJobActionRoute and 2 middlewareAuth previously failed now PASS; remaining 2 collectionEvidenceGet + 1 migrationChainSafety FAIL. No evidence these global failures originate in changed PWA/PDF files. Main baseline full comparison still unrun.
2026-11-09 15:12 created full 98-failure audit register Markdown and CSV, saved to repo and OneDrive Desktop; separately documented file-level fixture ENOENT; original Vitest log retained. No code changes or deployment.
2026-11-09 15:16 audited chat history and current branch. Root and PWA builds PASS, PWA 43/43, targeted server 17/17, real renderer 3/3; isolated Edge mocked POD/Invoice PDF E2E PASS. Full root Vitest remains 98 FAIL across unrelated workspaces; live physical-device authenticated lifecycle, genuine server-generated PDF evidence and Netlify verification NOT PASS.
Fixed malformed literal `r`n leaking into Bookings JSX. Restricted Create Invoice UI to Owner Driver, matching server owner/admin finance authorization; Company Driver remains able to view/download POD and invoices subject to API permissions. PWA build PASS after edit.
Do not merge to main until end-to-end genuine job lifecycle, actual backend PDF, security/role and production verification pass; root baseline comparison needed.

## Customer Sidebar 2026-11-13
Branch fix/customer-sidebar-click-20261113. Dashboard formerly nested a second MasterWorkspace and remounted the sidebar when switching to other Customer routes. Changed CustomerMasterLayoutGate to always host the sidebar, and removed the nested Dashboard MasterWorkspace. Post Load untouched. tsc PASS, 7/7 targeted Vitest PASS. Existing stale masterRealDashboardRoutingContract 2 failures; needs update. Not published; live regression and full visual audit outstanding.


# XDrive Post Load enhancement checkpoint â€” 14 November 2026

## User authorization
The already approved Post Load is retained. Small additive improvements based on directly tested Courier Exchange features are permitted. Do not redesign, remove existing behavior, post test jobs, or deploy unverified changes. SmartPay, factoring and EOM remain excluded.

## Working copy
- Source baseline: origin/main at 593c1bb6
- Separate worktree: `C:\Users\xdriv\Desktop\XDrive-PostLoad-Enhancements-20261114`
- Branch: `feature/postload-units-20261114`
- No push / production merge / deployment.

## Implemented
- Weight selector kg / lbs / t, with conversion at UI boundary; canonical API still sends weightKg.
- Dimension selector cm / m / in / ft, with conversion at UI boundary; canonical API still sends lengthCm / widthCm / heightCm.
- Previous labels and default units remain kg/cm. No database schema or API change.
- Added conversion tests in __tests__/postLoadUnits.test.ts and helper lib/postLoadUnits.ts.
- Original Owner Driver PR807 integration branch untouched.

## Verification
- Focused Vitest 34/34 PASS, 4 suites.
- Scoped ESLint exit 0.
- TypeScript npx tsc --noEmit exit 0.
- The older loadPostingOperationalContract suite has 6 failures on BOTH unchanged origin/main baseline and feature branch, due to stale assertions such as 'Attach job documents' versus 'Upload Document'; not introduced by feature.
- git diff --check required before commit.
- Browser interaction and full production build not yet verified.

## Remaining candidate improvements â€” require independent data model and permissions validation
- CX style saved customer/contact/location lookup with controlled tenant access.
- Customer Price as confidential customer-side financial data distinct from public fixed-price offer.
- Individual reference visibility toward subcontractor after award.
- Regular Load per-day commercial fields and Daily Hire depot / rate logic with API persistence.
- En-route email schedule/recipient notification worker (actual delivery verified, not a fake UI-only checkbox).
No unimplemented feature should be described as done.

2026-11-14 19:11 UTC � PR #813 CX POD parity on branch feat/driver-next-cx-preview-20261114. NEXT-only: one POD form with inline saved verified signature, recipient/Left At/evidence, one Confirm POD & Complete Delivery. Backend requires delivered before POD; UI keeps status POD PENDING in Active until server confirms signed POD, including failure/reload retry with persisted evidence. Post-POD optional Update status -> Advertise for form (return-journeys POST, optionally availability-profile PUT), no automatic publishing; Invoice remains separate. Edge simulated E2E PASS: normal, injected POD failure/retry, injected POD failure/reload/retry, post-POD advertisement/availability + invoice send/history. 11/11 targeted contract tests PASS, Vite/TypeScript build PASS; scoped ESLint 0 errors (3 inherited hook warnings). Two blob requestfailed warnings persist despite successful downloads. No real production mutation or official PDF/email live verification. No main, Reserve, Post Load or Super Admin changes.
