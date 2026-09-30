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

## 0.1 Strict numeric execution contract — mandatory

This section converts the blueprint from design direction into an execution specification.

**Precedence rule:** for Carrier visual convergence, the values in this document override conflicting Carrier-specific values in older workspace/CX documents. Shared values outside Carrier must not be changed unless explicitly stated.

**No interpretation rule:** implementation may not replace an exact value below with an approximate value, a range, or a visually similar value. Responsive changes are permitted only at the breakpoints defined below.

### 0.1.1 Canonical Carrier tokens

| Token | Exact value |
|---|---:|
| Global header height | 50px |
| Primary navigation height | 40px |
| Total sticky shell chrome | 90px |
| Header horizontal padding | 16px |
| Header internal gap | 14px |
| Logo button | 136px × 44px |
| Logo image | 136px × 36px |
| Identity gap | 1px |
| Identity eyebrow | 10px / 13px / 700 |
| Identity company line | 12px / 15px / 700 |
| Identity max width | 190px |
| Header action height | 32px |
| Header action horizontal padding | 12px |
| Header action gap | 8px |
| Notification control | 32px × 32px |
| Primary nav item height | 40px |
| Primary nav item horizontal padding | 10px |
| Primary nav item font | 12px / 600 |
| Active nav underline | 2px |
| Page top padding | 12px |
| Page horizontal padding | 12px |
| Page bottom padding | 16px |
| Section gap | 16px |
| Grid gap | 12px |
| Internal gap | 8px |
| Micro gap | 4px |
| Filter rail width | 220px |
| Filter/main gap | 12px |
| Standard control height | 32px |
| Micro action height | 28px |
| Panel header height | 36px |
| Panel body padding | 10px |
| Panel footer padding | 8px 12px |
| Panel radius | 4px |
| Standard border | 1px solid #D8DEE8 |
| Soft divider | 1px solid #E5E7EB |
| Page background | #F4F6F8 |
| Panel background | #FFFFFF |
| Panel header background | #F4F6F8 |
| Main text | #1A1F2B |
| Shell text | #172033 |
| Muted text | #64748B |
| Primary blue | #1D57D8 |
| Navy | #0B2F6B |
| Action orange | #F5A300 |
| Success green | #198754 |
| Warning text | #B76E00 |
| Danger red | #C62828 |
| Row hover | #F1F6FF |
| Row selected | #E8F0FF |
| Radius for controls/panels | 4px |
| Drop shadow | none |

### 0.1.2 Typography — exact

| Element | Size | Line height | Weight |
|---|---:|---:|---:|
| Page eyebrow | 11px | 14px | 700 |
| Page H1 | 20px | 26px | 650 |
| Page subtitle | 12px | 16px | 400 |
| Section H2 | 14px | 20px | 650 |
| Panel title | 13px | 18px | 650 |
| Body | 13px | 18px | 400 |
| Control text (input/select) | 12px | 16px | 400 |
| Action text (button) | 12px | 16px | 600 |
| Filter label | 11px | 14px | 650 |
| Table header | 11px | 14px | 700 |
| Metadata | 11px | 14px | 400 |
| Micro text (regular) | 10px | 13px | 400 |
| Micro text (strong) | 10px | 13px | 700 |
| KPI label | 11px | 14px | 600 |
| KPI value | 22px | 26px | 700 |
| Status badge | 11px | 14px | 700 |

Font family for all Carrier operational surfaces:
`"Segoe UI", Arial, sans-serif`.

No Carrier operational text may render below 10px.

### 0.1.3 Page header geometry — exact

Every Carrier page header must use on desktop >=769px:
- height: 60px;
- bottom margin: 8px;
- left/right content gap: 12px;
- title/subtitle vertical gap: 2px;
- actions gap: 8px;
- action height: 32px;
- action horizontal padding: 12px.

Exactly one `h1` is permitted per Carrier page.

### 0.1.4 Carrier signal strip — exact

Desktop >1200px:
- 6 columns;
- each tile height: 72px;
- internal separator gap: 1px;
- outer border: 1px #D8DEE8;
- radius: 4px;
- tile padding: 8px 10px;
- label: 11/14/600;
- value: 22/26/700;
- detail: 11/14/400;
- semantic accent: 3px left border or equivalent 3px edge indicator;
- strip bottom margin: 8px.

Viewport <=1200px:
- 3 columns;
- 2 rows;
- tile height remains 72px.

Viewport <=640px:
- 2 columns;
- 3 rows;
- tile height remains 72px.

No horizontal scrolling is allowed for the Carrier signal strip.

### 0.1.5 Filter rail — exact

