# XDRIVE DRIVER PWA — MANDATORY MEASUREMENT & EXECUTION BLUEPRINT
Version 1.0 — 26 October 2026
Status: mandatory execution protocol; measurement baseline pending source-image calibration.

## 0. Source of truth and non-negotiable rule
Target: existing XDrive Driver PWA in LoadifyMarketLTD/xdrivelogistics.co.uk, not a separate app. Reference: Courier Exchange Driver Mobile audit from 24 October 2026, described as 19 screenshots. Preserve Jobs as common visual reference for Quotes and Bookings; do not conflate desktop CX measurements with Android CX measurements. Native Android, when in scope, is verified before PWA. No GitHub Actions. Verify locally with PowerShell, Playwright, real device and production after deployment.

The numeric values below are RECOVERED FROM PRIOR CHAT SUMMARIES, NOT RE-MEASURED FROM ORIGINAL PIXELS. They are not certified exact. No developer or agent may invent an exact card dimension or silently select a point inside a range. Calibration gate is required to freeze the measurement contract.

## 1. Measurement ledger — provisional values
| ID | Element | Recovered value | Source status | Freeze criterion |
|---|---|---|---|---|
| M01 | Reference image | 690 x 1536 image px | prior conversation | original image hash, screenshot scaling and CSS viewport verified |
| M02 | CX header | ~96 image px | estimate | original bounds + viewport conversion |
| M03 | content side margins | 14–20 image px | range | measured for each screen |
| M04 | CX buttons | 76–80 image px | range, unspecified axis | measure width and height separately |
| M05 | button spacing | 12–16 image px | range | measure gap by screen |
| M06 | card internal padding | 12–16 image px | range | measure four edges individually |
| M07 | card-to-card gap | 8–10 image px | range | measure each list |
| M08 | section gap | 16–24 image px | range | measure by section |
| M09 | divider | 1 image px | recovered | verify rendering/DPR |
| M10 | main heading | 20/700/26 (size/weight/line-height) | prior conversation | font family + CSS scale |
| M11 | secondary heading | 18/700/24 | prior conversation | verify |
| M12 | strong emphasis | 19/800/25 | prior conversation | verify |
| M13 | important text | 17/600/23 | prior conversation | verify |
| M14 | body | 16/600/22 | prior conversation | verify |
| M15 | highlighted text | 16/700/22 | prior conversation | verify |
| M16 | informative text | 14/500/20 | prior conversation | verify |
| M17 | badge | 12–13/700/17 | range | resolve per badge |
| M18 | auxiliary text | 15/500/22 | prior conversation | verify |
| M19 | proposed XDrive header | 56 CSS px | XDrive proposal, NOT CX measurement | verify target design |
| M20 | proposed XDrive bottom nav | 48 CSS px | XDrive proposal, NOT CX measurement | verify target design |
| M21 | proposed XDrive margin | 12 CSS px | XDrive proposal, NOT CX measurement | verify target design |

**Units:** image px must not be used as CSS px without determining image physical scaling, screenshot device pixel ratio, viewport and any crop/resize. Until then M01–M18 are provisional. An agent must not claim exact CX parity on the basis of these values alone.

## 2. Per-screenshot catalog schema — mandatory, 19 entries
For each CX reference image CX-01 through CX-19, create a record with: original filename, SHA-256, device/model, screenshot image W/H, browser CSS viewport W/H, devicePixelRatio, orientation, safe-area insets, screen name, state, scroll offset, image crop, measurement tool/method, date, reviewer, and calibration status.
For every visible component in each image record: stable ID; parent; x/y/width/height in image px; converted CSS x/y/width/height; margin top/right/bottom/left; padding top/right/bottom/left; gap; border thickness/radius; font family/size/weight/line-height/letter spacing; icon box; colors; text wrap and ellipsis; action; visibility and scroll behavior; allowed tolerance; source image region; test selector. No omitted or assumed fields: mark UNMEASURED, not zero.

## 3. Catalog of component classes and acceptance gates
### 3.1 Global shell
SHELL-01 viewport/safe areas; SHELL-02 top header; SHELL-03 page title; SHELL-04 scrollable content; SHELL-05 bottom nav (Jobs | Quotes | Bookings | More); SHELL-06 selected state; SHELL-07 loading/empty/error state; SHELL-08 keyboard and focus. Measure each using schema §2. Exactly one selected tab. Touch response immediate; navigation content correct; no persistent loader.

### 3.2 Jobs listing
JOB-01 list container; JOB-02 job card bounding box; JOB-03 card header/time posted; JOB-04 service/vehicle badges; JOB-05 pickup Town + Outcode; JOB-06 delivery Town + Outcode; JOB-07 collection slot (ASAP/At/By/Between); JOB-08 delivery slot; JOB-09 vehicle/body type; JOB-10 quantity/weight/packaging where present; JOB-11 payment terms <=30 days; JOB-12 notes/quick facts; JOB-13 divider; JOB-14 Quote Now action; JOB-15 View Details action; JOB-16 expanded/collapsed state; JOB-17 filtering; JOB-18 Collect within 15/30/45/60/90/120 minutes; JOB-19 no expired/sold jobs; JOB-20 map link only on details, no blank map reserve on failure. Each element needs its own x/y/w/h, padding, typography, gap, behavior and Playwright assertion. No Job Details button on list card.

