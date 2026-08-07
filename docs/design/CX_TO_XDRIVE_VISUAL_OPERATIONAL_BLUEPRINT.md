# XDrive Logistics — Visual & Operational Blueprint

## Courier Exchange principles translated into the XDrive design system

**Status:** Mandatory implementation specification  
**Audience:** Lead Architect, Frontend Engineers, Supabase Engineers, QA, Security Reviewers, Copilot agents  
**Source material:** `public/reference/courier-exchange/**` and owner-provided Courier Exchange screenshots  
**Important:** Courier Exchange images are reference-only. They must never be shipped as production assets and must not be copied pixel-for-pixel.

---

## 1. Objective

XDrive must adopt the operational clarity, density, information hierarchy and workflow speed visible in Courier Exchange while retaining a distinct XDrive identity.

The target is not a generic SaaS dashboard and not a card gallery. The target is a logistics control workspace where users can scan, filter, decide and act quickly.

The required outcome is:

> Courier Exchange operational principles implemented as a modern, accessible, responsive XDrive Logistics workspace.

---

## 2. Non-negotiable product principles

1. **Operations before decoration.** The main table, job list, map or queue must be visible without unnecessary scrolling.
2. **Information density without clutter.** Rows are compact, grouped and scannable; whitespace is purposeful, not excessive.
3. **One shared visual grammar.** Admin, broker, customer, driver and operations workspaces must feel like the same product.
4. **Exceptions first.** Delays, missing assignments, expiring documents, payment issues and compliance failures appear before decorative statistics.
5. **Actions live beside data.** Quote, allocate, track, view, approve, reject, contact and dispute actions must be available on the relevant row/card.
6. **No raw backend errors.** SQL, PostgREST, schema-cache and table names must never be exposed to users.
7. **No fake completeness.** Empty states must be compact and honest; large empty panels are prohibited.
8. **Role-safe by construction.** Shared components may be reused, but routes, actions and data must remain strictly role-scoped.

---

## 3. Reference-derived observations

### 3.1 Courier Exchange shell

The reference platform uses a dense application shell:

- narrow persistent navigation rail;
- compact horizontal navigation;
- page-level search/filter panel;
- results immediately beside filters;
- persistent action areas;
- minimal decorative spacing;
- tables and operational records dominate the viewport.

XDrive must modernise this model, not replace it with tall dashboard cards.

### 3.2 Courier Exchange listings

Load and return-journey records are structured as compact operational cards/rows containing:

- origin and destination;
- pickup and delivery timing;
- vehicle/body type;
- posting company/member;
- load identifier;
- status and service type;
- primary action;
- secondary detail/contact action.

The user can inspect several records in one viewport. XDrive must preserve this scanning efficiency.

### 3.3 Courier Exchange search panels

Reference search areas include combinations of:

- origin/destination;
- radius;
- region;
- vehicle size/body type;
- date range;
- availability state;
- member/driver;
- saved/default searches;
- groups;
- live/future tabs;
- quick search presets.

XDrive must expose equivalent workflow categories through a modern `OperationalFilterRail` or compact toolbar/drawer.

### 3.4 Maps and tracking

Map-based screens pair the map with:

- filter rail;
- state legend;
- result list/table;
- live/future toggle;
- availability or ETA metrics;
- contextual actions.

A map alone is not a complete operational screen.

### 3.5 Dashboard structure

Courier Exchange dashboards prioritise:

- recent bookings/work;
- financial shortcuts;
- reports;
- compliance;
- operational activity;
- supplier/driver status.

XDrive must retain these priorities but use the XDrive palette, modern typography and accessible components.

---

## 4. XDrive canonical visual identity

### 4.1 Colours

Use only the canonical XDrive palette unless a documented semantic colour is required:

- Primary Navy: `#0B2F6B`
- Royal Blue: `#1D57D8`
- Brand Orange: `#F5A300`
- White: `#FFFFFF`
- Charcoal: `#1A1F2B`
- Light Grey: `#F4F6F8`

