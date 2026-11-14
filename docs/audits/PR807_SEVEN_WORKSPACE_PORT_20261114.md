# PR #807 -> seven historical XDrive workspaces (14 November 2026)

## Source and scope
- Historical approved workspace source: merged PR #757 (head 8ed8a684) and original 31 October role snapshots; do not wholesale revert to historical data/API.
- UI source: draft PR #807 at a4315231, plus Owner Driver selective local commits in branch integration/owner-driver-selective-20261114.
- Current production main at the local integration baseline: 593c1bb6 (after official legal PDF updates).
- Existing approved production Post Load is absolutely frozen. Driver PWA remains unchanged.
- No merge into main, no production push, no deployment.

## Implemented locally (partial migration, not fully ready)
1. Added opt-in presentation='xdrive807' to Master3150Card; original presentation='approved3150' retained.
2. Existing CxLoadCard, CxQuoteCard, CxDiaryCard use the new structured route/schedule/transport information layout through XDriveTransportOverview, with original footer handlers passed through. Existing data queries, server access, quote/award, POD and invoice functionality NOT replaced.
3. Historical XDriveLoadCard used by DemoExchangeBoard, DemoCompanyBookings, DemoBookingOverview, DemoQuotes uses same 807 structure. Original View Details, role action controls and extra data retained.
4. New shared styles are scoped to .xdrive-role-807-card. No Post Load page, API or component modified.
5. Earlier local Owner Driver selective commits bring settings, event-log, Action Centre, messages, My Jobs and finance presentation (see checkpoint).

## Coverage, pending per-role workflow validation
| Workspace | Shared card path | Additional unsolved modules |
|---|---|---|
| Customer | CxLoad/Quote/Diary + DemoExchangeBoard (productionMode) | Dashboard, invoices, tracking, signed POD, live award E2E |
| Broker | CxLoad/Quote/Diary + legacy Master preview board | Quotes & award/dispatch, finance, customer invoicing E2E |
| Company / Carrier | Historical XDriveLoadCard through Master preview; authenticated Company uses distinct boards | Authenticated operational Company Quotes/Bookings, Drivers/Fleet, permission checks |
| Fleet Manager | Historical XDriveLoadCard via original preview | Authenticated fleet assignments and team views |
| Dispatcher | Historical XDriveLoadCard via original preview | Real dispatch planning and allocation workflows |
| Owner Driver | CxLoad/Quote/Diary and selectively migrated owner screens | Remaining Loads/Quotes/Diary page-specific UX and full E2E |
| Company Driver | Shared driver cards + historical preview | Company-specific restrictions and authenticated E2E |

## Verification
- TypeScript tsc --noEmit PASS after migration.
- Scoped ESLint PASS.
- Shared CSS PostCSS parse PASS.
- New static seven-role and protected-surface contract 12/12 PASS.
- git diff --check PASS.
- Prior Owner-only safety guard now has one expected scope rejection ('Only approved Owner settings and styles') because work expanded to other roles. Other guard checks PASS. It is not an E2E test.
- Playwright Edge local preview: cold dev compilation initially returned empty client content with an intermittent JavaScript error. Re-test after Next compilation: 18/18 desktop/mobile preview page loads visible, HTTP 200, no pageerrors/overflow. Seven original preview Loads navigation interactions 7/7 PASS. No transport cards populated with real data, so card action parity and authenticated E2E NOT VERIFIED.
- Full authenticated E2E, RLS/tenant, functional write flows, mobile device, and visual comparison NOT VERIFIED.
- Full production build: pending at time of writing.

## Release gate
NO-GO for main. The 807 PR itself is draft/unmergeable and is not a safe source branch to merge wholesale. Only select reviewed components, retain role correctness, preserve approved main API and PDFs.
