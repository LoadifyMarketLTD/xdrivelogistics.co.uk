# XDrive Carrier Visual Consistency - Implementation Blueprint

Date: 2026-09-30
Scope: Carrier workspace only. Do not change Customer, Broker, Driver, Super Admin, Finance, Compliance or Dispatcher visual systems in this pass.

## 0. Pre-implementation repository hygiene gate

Before any Carrier visual implementation begins, close the already-audited runtime/reference cleanup as a separate repository change. Do not mix this cleanup with Carrier UI commits.

Verified cleanup value:
- move Courier Exchange reference screenshots from `public/reference/courier-exchange/**` to `docs/reference/courier-exchange/**` so development references are not shipped as public runtime assets;
- update all code/documentation references to the new `docs/reference/courier-exchange/**` location;
- remove unused legacy driver CSS files `app/driver/driver-dashboard-layout.css` and `app/driver/driver-quote-modal.css` after confirming there are no active references;
- remove unused legacy public images, including the old ChatGPT-generated assets and `public/uk-satellite-map.png`, after confirming there are no active references;
- keep the `JobsOperationalTable.tsx` change that only updates the CX reference path;
- preserve all functional code and business logic.

Verified evidence for this cleanup candidate:
- 391/391 Vitest files PASS;
- 2376/2376 tests PASS;
- production build PASS;
- approximately 16.67 MB of unused image assets removed from runtime/public paths.

Required sequence:
1. commit and push the cleanup independently, using a dedicated cleanup commit;
2. confirm `main` and local working tree are clean;
3. start Carrier visual convergence from that clean `main`;
4. do not reintroduce CX reference screenshots into `public/` during Carrier work.

Recommended cleanup commit intent:
`chore: remove unused runtime assets and relocate CX references`

## 1. Objective

Make every Carrier surface feel like one operational product without flattening role-specific functionality.

Carrier anchor:
- `/admin` - Carrier Control Desk

Carrier surfaces covered:
- `/admin` - Carrier Control Desk
- `/admin/marketplace/directory` - Directory
- `/admin/live-availability` - Live Availability
- `/admin/fleet` - My Fleet
- `/admin/fleet/returns` - Return Journeys
- `/admin/marketplace` - Loads
- `/admin/exchange-quotes` - Quotes
- `/admin/diary` - Diary
- `/admin/freight-vision` - Freight Vision
- `/admin/fleet/resources` - Drivers & Vehicles
- Carrier Settings stays on the canonical shell but is not redesigned in this pass.

Do not touch PR #607 or Super Admin.

## 2. Current-state diagnosis from screenshots + repo

### 2.1 Shell is already canonical
Carrier primary navigation is composed in:
- `app/components/workspace/TopWorkspaceShell.tsx`

The Carrier primary order is already correct:
Dashboard, Directory, Live Availability, My Fleet, Return Journeys, Loads, Quotes, Diary, Freight Vision, Drivers & Vehicles, Settings, More.

Do not create another navbar or page-specific shell.

### 2.2 Two competing page systems exist

#### Family A - current shared WorkspaceUI
Used heavily by:
- Carrier Control Desk
- Freight Vision
- Live Availability
- Drivers & Vehicles

Core primitives:
- `PageFrame`
- `PageHeader`
- `OperationalToolbar`
- `OperationalSignalStrip`
- `Panel`
- `OperationalCard`
- `DataTable`
- `EmptyState`
- `TwoColumn`
- `OperationalPageLayout`
- `OperationalFilters`

Source:
- `app/components/workspace/WorkspaceUI.tsx`
- `app/components/workspace/WorkspaceUI.module.css`

#### Family B - measured/legacy operational classes
Used heavily by:
- Diary
- Loads / Quotes
- Return Journeys
- Directory

Examples:
- `workspace-board-layout`
- `workspace-filter-rail`
- `workspace-tab-strip`
- `workspace-panel`
- `workspace-operational-row`
- `workspace-record-meta`

Source:
- `app/components/workspace/workspace-measured-cx-baseline.css`

This split is the main reason screenshots feel related but not fully consistent.

## 3. Canonical Carrier visual system

Use Carrier Control Desk as the anchor, but converge it toward reusable primitives rather than copying page-specific JSX.

### 3.1 Page geometry

Desktop:
- page padding: 12px horizontal, 12px top, 16px bottom
- panel gap: 8-12px
- border radius: 4px
- borders: #D8DEE8
- no drop shadows
- page background: #F4F6F8
- surfaces: #FFFFFF

Typography:
- eyebrow: 11px / 16px / 700 / uppercase / blue
- H1: 20px / 26px / 600
- panel title: 13-14px / 18px / 600-650
- body: 12px / 16px
- metadata: 11px / 14-15px
- table headers / filter labels: 11px / 14px / 650

