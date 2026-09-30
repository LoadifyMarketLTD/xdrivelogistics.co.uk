# XDrive Workspace recovery and Carrier visual checkpoint

> UPDATE: the eight Dashboard failures recorded below are historical and are now closed. The strengthened full unit suite passes 2455/2455. Read `docs/checkpoints/XDRIVE_CARRIER_DASHBOARD_REGRESSION_CLOSURE_2026-09-30.md` for the current recovery status and preview gate evidence. The earlier run is preserved below for traceability.

Date: 30 September 2026. This document supersedes the earlier recovery-only checkpoint.

## Canonical source and boundaries

- Working copy: `C:\Users\Danny\Desktop\XDrive-Local\worktree\xdrivelogistics.co.uk`.
- Branch: `feat/carrier-visual-convergence-20260930`; verified HEAD `777e33288a03d5ce5378b3a3d6693182171453fe`.
- Follow `docs/benchmarks/XDRIVE_CARRIER_VISUAL_CONSISTENCY_IMPLEMENTATION_BLUEPRINT_2026-09-30.md` and the real reference files under `C:\Users\Danny\OneDrive\Imagini\CX IMAGE`.
- Do not touch PR #607, Super Admin, XDrive Native Android or Loadify Market.
- No commit, push, merge, deployment, real legal acceptance, billing transaction or production-data mutation was performed in this continuation.

## Recovery implemented

1. Post Load legal 409 has an allowlisted, role-scoped remediation CTA. Owner Driver stays under `/driver`. A counterparty gate without a setup URL cannot offer self-acceptance. Submitted form values remain on the error screen; accepting agreements and returning to publish is not claimed as production-tested.
2. Company Finance Settings, Finance & Invoices and Membership & Billing are separate destinations. Owner Driver can reach Company Finance Settings without the hidden side rail. Company Driver keeps personal Settings, not company-finance or subscription powers.
3. Scoped Billing uses the active company instead of the first membership. Failed or malformed status responses expose no checkout. Personal accounts without company memberships remain supported. Legacy Stripe returns restore the authorised workspace and query parameters.
4. Support is implemented inside each operational workspace, with inline topics, canonical contact links, scoped compliance/update links and a permission-appropriate return action. Actual route guards now recognise Support and scoped Billing.

## Carrier sequence

- Dashboard: inherited committed implementation; not rewritten here. Its remaining regression failures are listed below.
- Directory: production component now follows the four-column 60px record plus 32px action footer, 220px rail, scoped styles and six-width responsive contract. Filtering, Details, Clear, nearest lookup, pagination, Messages and company-targeted Book Direct were exercised with mocked services. The 1280px legacy action-cell overlap was found visually and fixed.
- Live Availability: existing data/query/filter logic retained, with canonical Live Fleet / Future / Nearby Exchange tabs, six data-quality-aware signals, compact filters and the shared 326px map/register split. Unknown Exchange payload/pallet capacity no longer becomes zero. Actual basemap loading was checked separately from layout.
- Next page in order: **My Fleet** (`/admin/fleet`). Read its blueprint section and CX Screenshot (43).png before editing. Its duplicate Connected workspace panel and seven-signal layout have been identified, but not changed in this continuation.
- Remaining: Return Journeys, Loads, Quotes, Diary, Freight Vision, Drivers & Vehicles, Settings visual pass. Do not describe the entire navbar as completed.

## Verification evidence and scope

Evidence root: `C:\Users\Danny\Desktop\XDrive-Local\workspace-remediation-evidence-20260930`.

- Recovery browser coverage: 23 passed in `recovery-directory-final.log` (that combined run had one separate Directory geometry failure; Directory was subsequently rerun and passed).
- Directory final browser gate: 10/10 passed in `directory-verified.log`, including 1920 / 1440 / 1280 / 1024 / 768 / 390.
- Live initial gate: 8/9 passed; only the Return Journeys test selector was ambiguous between the navbar and page action. Follow-up 3/3 passed in `live-map-check.log`, covering the corrected selector, unavailable-data truth, and real basemap tiles. A final combined browser rerun is recorded separately below.
- Expanded targeted unit tests: 145/145 passed in `targeted-verified.json`. Directory/recovery contract batch: 47/47 passed in `directory-unit.json`.
- Frozen-source TypeScript and ESLint: exit 0, recorded in `snapshot-gates.json` and corresponding logs.
- Frozen-source full unit suite: **2437 passed / 8 failed / 2445 total**, in `snapshot-unit.json`. Therefore the repository is NOT all-PASS or ready to merge solely on this evidence.