Semantic colours:

- success: accessible green;
- warning: accessible amber/orange;
- danger: accessible red;
- informational: Royal Blue;
- neutral/unknown: controlled grey.

No role may invent its own palette.

### 4.2 Typography

Canonical desktop scale:

- workspace title: 24–30 px, 650–750 weight;
- page title: 20–24 px, 650–700 weight;
- section title: 15–18 px, 600–700 weight;
- table header: 11–12 px, 650–700 weight, compact tracking;
- primary row text: 13–14 px, 500–650 weight;
- secondary row text: 11–12 px, 400–500 weight;
- metadata/badge text: 10–11 px, 600–700 weight;
- form controls: 13–14 px.

Prohibited:

- oversized hero typography inside authenticated workspaces;
- tiny unreadable metadata;
- arbitrary font sizes per dashboard;
- inconsistent line heights.

### 4.3 Spacing

Canonical spacing tokens:

- 4 px: micro gap;
- 8 px: compact gap;
- 12 px: control/row gap;
- 16 px: section gap;
- 24 px: major page separation;
- 32 px: exceptional large separation only.

Authenticated workspaces must not use large marketing-style whitespace.

### 4.4 Radius and elevation

- controls: 6–8 px radius;
- panels: 8–10 px radius;
- tables/list containers: 8–10 px radius;
- KPI strip items: 8 px radius;
- no pill-shaped containers for ordinary content;
- shadows must be subtle and consistent;
- borders carry most structural separation.

---

## 5. Canonical workspace shell

### 5.1 Desktop

- sidebar: 260–280 px, canonical target 268 px;
- compact header: 56–64 px, canonical target 60 px;
- activity/ticker: compact, non-overlapping and optional by role;
- workspace context always visible;
- organisation switcher where authorised;
- search/navigation shortcut;
- notifications;
- distinct Action Centre;
- primary action relevant to role.

### 5.2 Tablet

- collapsible sidebar or compact navigation drawer;
- header actions remain reachable;
- filter rail collapses into a drawer;
- tables preserve horizontal scroll without body overflow;
- no hidden critical actions.

### 5.3 Mobile

- navigation drawer;
- sticky compact header;
- list/card adaptation for tables;
- one primary action visible;
- secondary actions in overflow menu;
- filters open as full-width sheet/drawer;
- no ticker animation that obscures content.

---

## 6. Canonical page hierarchy

Every primary operational page must follow this order:

1. `WorkspacePageHeader`
2. `OperationalToolbar`
3. optional compact `ExchangeKpiStrip` with 4–6 metrics
4. primary table/list/map immediately visible
5. exception/action queue
6. secondary reports and supporting panels below the fold

Do not place large dashboard cards above the main work surface.

---

## 7. Canonical shared components

The following components are mandatory shared primitives rather than local copies:

- `WorkspacePageHeader`
- `OperationalToolbar`
- `OperationalFilterRail`
- `OperationalTable`
- `OperationalRecordCard`
- `ExchangeKpiStrip`
- `StatusBadge`
- `ActionCell`
- `WorkspaceActivityFeed`
- `QuickActionGrid`
- `FinancialSummaryPanel`
- `ComplianceSummaryPanel`
- `DateRangeSelector`
- `SavedViewSelector`
- `MapWorkspace`
- `CompactEmptyState`
- `OperationalErrorState`

Each primitive must have:

- CSS Module or canonical token styling;
- responsive contract;
- keyboard accessibility;
- loading, empty and error states;
- automated tests;
- visual fixture coverage.

---

## 8. Tables and operational records

### 8.1 Density

Desktop row heights:

- compact: 40–44 px;
- standard: 48–56 px;
- expanded operational record: maximum 96–120 px.

The current very tall Jobs rows with stacked mini-cards inside one cell are prohibited. Metadata should be displayed as aligned inline fields, compact chips, a detail drawer or expandable row.