Controls:
- normal action height: 32px
- micro actions: 28-30px
- radius: 4px
- primary blue, success green, secondary white

### 3.2 Header contract

Every Carrier page must use one header anatomy:
1. eyebrow
2. H1
3. one-line description
4. optional meta line
5. action cluster at top-right

Canonical implementation:
- use `PageHeader`
- deprecate duplicate page-local title/header structures

Dashboard:
- replace or align `DashboardHomeHeader` with `PageHeader` tokens so both render the same geometry.
- badge is allowed only on Dashboard where it adds live context.

### 3.3 Signal/KPI strip contract

Canonical:
- max 6 equal-width operational signals on desktop
- compact 54-72px range
- top/left semantic accent only
- label 11px
- value 20-22px
- optional 11px detail
- responsive 6 -> 3 -> 2 columns

Unify:
- `CarrierControlSignals`
- `OperationalSignalStrip`
- `KpiCard / ExchangeKpiStrip`

Implementation target:
create one shared `CarrierSignalStrip` adapter in WorkspaceUI/OperationalConvergence and migrate Carrier dashboard to it.

### 3.4 Filter rail contract

Pages with a search rail:
- Dashboard
- Loads
- Quotes
- Diary
- Return Journeys
- Directory

Canonical width:
- 220-230px desktop
- sticky below header/navbar
- full-width below 1024px

Canonical component:
- `OperationalFilters`
- `OperationalFilterField`
- `OperationalFilterInput`
- `OperationalFilterSelect`

Migrate all remaining `workspace-filter-rail` implementations to these components.

Do not keep separate filter visual markup per page.

### 3.5 Panel contract

Canonical panel:
- `OperationalCard` for strict dense operational sections
- `Panel` allowed only until migrated
- header background #F4F6F8
- 1px border
- body padding 10-12px
- no oversized empty bodies

Migration goal:
Carrier pages use `OperationalCard` for:
- filters
- registers
- maps
- workflow sections
- secondary summaries

### 3.6 Register/table contract

Use one of two patterns only:

A. Table register
- `DataTable`
- for Drivers & Vehicles, Live Availability, Freight Vision and dense registers

B. Operational record rows
- reusable `OperationalRecordList` extracted from measured classes
- for Loads, Quotes, Diary, Return Journeys, Directory only where card-like rows are genuinely more readable than tables

Do not mix raw HTML tables, DataTable and ad-hoc article rows on the same conceptual surface.

### 3.7 Empty state contract

Remove the current visual placeholder feeling.

All Carrier empty states:
- compact by default
- no large decorative X badge
- title + optional explanation
- optional contextual action
- target min-height: 52-80px
- never fill half the viewport without data

Use `EmptyState compact` for list/register empties.
Use standard `EmptyState` only for maps or primary surfaces that need more space.

## 4. Shared implementation changes first

Before page-by-page polish, make the primitives capable of supporting every Carrier surface.

### 4.1 WorkspaceUI.tsx

Add / standardise:
- `CarrierPageHeader` wrapper around PageHeader or bring DashboardHomeHeader onto identical tokens
- `CarrierSignalStrip`
- `OperationalTabStrip`
- `OperationalViewToggle`
- `OperationalRegisterHeader`
- `OperationalEmptyState` wrapper with compact/map variants
- `OperationalRecordList`
- `OperationalRecordRow`
- `OperationalActionGroup`

Do not duplicate new primitives in page files.

### 4.2 WorkspaceUI.module.css

Create shared classes for:
- carrier page rhythm
- signal strip
- filter rail
- tab strip
- register toolbar
- map/register split
- operational rows
- compact empty state
- actions
- responsive breakpoints

Remove page-specific inline geometry after migration.

### 4.3 workspace-measured-cx-baseline.css

Keep this file as measurement/reference and compatibility layer during migration.

Do not delete it before:
- all Carrier pages have moved to shared primitives
- Visual Fixture Gate is green
- no Carrier page depends on legacy classes

After Carrier convergence, reduce Carrier-specific dependence on this file.

## 5. Page-by-page implementation plan

### Phase A - establish the anchor

#### 5.1 Carrier Control Desk
Files:
- `app/components/workspace/CarrierOperationsDashboardHome.tsx`
- `app/components/workspace/DashboardHomePrimitives.tsx`

Keep:
- operational toolbar
- six control signals
- left Control Filters
- operational workboard
- Commercial Position
- Activity at a Glance
- Carrier Workflow
- Reports & Finance

Change:
- migrate page wrapper to `PageFrame`
- align header with canonical PageHeader geometry
- migrate CarrierControlSignals to shared CarrierSignalStrip
- replace inline RailMetric / WorkflowLink / CommercialRow geometry with shared compact list primitives where possible
- reduce repeated inline styles
- preserve all routes, counts and business logic