### 3.3 Quotes
QUOTE-01 list and empty state; QUOTE-02 quote card frame; QUOTE-03 origin/destination; QUOTE-04 status badge; QUOTE-05 offered price; QUOTE-06 timing; QUOTE-07 references; QUOTE-08 Withdraw/Cancel; QUOTE-09 details and feedback. Reuse Jobs card geometry/tokens wherever common; differences must be explicit named exceptions. Verify a £160 quote example in isolated test data, not real production transactions.

### 3.4 Bookings
BOOK-01 booking card; BOOK-02 status; BOOK-03 route; BOOK-04 collection/delivery times; BOOK-05 contact; BOOK-06 reference; BOOK-07 primary action; BOOK-08 details navigation; BOOK-09 timeline; BOOK-10 Undo. Keep Jobs geometry for shared card patterns; preserve operational differences.

### 3.5 Booking Details / operational workflow
DETAIL-01 title/header; DETAIL-02 route and address; DETAIL-03 contact action; DETAIL-04 reference and notes; DETAIL-05 quantity/weight; DETAIL-06 ETA; DETAIL-07 status timeline; DETAIL-08 Accept; DETAIL-09 On My Way; DETAIL-10 On Site; DETAIL-11 Loaded; DETAIL-12 Delivery; DETAIL-13 Undo; DETAIL-14 proof photo; DETAIL-15 signature; DETAIL-16 POD documents; DETAIL-17 Send POD; DETAIL-18 map; DETAIL-19 error/permission/offline states. Every control has geometry plus event-state test. Never mock a production completion.

### 3.6 More and subpages
MORE-01 menu shell; MORE-02 menu row; MORE-03 Availability; MORE-04 Return Journeys; MORE-05 Documents; MORE-06 Profile; MORE-07 Settings; MORE-08 Owner Driver vs Company Driver visibility; MORE-09 nested navigation; MORE-10 forms/validation. Measure every subpage independently, with common tokens and named exceptions.

## 4. Ordered implementation instructions — no reinterpretation
01. Identify authoritative repo, main SHA, production deploy, active PWA routes and real device.
02. Locate all 19 original CX screenshots and existing audit/blueprint; preserve originals and calculate hashes.
03. Establish image-to-CSS conversion using actual viewport and DPR; do not equate image px and CSS px.
04. Fill CX-01..CX-19 measurement catalog; every component has a numeric value or UNMEASURED.
05. Resolve all UNMEASURED values needed for implementation by source inspection; never fill them by guessing.
06. Freeze versioned contract and tolerances per property. For intended exact CSS tokens use 0 px configuration drift; for rendered pixels document test tolerances explicitly.
07. Inventory actual components and map every catalog ID to a source file and test selector.
08. Introduce central CSS tokens for typography, spacing, sizing, border and states; isolate permitted screen-specific exceptions.
09. Implement global shell and validate before screen content.
10. Implement Jobs card-by-card, field-by-field; verify card screenshot and measured DOM geometry.
11. Implement Quotes with same shared card baseline; verify Withdraw/Cancel and state.
12. Implement Bookings and Booking Details, preserving complete timeline/Undo/POD workflow.
13. Implement More and every nested page, including role-specific options.
14. Implement error, validation, offline, loading, empty, and keyboard/safe-area states.
15. Add automated DOM metric assertions (getBoundingClientRect, computed style) per catalog ID; fail if absent or out of tolerance.
16. Add Playwright screenshot comparisons against APPROVED XDrive baselines at exact viewport/DPR; no automatic baseline updates.
17. Test every interactive target: immediate visible feedback, one active tab, correct content, no stuck loader; include regression checks.
18. Run local PowerShell TypeScript, ESLint, unit, Playwright E2E, production build and affected regression suites; no GitHub Actions.
19. Validate on physical target phone, including installed PWA and cache update. OPPO mandatory where required; record evidence.
20. Only after all gates pass, integrate into main per authorization, check Netlify production and repeat live mobile checks. Record exact SHA and deploy ID.
21. Final report only: completed/failed/unverified IDs, evidence paths, source SHA, deployed SHA. A skipped test is NOT PASS.

## 5. Enforcement
Store this blueprint in docs/XDRIVE_DRIVER_PWA_MANDATORY_BLUEPRINT.md; place a binding reference in root AGENTS.md. Store frozen machine-readable measurements in driver-ui-contract.json, versioned CSS tokens in the actual app styles location, and tests in the project's existing Playwright structure. Local pre-merge verification must exit nonzero if any required ID is missing, a metric differs, an unapproved token appears, or a screenshot/test fails. Baseline changes require explicit contract revision with source measurement evidence. Do not hide or soften failures. If access to originals is unavailable, stop only the affected calibration/implementation, record precise blocker, and continue independent verified work.

## 6. Evidence / honesty
The current document is an executable specification framework, not proof of completed source-image measurement, code implementation, or production deployment. Exact per-card coordinates cannot be truthfully populated without original screenshots and viewport metadata. No false precision.