### 8.2 Required behaviour

- sticky header;
- sortable columns;
- search and filters;
- saved views;
- results count;
- pagination or virtualisation;
- hover/focus state;
- row selection where useful;
- semantic statuses;
- consistent action column;
- responsive overflow contained inside the component;
- expandable details without destroying scan density.

### 8.3 Job row model

Recommended columns:

- Job Ref
- Client / Posting Company
- Route
- Pickup
- Delivery
- Vehicle
- Distance
- Price / Quote state
- Assignment
- Status
- Age / Created
- Actions

Secondary metadata belongs in an expandable details section, not five vertically stacked boxes.

---

## 9. Dashboard-specific requirements

### 9.1 Company Owner / Operations

Above the fold:

- page header and New Job/Post Load;
- exception strip;
- only role-relevant, decision-driving KPIs above the fold;
- operations table or latest jobs immediately visible.

Below the fold:

- recent activity;
- due payments;
- gross margin/subcontract spend;
- compliance issues;
- driver/fleet readiness.

The page must behave as a control desk, not a collection of promotional cards.

### 9.2 Broker

Primary surfaces:

- marketplace/load search;
- quotes requiring action;
- awarded work;
- subcontract spend;
- due for payment;
- exceptions/disputes.

The broker dashboard must maximise records per viewport and place quote actions beside each load.

### 9.3 Customer

Primary surfaces:

- quote requests;
- active shipments;
- ETA/tracking;
- delivered/POD;
- invoices and exceptions.

Customer screens must not expose broker/admin controls.

### 9.4 Driver

The driver dashboard must be action-first:

- current/next assigned job;
- next required status transition;
- route/timing/contact;
- availability;
- documents/compliance alerts;
- compact completed-work history.

Large empty cards are prohibited. When there is no job, use a compact empty state and show useful secondary actions.

### 9.5 Platform Owner / Super Admin

The owner console must prioritise:

- approval queues;
- system health;
- operational exceptions;
- compliance/fraud cases;
- active jobs requiring intervention;
- finance anomalies;
- platform activity.

A grid of links is not a sufficient owner console.

All current raw errors such as missing tables/columns must be replaced by controlled capability states and resolved migrations.

---

## 10. Marketplace / Load Exchange

The marketplace must use the reference principles:

- compact filter rail or toolbar;
- tabs for live/on-demand/regular/daily-hire equivalents where supported;
- saved searches;
- origin/destination radius;
- vehicle/body type;
- timing;
- job/load type;
- posting company/member;
- quote and view-details actions;
- dense record list;
- optional map/list split.

Each load record should expose enough information to decide whether to quote without opening a full page.

XDrive branding must replace Courier Exchange colour and brand patterns.

---

## 11. Fleet, availability and return journeys

### 11.1 Fleet

The canonical fleet table should include:

- vehicle/driver;
- size/body type;
- operational state;
- current/last tracked location;
- future position;
- future journey;
- advertising visibility;
- tracking notification;
- actions.

### 11.2 Live availability

Required layout:

- map;
- filters;
- legend;
- result table/list;
- live/future tabs;
- availability state;
- timestamp freshness;
- click-through to driver/vehicle.

### 11.3 Return journeys

Required record model:

- origin/destination;
- departure/ETA;
- vehicle/body;
- available capacity/weight;
- distance;
- posting member/company;
- track/contact/book-direct actions where authorised.

---

## 12. Tracking / Freight Vision equivalent

A tracking workspace must combine:

- map;
- job list;
- ETA states;
- on-time / behind ETA / late / not tracking metrics;
- pickup and delivery time filters;
- event timeline;
- driver/vehicle contact;
- clear exception handling.

It must not be a static map with no operational list.

---

## 13. Form and profile design

Dense operational forms should use:

- logical sections;
- two- or three-column layout on desktop;
- single column on mobile;
- verified/read-only visual states;
- inline validation;
- unsaved changes warning;
- no raw database terminology;
- clear save/review workflow.

Company, vehicle, driver and compliance profiles must share the same form grammar.

---

## 14. Error, empty and unavailable states

### 14.1 Prohibited output

Never display messages such as:

- `column ... does not exist`;
- `Could not find table ... in schema cache`;
- raw Supabase/PostgREST errors;
- stack traces;
- SQL identifiers.

### 14.2 Required behaviour

Use:

- friendly user message;
- correlation/reference ID;
- retry action;
- support/action-centre link;
- server-side logging;
- capability unavailable state if migration has not been applied.

### 14.3 Empty states

Empty states must be compact (typically 80–160 px), explain what will appear, and provide one useful action. Empty states must not consume half the screen.

---

## 15. Data integrity observations from production screenshots

The following visible issues require separate functional remediation and must not be hidden by styling:

- Jobs displaying `Unknown` for client/company;
- account-to-company linkage failures;
- notification query referencing missing `notification_events.last_error`;
- missing `fraud_review_cases` capability/table;
- missing `platform_settings` capability/table;
- visual-audit fixture/test companies visible in production company lists.

Each issue requires root-cause analysis, migration/data repair or query correction, role-safe access tests and production-safe cleanup planning.

---

## 16. Visual acceptance criteria

For every affected role and page:

- reference image(s) identified;
- XDrive screenshot produced at 1440×900, 768×1024 and 390×844;
- primary operational surface visible above the fold;
- no body-level horizontal overflow;
- no overlapping shell elements;
- no raw errors;
- no role leakage;
- KPI quantity must stay role-driven and non-duplicative above the fold;
- empty states compact;
- table row density compliant;
- canonical XDrive colours and type scale used;
- keyboard and screen-reader checks completed.

A test that only checks component existence does not satisfy visual acceptance.

---

## 17. Implementation phases

### Phase 0 — Production defect containment

- repair raw schema/table/column errors;
- repair user-company relationships and `Unknown` records;
- identify and isolate visual fixture/test data in production;
- add safe error boundaries and capability states.

### Phase 1 — Shared visual system

- finalise tokens;
- rebuild shared shell;
- implement shared table, filter rail, record card and compact empty states;
- remove duplicated local styles.

### Phase 2 — Operations and marketplace

- redesign Jobs;
- redesign Marketplace/Loads;
- redesign Quotes and Won Work;
- implement table/list density and saved filters.

### Phase 3 — Driver and fleet

- driver action-first dashboard;
- fleet table;
- live availability map/list;
- future positions and return journeys.

### Phase 4 — Owner, finance and compliance

- owner exception console;
- finance operational panels;
- approvals, fraud/compliance and system health;
- analytics with useful filters and drill-down.

### Phase 5 — Tracking and final certification

- tracking/Freight Vision equivalent;
- authenticated visual regression matrix;
- accessibility audit;
- performance audit;
- final role-by-role review.

---

## 18. Copilot execution rules

Copilot must:

1. read this document and `public/reference/courier-exchange/README.md` before coding;
2. inspect the relevant reference screenshots before changing a page;
3. state which reference principles are being translated;
4. preserve XDrive branding;
5. work incrementally in a Draft PR;
6. avoid Production SQL and Production data changes;
7. add tests and visual evidence;
8. stop and report missing infrastructure honestly;
9. never claim visual PASS from static source tests alone;
10. request owner review before merge.

---

## 19. Definition of done

The programme is complete only when:

- all major workspaces use the same design grammar;
- operational records dominate the viewport;
- core workflows match the reference efficiency;
- XDrive retains its own visual identity;
- production shows no raw backend errors;
- role isolation and tenant isolation pass;
- all responsive screenshots are reviewed;
- CI, E2E, security, migration and visual gates are green;
- Platform Owner explicitly authorises merge.