Acceptance:
- dashboard screenshot remains recognisably the same information architecture
- no page-level horizontal overflow
- no duplicated navbar actions
- no data/logic change

### Phase B - converge the strongest existing pages

#### 5.2 My Fleet
Main implementation:
- Fleet dashboard component resolved by `AdminRoleDashboardHome` / fleet surfaces

Goal:
- same header rhythm as Carrier Control Desk
- same 6-signal strip geometry
- same register header/action alignment
- same status badge language
- same panel background/borders

Keep:
- Connected workspace
- resource register
- fleet attention
- Allocate Jobs
- Refresh

Remove:
- unnecessary duplicated navigation if already in top navbar

#### 5.3 Drivers & Vehicles
File:
- `app/admin/fleet/resources/page.tsx`

Already uses modern primitives.

Change:
- standardise header/meta placement
- use the same signal-strip component as Dashboard
- convert Resource filters to canonical filter/register pattern
- use one register toolbar style
- align Company Vehicles and Fleet Resource Register tables
- make warning badges use consistent semantic tones
- ensure action buttons use shared action group

#### 5.4 Live Availability
File:
- `app/admin/live-availability/page.tsx`

Change:
- same header/meta rhythm
- same signal strip
- standardise filter panel height/padding
- standard map/register two-column frame
- compact empty map state
- remove decorative X appearance from empty state
- ensure register never produces awkward horizontal scroll at desktop width

#### 5.5 Freight Vision
File:
- `app/admin/freight-vision/page.tsx`

Change:
- same header/meta rhythm
- same signal strip
- same filter-panel anatomy
- standard map/register split used by Live Availability
- same compact empty-state treatment
- timeline panel follows same register pattern

Result:
Live Availability and Freight Vision should look like sibling modules.

## 6. Board/register migration

### 6.1 Loads
Files:
- `app/admin/marketplace/page.tsx`
- `app/components/workspace/CompanyMarketplaceExchange.tsx`

Current issue:
custom Panel + custom fields + raw inline layout.

Migrate:
- outer page remains PageFrame/PageHeader
- left rail -> OperationalFilters
- Available Loads / Won Work -> OperationalTabStrip
- All Live / On Demand / Regular Load / Daily Hire -> secondary compact tab strip
- results area -> OperationalRegisterHeader + OperationalRecordList
- List / Map -> OperationalViewToggle
- pagination -> shared register footer
- quote modal remains functionally unchanged

Do not merge Customer Quotes into this page.

### 6.2 Quotes
Files:
- `app/admin/exchange-quotes/page.tsx`
- `app/components/workspace/CompanyMarketplaceExchange.tsx`

Use the same composition as Loads:
- same left rail width
- same tab strip
- same empty state
- same register body
- same top controls

Quotes must visually be the same module family as Loads, not a separate design.

### 6.3 Diary
Files:
- `app/admin/diary/page.tsx`
- `app/components/workspace/OperationsDiaryPage.tsx`

Current issue:
legacy measured layout with large blank register area.

Migrate:
- PageFrame + PageHeader
- OperationalFilters left rail
- shared register toolbar for List / Split View, page size, pagination, refresh
- status tabs -> OperationalTabStrip
- empty state compact, no large blank workspace
- booking rows -> OperationalRecordList
- preserve Saved Views, Groups, booking scope, payment report and filtering behaviour

### 6.4 Return Journeys
File:
- `app/admin/fleet/returns/page.tsx`

Current issue:
hybrid PageFrame/PageHeader plus legacy board classes.

Migrate:
- filter rail -> OperationalFilters
- Active / All / Closed -> OperationalTabStrip
- List / Map -> OperationalViewToggle
- editor -> OperationalCard
- map -> same map panel as Live Availability/Freight Vision
- list rows -> OperationalRecordList
- standard empty state
- preserve all publish/edit/close/call/route actions

## 7. Directory migration

Files:
- `app/admin/marketplace/directory/page.tsx`
- `app/components/workspace/MemberDirectoryPage.tsx`

Critical issue:
Directory currently contains multiple visual modes / legacy structures and can effectively create a second heading hierarchy inside the page.

Carrier wrapper already provides:
- PageFrame
- PageHeader

Therefore:
- MemberDirectoryPage in Carrier context must not render another H1/hero that duplicates Directory
- use one canonical left filter rail
- Companies / Drivers -> OperationalTabStrip
- results metadata -> OperationalRegisterHeader
- results -> either DataTable or OperationalRecordList, not both modes for the same Carrier surface
- action cluster: Profile / Message / Book Direct
- reliability fields retain truth-derived wording

Recommended Carrier implementation:
use operational rows on desktop because member identity, location, capability, reliability and actions need grouped reading more than a dense table.

## 8. Exact component ownership after migration