The eight remaining failures concern the inherited Carrier Dashboard, not a completed full-platform release:
- `cxWorkspaceAccessibilityConvergenceContract.test.ts`: semantic dashboard tabs.
- `dashboardConnectedWorkspaceContract.test.ts`: connected-workspace navigation contract.
- `pr357VisualBaselineGuard.test.ts`: earlier Carrier/Admin control-surface contract.
- `workspaceDashboardAvailabilityRendering.test.tsx`: two degraded/partial-data presentation assertions, including finance. These must be investigated, not dismissed as cosmetic test updates.
- `workspacePrimitiveAdoptionMatrix.test.ts`: three shared-primitive / principal-table / control-desk assertions.

Browser fixtures render real components but mock authentication and service responses, and capture navigation rather than executing real commercial writes. They are NOT production-authenticated E2E, a real Stripe checkout, or proof that every destination page completed its business workflow. Basemap tile loading uses the actual public map provider.

## Concurrent changes and reproducibility

Another session added workspace-readiness banner/API and quote/onboarding recovery changes while this working copy was being used. Those changes were preserved. Do not bulk-reset or bulk-stage the dirty tree, and do not attribute the entire tree to this continuation.

A test-only frozen copy lives at `verification-snapshot` under the evidence root. It is not a replacement canonical repo. Its `VERIFICATION_SOURCE_MANIFEST.json` records 2133 source files and SHA-256 values. Integrity verification at 2026-09-30T19:16:06Z found zero snapshot mismatches and zero canonical-source drift; this checkpoint document was updated afterward. Environment secrets were not copied; runtime checks use placeholder Supabase configuration, not production credentials.

## Continuation instructions

1. Read this checkpoint, the blueprint, current `git status --short --branch` and the actual diffs before editing. Current changes are uncommitted; do not assume any other agent's work is safe or superseded.
2. Use the evidence files, not a remembered PASS. `snapshot-integrity-and-failures.json` contains the exact remaining tests and integrity result. `snapshot-gates.json` records compilation gates; `snapshot-browser-gate.json` records the final browser run when completed.
3. Final browser verification uses an isolated server on `127.0.0.1:3044` with `reuseExistingServer: false`, via `playwright.snapshot.config.mjs` under the evidence root. Do not reuse an unrelated server on port 3000 as proof of this source version.
4. The Company Driver Settings query handling already restricts company, operations, blocked and finance sections by role/capability. `saveCompany` additionally checks membership authority; a hidden button alone is not the access boundary.
5. Start My Fleet with blueprint section 21.4: remove its duplicate Connected workspace panel, use exactly Unallocated / Allocated / Active Jobs / Available Drivers / Tracking Alerts / Compliance, then Resource Register and Fleet Attention. Retain real data-quality states, server permissions and operational actions. Audit the currently separate allocation table before removing or relocating it; do not silently lose its workflow.
6. Continue the remaining navbar in order. Keep geometry corrections scoped to Carrier unless a shared component change has an explicit cross-role regression test.
7. Do not merge while the eight inherited Dashboard failures remain unexplained or unresolved. Inspect the two financial/degraded-data failures before deciding that any assertion is merely an obsolete visual contract.

## Frozen-source build result

Completed 30 September 2026 around 20:21 BST: `snapshot-gates.json` records `typecheck: 0`, `lint: 0`, `build: 0`, `unit: 1`. The optimized production-mode build completed; the unit gate remains red for the eight Dashboard assertions above. Build warnings include the missing Next ESLint plugin configuration and intentionally absent service-role credentials in this isolated test environment. This is not a deployment or verification of production Supabase/Stripe configuration.

## Final combined browser result

**44/44 Chromium tests passed**, zero retries, on the frozen source through the dedicated non-reused local server: 23 recovery tests + 10 Directory tests + 11 Live Availability tests. See `snapshot-browser.log` and `snapshot-browser-gate.json`; the run took 5.4 minutes. This supersedes the earlier split browser runs and selector/1280px failures described above.

Final screenshots were visually inspected, including Live Availability at 1440px and 390px with loaded map tiles, and the Directory driver register at 390px. The six-width tests assert no page-level horizontal overflow; wide operational tables remain scrollable inside their own panels.

`final-source-integrity.json` verified at 2026-09-30T19:26:30Z: same HEAD, no snapshot-file mismatches, no canonical application-code drift. Only this checkpoint document differed after its update. The working tree remains uncommitted. The full unit suite still has the eight Dashboard failures; no main/production readiness claim follows from the 44 browser passes.
