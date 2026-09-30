# XDrive Logistics — Carrier Visual Consistency Implementation Blueprint

**Status:** FINAL EXECUTION SPECIFICATION
**Date:** 30 September 2026
**Scope:** Carrier workspace only
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`
**Implementation branch:** `feat/carrier-visual-convergence-20260930`

This document is an execution contract, not a visual direction document. An implementation agent must be able to execute it without inventing dimensions, spacing, component anatomy, breakpoints, page order, empty-state treatment, table geometry or functional grouping.

---

# 0. Scope and hard boundaries

Carrier routes covered:

1. `/admin` — Carrier Control Desk
2. `/admin/marketplace/directory` — Directory
3. `/admin/live-availability` — Live Availability
4. `/admin/fleet` — My Fleet
5. `/admin/fleet/returns` — Return Journeys
6. `/admin/marketplace` — Loads
7. `/admin/exchange-quotes` — Quotes
8. `/admin/diary` — Diary
9. `/admin/freight-vision` — Freight Vision
10. `/admin/fleet/resources` — Drivers & Vehicles

Do not redesign Customer, Broker, Driver, Owner Driver, Dispatcher, Finance, Compliance or Super Admin during this pass.

Do not touch PR #607.

Do not alter business rules, Supabase queries, RLS, legal/Stripe gates, quote eligibility, award logic, lifecycle authority, invoice truth, tracking privacy, return-journey ownership, company-driver restrictions or reliability calculations unless a separate functional defect is explicitly found and approved.

---

# 1. Evidence reviewed before defining this specification

## 1.1 Current XDrive Carrier screenshots supplied by the owner

The following live Carrier pages were visually inspected in the supplied 1920×1080 desktop screenshots:

- Carrier Control Desk
- Drivers & Vehicles
- Freight Vision
- Diary
- Quotes
- Loads
- Return Journeys
- My Fleet
- Live Availability
- Directory

The current visual defects identified from those screenshots are captured in Section 4.

## 1.2 Current repository implementation inspected

Primary files inspected:

- `app/components/workspace/TopWorkspaceShell.tsx`
- `app/components/workspace/top-workspace-shell.css`
- `app/components/workspace/WorkspaceUI.tsx`
- `app/components/workspace/WorkspaceUI.module.css`
- `app/components/workspace/OperationalConvergence.tsx`
- `app/components/workspace/OperationalConvergence.module.css`
- `app/components/workspace/workspace-measured-cx-baseline.css`
- `app/components/workspace/CarrierOperationsDashboardHome.tsx`
- `app/components/workspace/FleetControlDashboardHome.tsx`
- `app/components/workspace/CompanyMarketplaceExchange.tsx`
- `app/components/workspace/OperationsDiaryPage.tsx`
- `app/components/workspace/MemberDirectoryPage.tsx`
- `app/admin/live-availability/page.tsx`
- `app/admin/freight-vision/page.tsx`
- `app/admin/fleet/resources/page.tsx`
- `app/admin/fleet/returns/page.tsx`

## 1.3 Courier Exchange visual references inspected

Reference screenshots are stored under `docs/reference/courier-exchange/`.

Key observed CX patterns used as functional/structural benchmark:

- Dashboard: reports/statistics, latest bookings, accounts/reports, feedback/compliance.
- Drivers & Vehicles: company vehicles, driver/user management, vehicle tracking.
- Loads: persistent left search rail, list/map choice, All Live / On Demand / Regular Load / Daily Hire, dense operational load records, Quote Now.
- Quotes: persistent search rail, Received/Archived/Submitted/Unsuccessful states, compact empty state.
- Diary: persistent search rail, lifecycle tabs, compact booking records, POD/order/notes/history/documents/invoice actions.
- Return Journeys: add journey, list/map, route/radius/date/member filters, dense journey records, Track/View Feedback/Book Direct.
- Availability/return-capacity: current status, future intent, return capacity, recent work and nearby context.
- My Fleet: resource status, current/last location, future position, future journey, advertising state and tracking notification.
- Settings/member information: dense forms and grouped operational information, not large marketing cards.

CX is a functional-density benchmark only. XDrive keeps its own branding, privacy model, terminology and component system.

## 1.4 Canonical functional benchmark also reviewed

- `docs/benchmarks/CX_CONNECTED_WORKSPACES_2026-09-06.md`
- `docs/benchmarks/CX_ROLE_FUNCTION_MASTER_BLUEPRINT_2026-09-25.md`
- `docs/benchmarks/XDRIVE_OPERATIONAL_WORKSPACE_SHELL_CANONICAL_2026-09-28.md`
- `docs/ui/cx/jobs.md`
- `docs/ui/cx/implementation-checklist.md`
- `docs/ui/cx/screen-inventory.md`

---

# 2. Carrier information architecture — fixed

The Carrier primary navbar order is canonical and must not change:

1. Dashboard
2. Directory
3. Live Availability
4. My Fleet
5. Return Journeys
6. Loads
7. Quotes
8. Diary
9. Freight Vision
10. Drivers & Vehicles
11. Settings
12. More

Source: `TopWorkspaceShell.tsx`.

`More` keeps lower-frequency destinations such as Action Centre, invoices, jobs, messages and Event Log according to current permissions.

Do not add a second navbar inside any Carrier page.

---

# 3. Functional meaning of each Carrier navbar destination

This section prevents an implementation agent from simplifying a page until its function no longer matches the product.

## 3.1 Dashboard — Carrier Control Desk

Purpose: command centre, not another register.

Must contain:
- attention state;
- unallocated awarded work;
- live jobs;
- delivery/POD evidence attention;
- available drivers;
- operational exceptions;
- searchable operational workboard;
- commercial position;
- latest carrier-awarded activity;
- workflow shortcuts tied to actual Carrier lifecycle;
- finance/report entry points when backed by real data.

Do not duplicate the whole navbar as dashboard shortcuts.

## 3.2 Directory

Purpose: discover members/resources while preserving privacy and verified truth.

Must contain:
- Companies / Drivers mode;
- member/XDrive ID;
- location/coverage;
- member type/capability;
- delivery/payment reliability only when evidence exists;
- filters for member, location/radius, member type, vehicle/capability, specialist service and reliability;
- Call/Message;
- Book Direct only where authorised and supported.

No fabricated ratings or verification labels.

## 3.3 Live Availability

Purpose: current/future capacity view.

Must contain:
- Live Fleet;
- Future;
- Nearby Exchange;
- availability state;
- current/fresh/stale/missing position;
- future position;
- current work;
- next/future work;
- privacy-safe nearby Exchange discovery;
- map + operational register.

## 3.4 My Fleet

Purpose: Carrier fleet-control overview.

Must contain:
- unallocated;
- allocated;
- active jobs;
- available drivers;
- tracking attention;
- compliance attention;
- resource register;
- current/last tracked location;
- future position;
- return journey;
- advertising state;
- document readiness;
- fleet attention register.

The current `Connected workspace` card duplicates routes already present in the canonical navbar and must be removed from the Carrier visual target.

## 3.5 Return Journeys

Purpose: publish and discover return capacity.

Must contain:
- Publish Return Journey;
- Active / All / Closed;
- List / Map;
- From / To / Driver filters;
- journey origin/destination;
- departure/ETA/date;
- capacity/vehicle;
- relevant actions;
- map when requested.

## 3.6 Loads

Purpose: discover marketplace work.

Must contain:
- Available Loads / Won Work;
- All Live / On Demand / Regular Load / Daily Hire;
- List / Map;
- From + radius;
- To + radius;
- vehicle;
- body/equipment;
- freight type;
- member;
- advanced search;
- saved/default search;
- route;
- pickup/delivery;
- distance/cargo/requested vehicle/payment terms when real;
- quote action;
- expandable operational detail.

## 3.7 Quotes

Purpose: manage Carrier-submitted marketplace offers.

Must contain:
- All;
- Submitted;
- Accepted / Won;
- Unsuccessful;
- Archived;
- pickup/delivery time filters;
- load/reference;
- booked-by/member;
- route;
- poster/member;
- amount;
- quote state;
- submitted timestamp;
- vehicle;
- marketplace budget where real;
- commercial note;
- Withdraw only where policy allows.

## 3.8 Diary

Purpose: canonical booking/history register.

Must contain:
- All;
- Unallocated;
- Allocated;
- In Progress;
- Completed;
- Cancelled;
- Expired;
- Awaiting Feedback;
- Recent Feedback;
- POD / Evidence;
- saved views;
- groups;
- own/subcontracted scope;
- route;
- pickup/delivery;
- driver/vehicle;
- status;
- POD/evidence;
- notes/history/documents/invoice links where authorised;
- List / Split View.

## 3.9 Freight Vision

Purpose: execution monitoring and exception recovery.

Must contain:
- active jobs;
- on-time state;
- behind ETA;
- late;
- not tracking;
- not started;
- pickup/delivery filter;
- ETA/tracking state;
- job status;
- live freight map;
- exception register;
- tracking timeline when a job is selected;
- inspect/open/Diary/replay/message/call actions where authorised.

## 3.10 Drivers & Vehicles

Purpose: detailed resource administration.

Must contain:
- Resources;
- Drivers;
- Vehicles;
- Vehicle Tracking;
- Live Availability;
- Return Journeys;
- driver/vehicle relationships;
- availability;
- current/last location;
- future position;
- future journey/next work;
- advertising;
- tracking;
- attention;
- vehicle document state;
- vehicle tracking notification preference.

---

# 4. Current visual/code defects — exact audit

| Area | Current state | Defect | Final action |
|---|---|---|---|
| Global shell | 50px header + 40px nav | Correct | Keep |
| Page wrapper | Dashboard/My Fleet custom wrappers; other pages PageFrame | top padding differs 10px vs 12px | All 10 use CarrierPageFrame |
| Page header | variable natural height; DashboardHomeHeader differs from PageHeader | next section starts at different Y position | fixed desktop header contract |
| Header margin | PageHeader currently 12px bottom | inconsistent with dense dashboard rhythm | set 8px |
| Signal strip | Dashboard custom ~54px; OperationalSignalStrip 52px | visually different KPI systems | one CarrierSignalStrip |
| Signal count | My Fleet has 7 | breaks common strip anatomy | merge document/compliance into one Compliance signal; max 6 |
| Signal value type | Dashboard 20px, shared strip 17px | inconsistent emphasis | 18px/20px/800 |
| Tabs | 28px, 30px, min 34px, custom | inconsistent heights | all Carrier local tabs 32px |
| Filter rail | width 220px | correct | keep |
| Filter sticky top | legacy CSS top 50px | overlaps 40px primary nav | exact top 102px |
| Card border | #cfd7e3 / #cbd5e1 / #dbe2ea / #D8DEE8 | inconsistent visual weight | #D8DEE8 only |
| Card radius | mostly 4px, some shared components 8/9px | inconsistent | 4px only |
| Panel header | natural/36/40px | inconsistent | CarrierPanelHeader 44px |
| Controls | 26/28/30/32/34px | inconsistent | 32px standard, 28px micro |
| Tables | 36/40px headers; rows variable | inconsistent scan rhythm | 36px header, 44px rows |
| Board records | 52px+ mixed footer/meta | Loads/Quotes/Diary/Returns differ | one 92px collapsed record |
| Empty state | default 160px with 38px X icon; some 28px padding | placeholder/dead-space appearance | 64px compact; no X |
| Map empty state | default EmptyState 160px | panels look unfinished | fixed 280px map body |
| Live/Freight split | page-specific | sibling modules do not match | identical split primitive |
| Directory | alternate 1280px table + record mode | mixed paradigms/horizontal overflow risk | Carrier uses record mode only |
| My Fleet Connected workspace | route shortcut card | duplicates navbar | remove |
| Dashboard quick action strip | custom toolbar | useful contextual actions | keep, but standardize to 40px |
| Inline CSS | extensive page-specific geometry | agent can drift | move Carrier geometry into shared CSS |
| Empty main pages | Diary/Quotes/Loads/Returns produce large blank viewport | poor density | compact 64px empty register; no filler height |

---

# 5. Final Carrier design tokens — exact

All values below are mandatory for Carrier.

## 5.1 Colours

| Token | Value |
|---|---|
| page-bg | #F4F6F8 |
| surface | #FFFFFF |
| surface-muted | #F4F6F8 |
| surface-hover | #F1F6FF |
| surface-selected | #E8F0FF |
| border | #D8DEE8 |
| divider | #E5E7EB |
| text | #1A1F2B |
| shell-text | #172033 |
| muted | #64748B |
| blue | #1D57D8 |
| navy | #0B2F6B |
| orange | #F5A300 |
| green | #198754 |
| green-hover | #157347 |
| red | #C62828 |
| warning | #B76E00 |

No box shadow on Carrier operational cards, tables, toolbars or filters.

## 5.2 Radius

- panels: 4px
- inputs/selects: 4px
- buttons: 4px
- status badges: 999px
- expandable-row toggle: 3px

## 5.3 Typography

Font family: `"Segoe UI", Arial, sans-serif`.

| Element | Size | Line height | Weight |
|---|---:|---:|---:|
| page eyebrow | 11px | 14px | 700 |
| H1 | 20px | 26px | 650 |
| page description | 12px | 16px | 400 |
| page meta | 11px | 14px | 400 |
| H2/section | 14px | 20px | 650 |
| panel title | 13px | 18px | 700 |
| panel subtitle | 10px | 13px | 400 |
| body | 12px | 16px | 400 |
| strong body | 12px | 16px | 650 |
| label | 11px | 14px | 650 |
| metadata | 11px | 14px | 400 |
| micro | 10px | 12px | 400 |
| micro strong | 10px | 12px | 700 |
| signal value | 18px | 20px | 800 |
| table header | 11px | 14px | 700 |
| status badge | 10px | 14px | 700 |

No operational text below 10px.

## 5.4 Spacing scale

Only these spacing values are allowed for Carrier layout:

- 2px — text micro-gap
- 4px — micro control/action gap
- 6px — compact filter gap
- 8px — internal component gap
- 10px — compact panel cell padding
- 12px — grid/page section gap
- 16px — major section separation

Do not introduce 5px, 7px, 9px, 14px or arbitrary rem-based Carrier spacing.

---

# 6. Canonical shell geometry — exact

Existing `TopWorkspaceShell` remains the only global Carrier shell.

## 6.1 Header

- height: 50px
- sticky top: 0px
- z-index: 80
- horizontal padding: 16px
- grid gap: 14px
- logo button: 136×44px
- logo image: 136×36px
- header action height: 32px
- header action horizontal padding: 12px
- header action gap: 8px
- notification: 32×32px

## 6.2 Primary navbar

- height: 40px
- sticky top: 50px
- z-index: 79
- horizontal track padding: 16px
- item height: 40px
- item horizontal padding: 10px
- item gap: 2px
- font: 12px/16px/600
- active underline: 2px #1D57D8

Total sticky shell chrome: exactly **90px**.

---

# 7. Canonical page frame — exact

Create/use a Carrier-specific wrapper backed by shared primitives:

`CarrierPageFrame`

Desktop >=1025px:
- width: 100%
- max-width: none
- padding-top: 12px
- padding-right: 12px
- padding-bottom: 16px
- padding-left: 12px
- page-level overflow-x: 0px

Tablet <=1024px:
- horizontal padding: 10px
- top padding: 10px
- bottom padding: 14px

Mobile <=768px:
- horizontal padding: 8px
- top padding: 8px
- bottom padding: 12px

---

# 8. Canonical page header — exact

Create `CarrierPageHeader`.

Desktop >=1025px:
- content block height: exactly 78px
- margin-bottom: 8px
- actions gap: 8px
- left/right header gap: 12px
- title column min-width: 0
- title column preferred flex-basis: 520px

Vertical title stack:
1. eyebrow: 14px line box
2. gap: 2px
3. H1: 26px line box
4. gap: 2px
5. description: 16px line box
6. gap: 4px
7. meta: 14px line box

Total: 78px.

If a page has no visible meta, reserve the 14px meta row on desktop so the next component begins at the same Y-coordinate across all ten pages.

Description is one line on desktop:
- white-space: nowrap
- overflow: hidden
- text-overflow: ellipsis

At <=1024px header height becomes auto and actions may wrap below the title block.

Exactly one H1 per page.

---

# 9. Canonical Carrier signal strip — exact

Create `CarrierSignalStrip`; do not use raw page-specific KPI markup.

Desktop:
- exactly 6 cells when a page uses signals
- strip height: 56px
- outer border: 1px #D8DEE8
- outer radius: 4px
- internal cell separators: 1px #E5E7EB
- cell padding: 4px 10px
- semantic accent: 3px left edge
- margin-bottom: 8px
- no horizontal scrolling

Cell typography:
- label: 11/14/650
- value: 18/20/800
- detail: 10/12/400

Responsive:
- >1200px: 6 columns
- 769–1200px: 3 columns × 2 rows
- <=768px: 2 columns × 3 rows

Every cell remains exactly 56px high.

My Fleet currently has 7 signals. Final six:
1. Unallocated
2. Allocated
3. Active Jobs
4. Available Drivers
5. Tracking Alerts
6. Compliance

`Documents expiring` is folded into the Compliance signal detail/count; do not keep a seventh tile.

---

# 10. Canonical card/panel system — exact

Create/use `CarrierPanel`.

Outer:
- border: 1px solid #D8DEE8
- radius: 4px
- background: #FFFFFF
- shadow: none
- overflow: hidden

Header:
- height: exactly 44px
- padding: 6px 10px
- title: 13/18/700
- subtitle: 10/13/400
- title/subtitle gap: 1px
- action gap: 8px
- background: #F4F6F8
- bottom border: 1px #D8DEE8

Body:
- standard padding: 10px
- flush register/table body: 0px

Footer:
- min-height: 32px
- padding: 4px 10px
- background: #F4F6F8
- top border: 1px #D8DEE8
- font: 11/14/400

---

# 11. Canonical filter rail — exact

Create/use `CarrierFilterRail`.

Desktop >=1025px:
- width: exactly 220px
- board grid: `220px minmax(0,1fr)`
- rail/main gap: 12px
- sticky top: **102px**
  - 50px global header
  - 40px primary nav
  - 12px page top padding
- background: #FFFFFF
- border: 1px #D8DEE8
- radius: 4px
- overflow: hidden

Header:
- height: 36px
- padding: 0 10px
- title: 12/16/700

Body:
- padding: 10px
- field vertical gap: 6px
- label/control gap: 2px

Controls:
- height: 32px
- border: 1px #D8DEE8
- radius: 4px
- horizontal padding: 9px
- font: 12/16/400

Footer:
- padding: 8px 10px
- button gap: 4px

At <=1024px:
- width: 100%
- position: static
- rail stacks above main
- grid becomes 1 column
- gap remains 12px

The current legacy sticky `top:50px` is incorrect and must not survive Carrier convergence.

---

# 12. Canonical tabs — exact

Create/use `CarrierTabStrip`.

- strip height: 32px
- tab height: 32px
- horizontal padding: 10px
- font: 11/14/650
- active font weight: 800
- active underline: 2px #1D57D8
- inactive text: #64748B
- active text: #1D57D8
- background: #FFFFFF
- bottom border: 1px #D8DEE8
- tab gap: 0px
- no rounded individual tabs

This replaces current 28px, 30px and 34px variants.

---

# 13. Canonical toolbar — exact

Create/use `CarrierToolbar`.

Desktop:
- height: 40px
- padding: 4px 8px
- control gap: 8px
- border: 1px #D8DEE8
- radius: 4px
- background: #FFFFFF
- flex-wrap: nowrap

At <=1024px:
- min-height: 40px
- height: auto
- wrapping allowed

Standard control height inside toolbar: 32px.

---

# 14. Buttons and controls — exact

## Standard button
- height: 32px
- horizontal padding: 12px
- radius: 4px
- font: 12/16/600
- gap between icon/text: 8px

## Micro/row button
- height: 28px
- horizontal padding: 8px
- radius: 4px
- font: 11/14/600

## Expand/collapse square
- 28×28px
- radius: 3px

## Focus
- outline: 2px solid #1D57D8
- outline-offset: -1px

## Disabled
- opacity: 0.55
- cursor: not-allowed

No operational button may be 26px, 30px or 34px after convergence.

---

# 15. Canonical table geometry — exact

Use one Carrier table implementation.

- table wrapper: overflow-x auto only when necessary
- page-level horizontal overflow: forbidden
- header height: 36px
- header padding: 0 10px
- header font: 11/14/700
- row height: 44px
- wrapped row height: 52px only when explicitly required
- cell padding: 6px 10px
- body font: 12/16/400
- strong cell: 12/16/650
- metadata: 10/12/400
- row bottom border: 1px #E5E7EB
- hover: #F1F6FF
- selected: #E8F0FF

Status badge:
- height: 22px
- padding: 0 7px
- font: 10/14/700
- radius: 999px

Pagination:
- bar height: 36px
- page button: 28×28px
- gap: 4px

---

# 16. Canonical operational record — exact

Loads, Quotes, Diary, Return Journeys and Directory use the same collapsed record anatomy.

Outer:
- border: 1px solid #D8DEE8
- radius: 4px
- background: #FFFFFF
- overflow: hidden
- margin/gap between records: 8px
- collapsed total height: exactly **92px**

Primary record area:
- height: 60px
- display: grid
- cell padding: 8px 10px
- vertical separators: 1px #E5E7EB

Action/footer bar:
- height: 32px
- padding: 2px 8px
- top border: 1px #E5E7EB
- background: #FBFDFF
- action gap: 4px

No separate 22–28px metadata bar may be added to the collapsed record. Metadata must fit inside the 60px primary area or the 32px footer.

Expanded detail:
- top border: 1px #E5E7EB
- padding: 10px
- grid gap: 8px
- background: #F8FAFC
- appears between the 60px primary area and 32px action/footer bar.

---

# 17. Empty states — exact

Do not use the existing decorative 38px `X` icon on Carrier.

## Register empty state
- height: 64px
- padding: 10px 12px
- title: 12/16/650
- description: 11/14/400
- title/description gap: 2px
- no illustration
- optional CTA: 28px micro action

## Map empty state
- body height: 280px
- centered horizontally/vertically
- no decorative X
- title: 13/18/650
- description: 11/14/400
- max text width: 420px

No empty list/register surface may fill unused viewport height.

---

# 18. Live map/register split — exact

Live Availability and Freight Vision must use the same shared primitive.

Desktop >=1200px:
- grid: `minmax(0,.79fr) minmax(0,1fr)`
- gap: 12px
- available fraction:
  - map: 44.134%
  - register: 55.866%
- panel header: 44px
- panel body: 280px
- total panel height including borders: 326px
- both panels start on identical Y coordinate
- both panels have identical total height when register content does not require more

At <=1199px:
- stack to 1 column
- gap: 12px
- body stays 280px

---

# 19. Desktop width calculations — exact

## 1920px viewport
- page horizontal padding: 12+12
- page inner width: 1896px
- rail: 220px
- rail/main gap: 12px
- rail-layout main width: 1664px

Dashboard lower grid using `1fr / 1.35fr`:
- usable width after 12px gap: 1652px
- left: 703px
- right: 949px

Live/Freight split:
- usable width after 12px gap: 1884px
- map: 831.5px
- register: 1052.5px

## 1440px viewport
- inner width: 1416px
- rail-layout main: 1184px
- dashboard lower left/right after gap: 498.7px / 673.3px
- Live/Freight map/register after gap: 619.7px / 784.3px

## 1280px viewport
- inner width: 1256px
- rail-layout main: 1024px
- dashboard lower left/right after gap: 430.6px / 581.4px
- Live/Freight map/register after gap: 549.0px / 695.0px

No page-level horizontal scroll is permitted at 1920, 1440 or 1280.

---

# 20. Breakpoints — exact

## >=1280
Full desktop geometry.

## 1200–1279
- rail remains 220px
- signal strip remains 6 columns until 1200 boundary
- operational record primary grid may reduce column minimums but remains one row

## 1025–1199
- rail remains 220px
- signal strip becomes 3×2
- map/register stacks at <=1199
- operational records use 2-column primary arrangement where needed

## 769–1024
- filter rail stacks above content
- page horizontal padding 10px
- signal strip 3×2
- filter grids max 2 columns
- tables scroll within wrapper only
- header height auto

## <=768
- page padding 8px
- signal strip 2×3
- all record grids 1 column
- collapsed operational records no longer fixed to 92px; they become content-height cards
- filters 1 column
- actions wrap
- no page-level horizontal overflow

## 390 reference mobile
- page inner width: 374px
- standard controls: 32px
- micro actions: 28px
- two signal columns
- tables converted to cards only where the existing component explicitly supports mobile card rendering; otherwise table wrapper scrolls horizontally

---

# 21. Page-specific exact implementation contracts

## 21.1 Carrier Control Desk — /admin

Vertical order:

1. CarrierPageHeader — 78px
2. 8px gap
3. contextual Operations toolbar — 40px
4. 8px gap
5. CarrierSignalStrip — 56px
6. 8px gap
7. board grid: 220px rail + 12px + main
8. lower summary grid inside main — 12px top gap

Header:
- eyebrow: CARRIER OPERATIONS
- title: Carrier Control Desk
- description: existing truthful description
- meta row reserved

Context toolbar:
- exactly 40px
- left: Operations + short descriptor
- right: Jobs, Live Availability, Live Positions, Freight Vision, Directory, Messages, Event Log, Refresh
- these are contextual operations shortcuts and may remain because they relate directly to the active control desk
- buttons: 32px

Signals — exactly 6:
1. Needs Attention
2. Awaiting Allocation
3. Live Jobs
4. Photo Evidence
5. Available Drivers
6. Exceptions

Board:
- rail 220px
- workboard panel header 44px
- workboard tabs 32px
- workboard desktop columns, in this exact order: Ref / Priority | Route | Pickup | Vehicle | Driver | Status | Action
- Ref / Priority is one compact two-line cell so the workboard remains fully visible at 1280px without losing priority information
- register rows table geometry 36/44 when populated
- empty state 64px
- footer 32px

Lower grid:
- `minmax(0,1fr) minmax(0,1.35fr)`
- gap 12px
- left stack gap 12px
- right stack gap 12px

Cards:
- Commercial Position
- Reports & Finance
- Activity at a Glance
- Carrier Workflow

Activity at a Glance desktop columns, in this exact order:
- Route / Vehicle
- Pickup
- Status / Evidence
- Action

Vehicle and reference are rendered as route-cell metadata. Evidence is rendered as status-cell metadata. This compact four-column form is mandatory so the right-hand lower panel does not require horizontal scrolling at 1280px or 1440px.

All four use 44px panel headers.

Commercial rows: 44px each.
Workflow rows: 44px each.

Remove page-specific custom signal geometry and move to CarrierSignalStrip.

## 21.2 Directory — /admin/marketplace/directory

Vertical order:

1. CarrierPageHeader — 78px
2. 8px gap
3. board grid 220px + 12px + main

No duplicate H1 inside `MemberDirectoryPage`.

Rail:
- 220px
- header 36px
- exact field order:
  1. Member / XDrive ID
  2. Location
  3. Find My Nearest
  4. Radius
  5. Country
  6. Member Type
  7. Vehicle Type
  8. Specialist Service
  9. Tail Lift Capability
  10. Delivery Reliability
  11. Payment Reliability
- controls 32px
- field gap 6px

Main:
- Companies / Drivers tabs: 32px
- register toolbar: 40px
- page-size control: 32px
- record gap: 8px

Carrier Directory record:
- total collapsed height 92px
- primary 60px
- footer/actions 32px
- desktop primary grid:
  `minmax(260px,1.30fr) minmax(210px,1fr) minmax(240px,1.15fr) minmax(280px,1.30fr)`
- cells:
  1. Member
  2. Location
  3. Type / Capability
  4. Delivery / Payment reliability
- actions move to 32px footer:
  - Profile/member identity where available
  - Call member
  - Messages
  - Book Direct when authorised

Do not use the existing `dir-table` 1280px desktop mode in Carrier. Carrier Directory uses operational records only.

Empty result: 64px.

## 21.3 Live Availability — /admin/live-availability

Vertical order:

1. CarrierPageHeader — 78px
2. tabs — 32px
3. 8px gap
4. CarrierSignalStrip — 56px
5. 8px gap
6. filter panel — 88px total
7. 12px gap
8. shared map/register split — 326px

Tabs:
- Live Fleet
- Future
- Nearby Exchange

Signals — exactly 6:
1. Available
2. Busy
3. Fresh Locations
4. Stale / Missing
5. Future Positions
6. Availability Conflicts

Filter panel:
- header 36px
- body height 50px
- body padding 9px 10px
- desktop Live grid:
  `minmax(360px,2fr) minmax(220px,1fr) minmax(220px,1fr)`
- search / availability / tracking freshness
- Clear/Save controls stay 32px

Map/register split:
- use Section 18 exactly
- no X icon
- register table 36px header / 44px rows

## 21.4 My Fleet — /admin/fleet

Vertical order:

1. CarrierPageHeader — 78px
2. 8px gap
3. CarrierSignalStrip — 56px
4. 8px gap
5. Fleet Resource Register
6. 12px gap
7. Fleet Attention

Remove `Connected workspace` card entirely because Finance, Freight Vision, Messages and Event Log are already reachable from the canonical shell/More and the shell contract forbids duplicate dashboard navigation.

Signals — exactly 6:
1. Unallocated
2. Allocated
3. Active Jobs
4. Available Drivers
5. Tracking Alerts
6. Compliance

Resource Register panel:
- header 44px
- filter toolbar 40px
- table header 36px
- row 44px
- actions micro 28px

Columns stay:
Driver / Vehicle / Availability / Current Location / Future Position / Return Journey / Advertise / Documents / Actions

Fleet Attention:
- header 44px
- filter toolbar 40px
- table header 36px
- row 44px

Page wrapper top padding changes from current 10px to canonical 12px desktop.

## 21.5 Return Journeys — /admin/fleet/returns

Vertical order:

1. CarrierPageHeader — 78px
2. 8px gap
3. board grid 220px + 12px + main

Header actions:
- Publish Return Journey
- Live / Future Availability
- Refresh
- 32px each

Publish editor:
- hidden/collapsed until Publish Return Journey is activated
- when open, appears immediately below header and before board grid
- panel header 44px
- body desktop grid: `repeat(4,minmax(150px,1fr))`
- body gap 8px
- controls 32px
- action row 40px
- panel margin-bottom 12px

Rail:
- From
- To
- Driver
- 220px exact

Main:
- Active / All / Closed tabs: 32px
- List / Map toggle: 32px
- toolbar: 40px

List record:
- 92px collapsed
- primary 60px
- footer 32px
- primary grid:
  `minmax(320px,1.35fr) minmax(260px,1fr) minmax(220px,.75fr)`
- columns: Route / Timing / Capacity+Vehicle
- footer: Track / Feedback / Book Direct / management actions permitted by XDrive

Map:
- CarrierPanel header 44px
- body 280px
- total 326px

Empty list: 64px.

## 21.6 Loads — /admin/marketplace

Vertical order:

1. CarrierPageHeader — 78px
2. Available Loads / Won Work tabs — 32px
3. 8px gap
4. board grid 220px + 12px + main

Rail:
- Search Loads header 36px
- From + radius
- To + radius
- Vehicle Size
- Body / Equipment
- Freight Type
- Member Name / ID
- Advanced Search
- Search / Clear
- Load Default / Save Default
- controls 32px
- field gap 6px

Main:
- register toolbar 40px
- left area: All Live / On Demand / Regular Load / Daily Hire as 32px tabs
- right area: result count / Expand All / List / Map
- all toolbar controls 32px

Load record:
- collapsed 92px
- primary 60px
- footer 32px
- grid:
  `minmax(360px,1.35fr) minmax(280px,1fr) minmax(260px,.90fr)`
- column 1: route + distance/reference
- column 2: pickup/delivery
- column 3: description/vehicle/budget/quote state
- footer: expand toggle + Quote + Details/member action
- expanded detail padding 10px
- expanded grid `repeat(4,minmax(170px,1fr))`, gap 8px

Empty: 64px.
Pagination: 36px.

Won Work uses canonical table geometry, not a separate 40px legacy table.

## 21.7 Quotes — /admin/exchange-quotes

Vertical order:

1. CarrierPageHeader — 78px
2. 8px gap
3. board grid 220px + 12px + main

Rail:
- Pickup Time Within
- Delivery Time Within
- Load ID / Ref
- Booked By
- Search / Clear
- width 220px
- controls 32px

Main:
- status tabs 32px:
  All / Submitted / Accepted-Won / Unsuccessful / Archived
- register toolbar 40px
- Expand All control 32px

Quote record:
- 92px collapsed
- primary 60px
- footer 32px
- grid:
  `minmax(360px,1.35fr) minmax(280px,1fr) minmax(200px,.65fr)`
- route/reference
- poster + pickup/delivery
- amount + state
- expanded detail grid `repeat(4,minmax(170px,1fr))`
- expanded padding 10px
- footer includes Updated timestamp and Withdraw when allowed

Empty state 64px.

## 21.8 Diary — /admin/diary

Vertical order:

1. CarrierPageHeader — 78px
2. 8px gap
3. board grid 220px + 12px + main

Rail exact order:
- Saved Views
- Save Current View
- Groups
- Booking Scope
- From
- To
- Pickup Time Within
- Delivery Time Within
- Load ID / Ref
- Customer Name
- remaining current filters in existing order
- 220px width
- controls 32px

Main:
- toolbar 40px:
  - result count
  - List View / Split View
  - Items per Page
  - pagination
  - Refresh
- status tabs 32px:
  All / Unallocated / Allocated / In Progress / Completed / Cancelled / Expired / Awaiting Feedback / Recent Feedback / POD-Evidence

List record:
- 92px collapsed
- primary 60px
- footer 32px
- grid:
  `minmax(360px,1.35fr) minmax(280px,1fr) minmax(260px,.90fr)`
- Route / Pickup-Delivery / Status-Vehicle-Evidence
- footer contains expand, allocation, groups and contextual actions
- no separate 28px metadata bars on collapsed state

Split View:
- list/detail grid:
  `minmax(360px,.82fr) minmax(520px,1.18fr)`
- gap 8px
- detail panel uses CarrierPanel
- at <=1199px split stacks vertically

Zero bookings:
- 64px empty state only
- no blank register panel filling the viewport

## 21.9 Freight Vision — /admin/freight-vision

Vertical order:

1. CarrierPageHeader — 78px
2. CarrierSignalStrip — 56px
3. 8px gap
4. filter panel — 88px
5. 12px gap
6. shared map/register split — 326px
7. selected-job detail/timeline — 12px gap when present

Signals exactly 6:
1. Active Jobs
2. On Time
3. Behind ETA
4. Late
5. Not Tracking
6. Not Started

Filter panel:
- header 36px
- body 50px
- grid:
  `minmax(260px,1fr) minmax(260px,1fr) minmax(260px,1fr) minmax(260px,1fr)`
- Pickup / Delivery / ETA-Tracking State / Job Status
- gap 8px

Map/Register:
- same primitive and dimensions as Live Availability
- map body 280px
- exception register body 280px
- register table 36/44
- no X icon

Selected job summary:
- 4-column desktop grid
- gap 8px
- card padding 10px

Tracking Timeline:
- CarrierPanel
- header 44px
- table 36/44

## 21.10 Drivers & Vehicles — /admin/fleet/resources

Vertical order:

1. CarrierPageHeader — 78px
2. local tabs — 32px
3. 8px gap
4. CarrierSignalStrip — 56px
5. 8px gap
6. Resource Filters — 88px
7. 12px gap
8. Fleet Resource Register
9. 12px gap
10. Company Vehicles
11. 12px gap
12. resource attention/details when present

Tabs:
Resources / Drivers / Vehicles / Vehicle Tracking / Live Availability / Return Journeys

Signals exactly 6:
1. Drivers
2. Vehicles
3. Live Tracking
4. Advertised
5. Future Declared
6. Needs Attention

Resource Filters:
- header 36px
- body 50px
- desktop grid:
  `minmax(360px,2fr) minmax(220px,1fr) minmax(220px,1fr) 180px`
- Search / Availability / Tracking / Needs Attention only
- gap 8px
- controls 32px

At <=1199px:
- 2 columns

At <=768px:
- 1 column

Registers:
- panel header 44px
- table header 36px
- row 44px
- action 28px
- warning badges 22px
- gap between panels 12px

---

# 22. Shared component ownership after implementation

## TopWorkspaceShell.tsx
Owns only:
- global header
- primary nav
- global workspace actions
- More menu

## WorkspaceUI / Carrier additions
Must own:
- CarrierPageFrame
- CarrierPageHeader
- CarrierPanel
- CarrierToolbar
- CarrierFilterRail
- CarrierTabStrip
- CarrierViewToggle
- CarrierTable
- CarrierOperationalRecord
- CarrierEmptyState
- CarrierActionGroup

## OperationalConvergence
Must own:
- CarrierSignalStrip or a strict Carrier mode of OperationalSignalStrip
- shared map/register split

## Page components
Must own only:
- data selection
- permission logic
- page-specific content order
- business actions

They must not define new geometry tokens.

---

# 23. Required code migrations

## CarrierOperationsDashboardHome.tsx
- remove custom CarrierControlSignals implementation
- replace with CarrierSignalStrip
- move inline panel/row geometry to shared classes
- use CarrierPageFrame + CarrierPageHeader
- keep workboard logic unchanged

## FleetControlDashboardHome.tsx
- replace custom wrapper with CarrierPageFrame
- remove Connected workspace duplicate-nav card
- reduce 7 signals to 6
- use CarrierPageHeader
- use canonical tables/toolbars

## live-availability/page.tsx
- replace custom tabStyle/inputStyle/labelStyle geometry with shared Carrier primitives
- use shared map/register split
- CarrierEmptyState only

## freight-vision/page.tsx
- same geometry as Live Availability
- remove page-specific grid values where shared primitive can express them

## fleet/resources/page.tsx
- migrate 34px/28px local nav variants to 32px
- migrate filters to exact Resource Filters grid
- canonical table/actions/status badge geometry

## fleet/returns/page.tsx
- remove legacy workspace-board visual dependency
- preserve functionality
- migrate to CarrierFilterRail, CarrierTabStrip, CarrierOperationalRecord

## CompanyMarketplaceExchange.tsx
- preserve Loads and Quotes business logic
- replace 28px tabs, 30px advanced button, 34px local bars, 26px expand controls and ad-hoc records with Carrier primitives
- Won Work uses canonical CarrierTable

## OperationsDiaryPage.tsx
- replace legacy rail/panel/record geometry
- keep saved views, groups, lifecycle, split view, allocation, feedback and modal logic
- collapse record anatomy to canonical 92px

## MemberDirectoryPage.tsx
- Carrier mode uses one H1 from route wrapper only
- remove Carrier desktop table mode
- use canonical operational record
- preserve filters/reliability/privacy/direct booking logic

---

# 24. Interaction contract

Buttons:
- hover transition 120ms ease-out
- no scale/bounce
- no decorative shadow

Inputs:
- focus 2px #1D57D8, offset -1px
- disabled background #F4F6F8
- disabled text #94A3B8

Rows:
- hover #F1F6FF
- selected #E8F0FF

Keyboard:
- DOM/tab order follows visual order
- no positive tabIndex
- Enter activates button/link
- Space activates button/toggle
- Escape closes modal/popover
- focus returns to trigger after close

Motion:
- normal transition 120ms ease-out
- modal backdrop maximum 150ms
- `prefers-reduced-motion` disables non-essential transitions

Sticky:
- header top 0
- nav top 50
- filter rail top 102
- no Carrier sticky element may use a top offset between 1 and 101px

---

# 25. Accessibility contract

Every page:
- exactly one H1
- labelled filters
- meaningful button text
- icon-only buttons require aria-label
- tabs use tab semantics where appropriate
- view toggles use aria-pressed or tabs
- status is never communicated by colour alone
- focus-visible state always present
- no inaccessible click-only divs
- WCAG AA text contrast

---

# 26. Implementation order — mandatory

Do not implement all pages simultaneously.

1. Shared Carrier primitives and tokens
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
12. full Carrier visual-regression pass

Do not move to another role until step 12 is complete.

---

# 27. Visual verification matrix

Every page must be captured at:

- 1920×1080
- 1440×900
- 1280×800
- 1024 tablet
- 768
- 390 mobile

Pages:
- Dashboard
- Directory
- Live Availability
- My Fleet
- Return Journeys
- Loads
- Quotes
- Diary
- Freight Vision
- Drivers & Vehicles

Total required Carrier visual fixtures: **60**.

---

# 28. Numeric acceptance tolerances

A Carrier implementation is accepted only when:

- fixed width/height tokens differ by 0px in computed CSS;
- screenshot rasterisation tolerance is ±2px at edges;
- page horizontal overflow is exactly 0px at 1920, 1440, 1280 and 1024;
- grid gaps differ by no more than 0px in computed style;
- typography size/line-height/weight matches the contract exactly;
- all standard controls are 32px;
- all row actions are 28px;
- all Carrier tabs are 32px;
- all Carrier table headers are 36px;
- all normal table rows are 44px;
- all Carrier panel headers are 44px;
- all signal cells are 56px;
- all desktop rail layouts use 220px rail width;
- all list empty states are 64px;
- all map bodies are 280px;
- collapsed board records are 92px on desktop.

Any deliberate deviation requires this document to be amended before merge.

---

# 29. Test/gate requirements

Existing gates:
- TypeScript
- ESLint
- full Vitest
- production build
- Semgrep local SAST
- Visual Fixture Gate

Add:
- `__tests__/carrierVisualConsistencyContract.test.ts`

Contract test must assert:
- canonical Carrier primary nav order unchanged;
- all ten pages use approved Carrier wrapper/primitives;
- no page-specific global navbar;
- no decorative X empty state in Carrier;
- no 26px/30px/34px Carrier buttons/tabs;
- no legacy Carrier rail sticky top 50px;
- max 6 Carrier signals;
- My Fleet has 6 signals;
- no Carrier Directory 1280px table mode;
- no duplicate Directory H1;
- Loads/Quotes/Diary/Returns use CarrierFilterRail;
- Live Availability and Freight Vision use same map/register split;
- no page-level overflow fixture at target desktop widths.

---

# 30. Definition of done

Carrier is complete only when:

1. all ten pages visually read as one product family;
2. shell/header/nav are identical across the ten pages;
3. identical semantic components use identical dimensions;
4. there are no arbitrary page-local geometry values;
5. no large blank empty-state areas remain;
6. no decorative X placeholder remains;
7. all rails, tabs, buttons, tables, records, panels and maps follow this contract;
8. all 60 visual fixtures are reviewed;
9. contract tests pass;
10. TypeScript passes;
11. ESLint passes;
12. full Vitest passes;
13. production build passes;
14. SAST passes;
15. Netlify preview is inspected page-by-page;
16. only after those checks may the Carrier branch be merged to main.

---

# 31. Non-interpretation rule

If an implementation agent encounters a visual choice not explicitly covered here, the agent must not invent a new Carrier pattern.

The agent must:
1. first reuse the closest existing Carrier primitive defined by this document;
2. if no primitive applies, stop and amend this blueprint with an exact numeric contract;
3. only then implement the new element.

This rule exists specifically to prevent unreviewed spacing, heights, widths, typography, cards, grids or interaction patterns from entering Carrier.