`TopWorkspaceShell.tsx`
- global Carrier header/nav/actions only
- no page-specific layout responsibilities

`WorkspaceUI.tsx`
- all generic operational primitives

`OperationalConvergence.tsx`
- signal strips and convergence-specific operational pieces

`CarrierOperationsDashboardHome.tsx`
- Carrier dashboard business composition only

`CompanyMarketplaceExchange.tsx`
- Loads/Quotes data and feature logic only; no unique design system

`OperationsDiaryPage.tsx`
- diary business logic only; shared visuals

`MemberDirectoryPage.tsx`
- member/network logic only; shared visuals

Page files under `app/admin/**/page.tsx`
- route protection and top-level composition only

## 9. Visual order of implementation

Do not redesign all pages simultaneously.

Implementation sequence:
1. Shared Carrier primitives
2. Carrier Control Desk
3. My Fleet
4. Drivers & Vehicles
5. Live Availability
6. Freight Vision
7. Loads
8. Quotes
9. Diary
10. Return Journeys
11. Directory
12. Carrier visual regression pass

Reason:
- first five establish the operational language
- Loads/Quotes/Diary/Returns reuse the new register/filter primitives
- Directory comes last because it has the most distinct information model

## 10. Functional non-regression rules

Visual work must not change:
- role/capability gates
- Supabase queries
- RLS
- Stripe/legal posting gates
- quote eligibility
- award logic
- job lifecycle
- invoice truth
- tracking privacy rules
- return journey ownership
- member reliability calculations
- Company Driver publishing restrictions

No fake metrics.
No placeholder rows.
No visual state that implies data exists when the API says unavailable/partial.

## 11. Responsive contract

Desktop >= 1240:
- horizontal top nav
- rail + main where applicable
- 6 signal tiles max
- map/register side-by-side where useful

Tablet 769-1239:
- signal strip 3 columns where needed
- rail may stack above main
- actions wrap predictably

Mobile <= 768:
- one-column content
- filter rail becomes normal panel
- tables use controlled horizontal scrolling only when unavoidable
- operational rows collapse to one column
- top shell remains usable

## 12. Accessibility contract

- one H1 per page
- tab strips use tablist semantics where appropriate
- view toggles use aria-pressed
- clickable KPI/signal cards use buttons
- filter labels are associated with controls
- empty-state actions are keyboard reachable
- active nav state remains visible
- colour is not the only status indicator

## 13. Carrier acceptance matrix

Every page must pass:
- canonical TopWorkspaceShell
- canonical PageHeader geometry
- no duplicate page hero/H1
- shared action button geometry
- shared panel border/radius/background
- shared tabs
- shared filter rail where applicable
- compact empty states
- no decorative X placeholder
- no unexplained dead space
- no page-level horizontal overflow at 1920, 1440, 1280
- responsive at 1024 and 768
- no business logic change

## 14. Test / gate plan

Existing:
- `__tests__/carrierDashboardContract.test.ts`
- Visual Fixture Gate
- TypeScript
- ESLint
- production build
- local Semgrep SAST

Add:
- `__tests__/carrierVisualConsistencyContract.test.ts`

Contract assertions should verify:
- all target Carrier pages use PageFrame/PageHeader or approved Carrier wrappers
- no target Carrier page introduces a custom top navbar
- no legacy giant empty-state geometry
- Directory does not duplicate H1 inside Carrier wrapper
- Loads, Quotes, Diary, Returns use shared filter rail components after migration
- Live Availability and Freight Vision use same map/register split primitive
- Carrier primary nav order remains unchanged
- Settings stays directly visible
- More retains secondary destinations

Visual fixture matrix:
- Carrier Dashboard
- Directory
- Live Availability
- My Fleet
- Return Journeys
- Loads
- Quotes
- Diary
- Freight Vision
- Drivers & Vehicles

Capture at:
- 1920x1080
- 1440x900
- 1024 tablet
- 390 mobile

## 15. Definition of done

Carrier is complete only when:
1. all ten screenshots look like one workspace family;
2. TopWorkspaceShell is the only global Carrier shell;
3. shared WorkspaceUI primitives own page geometry;
4. no Carrier page has an independent visual system;
5. empty states are compact and intentional;
6. filters/registers/maps are consistent;
7. visual fixture matrix passes;
8. Carrier contract tests pass;
9. TypeScript, ESLint, full Vitest, build and SAST pass;
10. Netlify preview is inspected page-by-page before push/merge.

## 16. Explicit non-goals

During this Carrier pass:
- do not redesign Customer
- do not redesign Broker
- do not redesign Driver / Owner Driver
- do not touch Super Admin
- do not change #607
- do not perform unrelated repo cleanup
- do not delete measured CSS until Carrier dependency has been removed and gates prove it safe

Carrier first. Finish it completely before moving to any other workspace.