Desktop >=1025px:
- width: 220px exactly;
- layout: `220px minmax(0,1fr)`;
- grid gap: 12px;
- sticky offset: 102px from viewport top (50px header + 40px nav + 12px page top);
- header padding: 8px 10px;
- body padding: 8px 10px;
- field gap: 6px;
- label-to-control gap: 2px;
- footer padding: 8px 10px;
- Search button: 32px, full width;
- Clear button: 32px, full width;
- inputs/selects: 32px high, 9px horizontal padding.

Viewport <=1024px:
- rail width: 100%;
- position: static;
- rail stacks above main content;
- rail/main gap remains 12px.

### 0.1.6 Tabs and view toggles — exact

Primary operational tab strip:
- height: 36px;
- button height: 36px;
- horizontal padding: 12px;
- font: 12px / 600;
- active indicator: 2px bottom border;
- border radius: 4px on strip outer container;
- inter-tab gap: 0px.

Compact view toggle:
- height: 32px;
- segment horizontal padding: 10px;
- font: 11px / 600;
- border: 1px #D8DEE8;
- outer radius: 4px;
- active background: #EFF6FF;
- active text: #0B2F6B.

### 0.1.7 Panels — exact

Every Carrier operational panel:
- border: 1px solid #D8DEE8;
- radius: 4px;
- background: #FFFFFF;
- shadow: none;
- header min-height: 36px;
- header padding: 8px 10px;
- header background: #F4F6F8;
- body padding: 10px;
- footer padding: 8px 12px;
- title: 13/18/650;
- subtitle: 11/14/400;
- header action gap: 8px.

Flush table/register panels may set body padding to 0 only.

### 0.1.8 Tables/registers — Carrier exact target

Carrier-specific table target supersedes older 40px table-header values for this Carrier convergence pass.

| Property | Exact value |
|---|---:|
| Table header height | 36px |
| Header horizontal padding | 8px |
| Header font | 11px / 14px / 700 |
| Standard row height | 42px |
| Wrapped row height | 52px |
| Cell padding | 6px 8px |
| Primary cell text | 12.5px / 17px / 600 |
| Metadata | 11px / 14px / 400 |
| Status badge height | 22px |
| Status badge radius | 999px |
| Row action height | 28px |
| Row action horizontal padding | 8px |
| Row action gap | 4px |
| Pagination bar height | 36px |
| Pagination button | 28px × 28px |
| Pagination gap | 4px |

Tables must scroll inside their own wrapper if unavoidable. Page-level horizontal overflow is forbidden.

### 0.1.9 Empty states — exact

Compact register empty state:
- min-height: 64px;
- padding: 10px 12px;
- title: 13px / 18px / 600;
- description: 11px / 15px / 400;
- title/description gap: 2px;
- optional action margin-top: 8px;
- no decorative X icon;
- no illustration larger than 24px.

Map empty state:
- min-height: 220px;
- centered vertically and horizontally;
- same typography as compact state;
- optional action height: 32px.

### 0.1.10 Map/register split — exact

For Live Availability and Freight Vision:
- desktop >=1200px: `minmax(0,0.79fr) minmax(0,1fr)`;
- exact fraction ratio from 0.79fr / 1fr: 44.134% map / 55.866% register;
- gap: 12px;
- map panel min-height: 320px;
- register panel min-height: 320px;
- both panel headers: 36px;
- both start on the same y-coordinate.

At <=1199px:
- stack to one column;
- gap remains 12px.

### 0.1.11 Responsive geometry — exact

#### 1920×1080
- page inner width: 1896px (1920 - 24);
- rail layout main width: 1664px (1896 - 220 - 12);
- full Carrier shell chrome: 90px;
- no page-level horizontal scroll.

#### 1440×900
- page inner width: 1416px;
- rail layout main width: 1184px;
- no page-level horizontal scroll.

#### 1280×800
- page inner width: 1256px;
- rail layout main width: 1024px;
- no page-level horizontal scroll.

#### 1024 tablet
- page horizontal padding: 10px;
- inner width: 1004px;
- rail stacks above main;
- signal strip uses 3 columns;
- map/register stacks to one column.

#### 768
- page horizontal padding: 8px;
- inner width: 752px;
- one-column operational rows;
- filters stacked;
- tables may scroll inside table wrapper only.

#### 390 mobile
- page horizontal padding: 8px;
- inner width: 374px;
- signal strip: 2 columns;
- all operational record grids collapse to 1 column;
- header actions wrap below title if they cannot fit without clipping;
- no control may be narrower than 32px touch height; primary actions remain 32px high.

### 0.1.12 Exact Carrier page geometry

#### Carrier Control Desk
- header: 60px;
- signal strip: 6 × 72px desktop;
- main composition: 220px rail + 12px gap + main;
- Operational Workboard header: 40px;
- workboard empty state: 64px minimum;
- lower summary grid: `minmax(0,1fr) minmax(0,1.35fr)`;
- lower grid gap: 12px;
- lower grid top margin: 12px;
- Commercial Position row: 42px minimum;
- Workflow link row: 38px minimum;
- nested card gap: 12px.

#### My Fleet
- header: 60px;
- signal strip: up to 6 tiles; every rendered tile is exactly 72px high;
- Connected Workspace control row: 40px;
- full-width register panel;
- table header: 36px;
- table rows: 42px;
- Fleet Attention rows: 42px;
- section gap: 12px.

#### Drivers & Vehicles
- header: 60px;
- signal strip: up to 6 tiles; every rendered tile is exactly 72px high;
- Resource Filters panel header: 36px;
- Resource Filters body grid: `repeat(4,minmax(160px,1fr))`;
- filter body gap: 8px;
- controls: 32px;
- Fleet Resource Register header: 36px;
- Company Vehicles header: 36px;
- all register rows: 42px;
- gap between register panels: 12px.

At <=1199px Resource Filters becomes 2 columns.
At <=768px Resource Filters becomes 1 column.

#### Live Availability
- header: 60px;
- signal strip: up to 6 tiles; every rendered tile is exactly 72px high;
- filter panel header: 36px;
- filter panel body: 4-column grid at >=1200px, 8px gap;
- map/register ratio: 0.79fr / 1fr;
- map/register gap: 12px;
- both panels min-height: 320px;
- tabs: 36px;
- table header: 36px;
- row: 42px.

#### Freight Vision
Use the **identical geometry** as Live Availability:
- same header;
- same signal strip;
- same filter panel;
- same 0.79fr / 1fr split;
- same 320px minimum panel height;
- same register dimensions.
Tracking Timeline, when visible, starts 12px below the map/register row.

#### Loads
- layout: 220px rail + 12px gap + main;
- primary tabs: 36px;
- secondary load-type tabs: 32px;
- register toolbar: 40px;
- List/Map toggle: 32px;
- collapsed load record: 84px minimum;
- record internal padding: 8px 10px;
- record gap: 8px;
- metadata rail: 22px minimum;
- empty state: 64px;
- pagination bar: 36px.

#### Quotes
- layout identical to Loads;
- rail: 220px;
- status tabs: 36px;
- register toolbar: 40px;
- collapsed quote record: 76px minimum;
- expanded quote details top border: 1px #E5E7EB;
- expanded detail padding: 10px;
- empty state: 64px;
- pagination: 36px.

#### Diary
- layout: 220px rail + 12px gap + main;
- status tabs: 36px;
- toolbar: 40px;
- List/Split toggle: 32px;
- booking record collapsed minimum: 84px;
- record gap: 8px;
- metadata bar: 22px;
- no empty main area taller than 96px when there are zero bookings;
- empty state min-height: 64px;
- page-size control: 32px;
- pagination bar: 36px.

#### Return Journeys
- layout: 220px rail + 12px gap + main;
- state tabs: 36px;
- List/Map toggle: 32px;
- editor panel header: 36px;
- editor desktop grid: `repeat(4,minmax(150px,1fr))`;
- editor grid gap: 8px;
- editor controls: 32px;
- record collapsed minimum: 76px;
- record metadata bar: 22px;
- map panel minimum: 320px;
- empty state: 64px.

#### Directory
- exactly one page H1;
- outer Carrier PageHeader only; inner MemberDirectoryPage must not render a second H1/hero;
- layout: 220px rail + 12px gap + main;
- Companies/Drivers tabs: 36px;
- register metadata bar: 36px;
- operational member row minimum: 88px;
- row internal grid desktop: `1.20fr 1fr 1.25fr 1.45fr 1fr`;
- column gap: 0; separators are 1px #E5E7EB;
- cell padding: 8px 10px;
- action gap: 4px;
- action height: 28px;
- empty state: 64px.

### 0.1.13 Visual acceptance tolerances

Implementation is considered geometrically correct only when:
- specified fixed heights/widths differ by **0px** in computed CSS;
- browser rasterisation/screenshot edge tolerance is at most **±2px**;
- page-level horizontal overflow is **0px**;
- no unexpected vertical gap exceeds its specified token by more than **2px**;
- every Carrier page uses the same border, radius, typography and control-height tokens;
- any deviation from this numeric contract requires an explicit amendment to this document before code is merged.


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
