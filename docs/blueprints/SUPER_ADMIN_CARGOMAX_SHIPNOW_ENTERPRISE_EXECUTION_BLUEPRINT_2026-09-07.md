# XDrive Super Admin - CargoMax + ShipNow Enterprise Execution Blueprint

**Date:** 2026-09-07
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`
**Canonical production site:** `https://www.xdrivelogistics.co.uk`
**Canonical contract:** `docs/super-admin/MASTER_CONTRACT_FINAL.md` - MASTER CONTRACT FINAL v3
**Primary implementation branch:** `feat/super-admin-cargomax-v3-20260907`
**Architecture benchmark:** CargoMax - Shipping & Logistics Admin Dashboard
**Licensed design asset:** ShipNow - Shipping Management Dashboard UI Figma
**Purpose:** canonical execution blueprint for the XDrive Super Admin enterprise transformation.

---

## 0. Mission

Transform the existing XDrive Super Admin into a single, coherent, professional logistics control system.

The finished product must combine:

- CargoMax-level information architecture, operational density and logistics-dashboard maturity;
- ShipNow-level visual system discipline, reusable UI patterns, responsive composition and polished management surfaces;
- XDrive-native terminology, brand identity, data, authorization, auditability and business logic.

The result must not feel like a reskinned template. It must feel like XDrive's own Platform Owner operating system.

The transformation is successful only when the Platform Owner can immediately understand what is happening across Jobs, Marketplace, Fleet, Drivers, Companies, Finance, Compliance, Support and Platform Governance without leaving `/super-admin`.

---

## 1. Source-of-truth state at this blueprint revision

At the start of this combined CargoMax + ShipNow blueprint:

- verified `main`: `73deceeb5055d6b0c6e47c44cf5d0cedae114b4b`;
- MASTER CONTRACT FINAL v2 has been superseded and cancelled;
- MASTER CONTRACT FINAL v3 is canonical;
- v3 contract commit: `7bac869c80db88842bf76d074a1d1814408c0e16`;
- clean implementation workstream: `feat/super-admin-cargomax-v3-20260907`;
- current implementation worktree: `C:\Users\Danny\xg-super-admin-v3`;
- Phase 1 has started but is not yet complete;
- currently changed Phase 1 files are `SuperAdminWorkspaceShell.tsx` and a new partial `SuperAdminSidebar.tsx`;
- no Production deploy has been performed for this transformation;
- no Production DB migration has been performed for this transformation.

### Baseline validation truth

A clean detached worktree on exact `main` was used as baseline.

- `npm ci`: PASS;
- `npm run typecheck`: PASS;
- selected Super Admin regression run: 7/10 test files PASS, 3/10 FAIL;
- selected Super Admin regression run: 68/76 tests PASS, 8/76 FAIL.

Those 8 failures existed on the baseline before the CargoMax + ShipNow shell implementation and must not be falsely attributed to this transformation.

Before release, each baseline failure must be classified as one of:

1. superseded v2 visual contract assertion;
2. real pre-existing regression that still requires correction;
3. obsolete checker requiring v3 replacement.

---

## 2. Design and licensing authority

### 2.1 CargoMax role

CargoMax is an architecture and UX benchmark only.

Use it for:

- domain-grouped logistics navigation;
- persistent sidebar behavior;
- compact operational top bar;
- dashboard hierarchy;
- KPI density;
- map / fleet / shipment / exceptions composition;
- quick-action placement;
- activity and alert presentation;
- logistics-specific page grouping;
- overall professional polish target.

Do not copy:

- CargoMax source code;
- CSS or component implementation;
- proprietary images or illustrations;
- logos or branding;
- exact text;
- exact icon composition;
- exact page composition pixel-for-pixel.

### 2.2 ShipNow role

ShipNow is a licensed Envato Elements design asset registered for the XDrive Logistics Super Admin End Product.

The supplied package contains:

- the original `.fig` design file;
- the asset documentation PDF;
- design resources embedded in the Figma package.

ShipNow documentation confirms a centralized design approach with reusable text styles and color styles. Translate that discipline into XDrive rather than importing ShipNow's visual identity unchanged.

Use ShipNow for:

- component proportions and spacing inspiration;
- responsive dashboard composition;
- table, list, card and management-surface patterns;
- shipment/tracking/fleet/driver/invoice visual references;
- hierarchy between page header, metrics, filters and data surfaces;
- reusable style-system thinking;
- visual consistency across desktop/tablet-oriented layouts.

Do not automatically adopt:

- ShipNow branding;
- ShipNow product names;
- ShipNow demo company/data;
- ShipNow source images unless their licensing/source is separately suitable for production;
- ShipNow's original font as the XDrive canonical font;
- ShipNow's original colors as the XDrive canonical palette.

### 2.3 License evidence handling

The license certificate and license code are evidence, not application source.

Rules:

- do not commit the certificate into the public application repository unless explicitly required;
- do not commit or expose the Envato item license code;
- do not embed licensee personal details in UI or source comments;
- keep implementation within the Envato Elements terms applicable to the registered End Product;
- if an asset has its own third-party restriction, verify it before production use.

---

## 3. MASTER CONTRACT v3 relationship

`docs/super-admin/MASTER_CONTRACT_FINAL.md` is the sole canonical Super Admin contract.

This combined blueprint is the execution plan under that contract.

If this blueprint and the contract appear to conflict:

1. stop the conflicting implementation;
2. inspect the exact contract wording;
3. amend the contract deliberately if the user has approved the change;
4. never silently violate the contract.

The cancelled MASTER CONTRACT FINAL v2 is historical evidence only and must not be used as an implementation target.

Any test that encodes v2-only shell constraints must be migrated to a v3 contract test before it can block release.

---

## 4. Non-negotiable platform rules

1. Do not restart the Super Admin audit from zero.
2. Preserve all merged Super Admin control-plane functionality.
3. Preserve Platform Owner authorization semantics.
4. `/super-admin` is the cross-company Platform Owner control plane.
5. Do not grant Platform Owner implicit tenant-workspace impersonation.
6. Do not redirect owner oversight into `/broker`, `/customer`, `/driver` or tenant `/admin` workspaces.
7. Keep canonical entity inspection inside the Platform Entity Inspector.
8. Preserve `verifyPlatformOwner` or the current canonical active-owner verification boundary on privileged server routes.
9. Never expose Supabase service-role credentials to the browser.
10. Missing data must be unavailable/unknown, never silently zero/healthy.
11. Exact totals must remain exact when labelled platform-wide.
12. Page-local totals must be labelled page-local.
13. Never silently aggregate incompatible currencies as GBP.
14. Preserve auditability and rollback/fail-closed behavior for existing mutations.
15. Deploy Preview remains read-only where the repository currently enforces that rule.
16. Secure Load first release remains read-only.
17. Do not introduce automatic suspensions, refunds, payouts, payment mutations, compliance overrides or job cancellation.
18. Do not introduce a second auth system.
19. Do not remove existing functional routes merely to simplify the navigation.
20. Do not fabricate KPI values, charts, trends, alerts, map pins or operational states.
21. Do not redesign Driver, Customer, Broker or tenant Admin as collateral work.
22. Do not modify PR #502, PR #510 or PR #515 in this workstream.
23. Do not use GitHub Actions as validation evidence unless the user explicitly changes that rule.
24. Do not deploy Production until the exact-head preview, authenticated E2E and user visual acceptance gates pass.
25. Do not run Production DB migrations for visual work.

---

## 5. Target information architecture

The primary sidebar must expose the following domains in this order.

### COMMAND

- Command Centre
- Action Centre
- Live Operations Map
- Global Search
- Platform Analytics

### MARKETPLACE & JOBS

- Live Marketplace
- All Jobs
- Active Jobs
- Pending Jobs
- Completed Jobs
- Quotes
- Allocations
- Disputes

### SECURE OPERATIONS

- Secure Loads
- Jobs at Risk
- Tracking & ETA
- POD Queue
- Delivery Evidence

### FLEET

- Drivers
- Driver Availability
- Vehicle Registry
- Fleet Positions
- Return Journeys
- Fleet Compliance Status

### COMPANIES

- All Companies
- Brokers
- Membership & Access
- Pending Approval
- Active Companies
- Suspended Companies
- Verification
- Company Compliance

### FINANCE

- Finance Overview
- Invoices
- Payments
- Revenue
- Membership Subscriptions
- Stripe / Webhooks
- Financial Breakdown

### COMPLIANCE

- Compliance Overview
- Identity & Fraud Review
- Insurance
- Operator Licences
- Expiry Tracking
- Document Review

### SUPPORT

- Support Tickets
- Complaints
- Support Disputes

### PLATFORM

- Users & Access
- Roles & Permissions
- Notifications
- Platform Health
- Audit Logs
- Global Settings
- Legal & Agreements
- Feature Flags

### Route truth rule

Do not create dead navigation simply to match the target IA.

If a target destination does not yet have a canonical route:

- use an existing closest canonical destination temporarily when semantically correct; or
- omit the final clickable item until its phase creates the route;
- never point users to a fake or placeholder production page.

---

## 6. Enterprise shell specification

### 6.1 Sidebar

Create a reusable `SuperAdminSidebar`.

Required behavior:

- persistent desktop sidebar;
- expanded state with icon + label;
- collapsed state as icon rail;
- one consistent Lucide icon family;
- active destination visibly distinct;
- active domain visibly distinct;
- independent vertical scrolling for shorter screens;
- no emoji/glyph navigation in final production;
- XDrive brand block at top;
- tooltip/accessible label for collapsed icons;
- keyboard reachable links;
- no hidden critical destination;
- collapse preference may be client-local UI state only; it must not affect authorization.

### 6.2 Top bar

Create a reusable `SuperAdminTopbar`.

Required contents:

- sidebar toggle;
- Global Platform Search;
- Action Centre access;
- notification access with verified count only if source truth is available;
- optional Platform Overview entry if still useful after sidebar convergence;
- Platform Owner menu;
- sign-out;
- authenticated identity where a canonical value exists;
- no hard-coded private user identity when canonical auth context can provide it.

### 6.3 Main canvas

Create one `SuperAdminEnterpriseShell` behavior used by all Super Admin routes.

Main canvas rules:

- standard content gutter;
- wide operational screens may use wider content bounds;
- maps and dense data grids can go full-width inside the Super Admin canvas;
- page bodies must not be hidden behind fixed shell elements;
- deep pages retain visible domain context;
- horizontal overflow must be intentionally confined to data-grid containers, not the whole page.

### 6.4 Responsive behavior

Desktop is primary, but v3 is responsive.

- >= 1280: full enterprise sidebar available;
- medium widths: collapsed sidebar allowed;
- small widths: sidebar becomes an accessible drawer/overlay;
- no critical navigation is removed;
- no desktop-only route becomes inaccessible on smaller screens;
- tables may scroll horizontally inside their own container;
- maps require accessible tabular fallback where applicable.

---

## 7. XDrive visual system - CargoMax maturity + ShipNow discipline

### 7.1 Brand

Use XDrive identity, not template identity.

Primary visual direction:

- XDrive navy / blue as structural identity;
- restrained orange as action/accent color;
- white/light neutral surfaces;
- dark text with strong contrast;
- operational status colors reserved for status meaning.

### 7.2 Status semantics

- green = verified / healthy / complete;
- yellow = review / attention;
- red = blocked / critical;
- grey = unavailable / inactive / unknown where appropriate;
- blue = neutral active / informational state.

Never use decorative colors that contradict canonical status meaning.

### 7.3 Typography

Use Inter as XDrive's canonical Super Admin UI font unless MASTER CONTRACT v3 is deliberately revised.

ShipNow's documented font choice is not automatically adopted.

Typography hierarchy should be tokenized and centralized rather than repeated inline page by page.

### 7.4 Geometry

- default radius: 8px;
- subtle consistent shadows;
- dense data tables target approximately 44-52px row height where practical;
- metric cards compact enough to support up to eight first-class KPIs;
- generous section spacing without bloated row padding;
- clear page title hierarchy;
- compact status chips;
- controls maintain visible focus states.

### 7.5 Design tokens

Create v3 tokens for at minimum:

- sidebar widths expanded/collapsed;
- topbar height;
- content gutter;
- page max width / operations max width;
- card radius;
- shadow;
- borders;
- brand colors;
- status colors;
- typography sizes/weights;
- dense table row height;
- spacing scale;
- focus ring.

Do not keep v2 variable names such as `--sa-v2-*` as the canonical v3 API.

---

## 8. Core reusable components

Build these before mass page rewrites:

- `SuperAdminEnterpriseShell`
- `SuperAdminSidebar`
- `SuperAdminTopbar`
- `SuperAdminPageHeader`
- `SuperAdminMetricCard`
- `SuperAdminMetricGrid`
- `SuperAdminSectionCard`
- `SuperAdminStatusBadge`
- `SuperAdminDataGrid`
- `SuperAdminFilterBar`
- `SuperAdminQuickActions`
- `SuperAdminActivityFeed`
- `SuperAdminAlertPanel`
- `SuperAdminChartCard`
- `SuperAdminMapCard`
- `SuperAdminEmptyState`
- `SuperAdminUnavailableState`
- `SuperAdminEntityLink`

Rules:

- prefer composition over giant monolithic components;
- avoid a new one-off inline style system per page;
- keep data fetching separate from visual primitives;
- keep server-derived business state out of purely client-side styling helpers;
- support accessible loading, empty, error and unavailable states.

---

## 9. Command Centre target

`/super-admin` becomes the Platform Owner operations cockpit.

### Row A - Page header

- domain eyebrow;
- `Command Centre` title;
- concise platform-wide description;
- environment badge;
- last verified refresh time;
- Refresh action.

### Row B - Primary KPIs

Maximum eight first-class cards:

- Active Jobs;
- Jobs at Risk;
- Drivers Online;
- Fleet Ready;
- Compliance Blocks;
- Unpaid Exposure;
- Active Companies;
- Platform Incidents.

Every metric must have a canonical source definition.

A KPI source error must render unknown/unavailable, never zero.

### Row C - Live operations

- Live Operations Map / geographic picture;
- active jobs requiring attention / execution queue.

No fake map pins.

### Row D - Secure Operations

- Secure Loads state distribution;
- compliance blockers;
- jobs at risk;
- POD/evidence readiness;
- tracking evidence presence/freshness.

### Row E - Operational performance

Only use charts when real time-series data exists.

If only current totals exist, use cards instead of synthetic charts.

### Row F - Fleet state

Clearly distinguish:

- availability;
- allocation/busy state;
- compliance readiness;
- telemetry freshness;
- maintenance only where a canonical maintenance domain genuinely exists.

### Row G - Finance

Show canonical financial truth such as:

- invoiced;
- paid;
- unpaid;
- overdue;
- disputed;
- revenue where definition and currency are valid.

Do not silently aggregate currencies.

### Row H - Activity and alerts

- recent verified operational/admin activity;
- critical alerts;
- Action Centre items;
- safe quick actions.

---

## 10. Secure Operations / Secure Load

Secure Load is a first-class domain.

### 10.1 Existing canonical signals to reuse

- job cargo value;
- `High Value Goods` / special requirements;
- document checklist;
- direct-delivery requirement;
- POD requirement;
- POD evidence;
- assigned driver;
- canonical assigned vehicle;
- driver platform/onboarding/commercial eligibility;
- personal compliance;
- company active state and membership;
- vehicle MOT / insurance;
- tracking evidence;
- job documents;
- lifecycle evidence;
- disputes/invoices where relevant.

### 10.2 State model

- `CLEAR` - evaluated evidence contains no verified blocker;
- `REVIEW` - elevated requirements/signals require human review;
- `BLOCKED` - one or more verified blockers exist;
- `AWAITING ASSIGNMENT` - driver credentials cannot yet be evaluated because no driver is assigned;
- credential/source `UNAVAILABLE` must remain explicitly unavailable and must not become CLEAR.

### 10.3 Secure Loads page

Minimum ledger columns:

`Load | Route | Secure state | Credentials | Load signals | Tracking | POD | Documents | Posting company | Carrier | Created | Inspect`

Rows link to the canonical Job Inspector.

### 10.4 Job Inspector

Use the same server-side derivation as the Secure Loads overview.

Show:

- secure state;
- credential state;
- blockers;
- review signals;
- cargo value;
- direct-delivery requirement;
- requested/uploaded documents;
- driver eligibility;
- canonical vehicle/compliance;
- tracking evidence/freshness;
- POD requirement/evidence.

No duplicate client-side Secure Load business logic.

---

## 11. Data architecture

Preferred flow:

`Supabase canonical tables/RPC -> owner-verified server route/read model -> typed client component -> UI`

Never:

`browser -> service-role client`

Aggregate endpoint requirements:

- `refreshedAt`;
- `partialData` / unavailable context where applicable;
- explicit source/definition for ambiguous KPIs;
- exact totals when platform-wide;
- page-local labels when page-local;
- currency preservation;
- bounded pagination;
- no arbitrary hidden first-page caps presented as platform truth.

A failed refresh must not leave stale rows displayed as current without a visible stale/error indication.

---

## 12. CargoMax + ShipNow -> XDrive mapping

| Reference pattern | XDrive implementation |
| --- | --- |
| CargoMax dashboard overview | Command Centre |
| CargoMax live shipment map | Live Operations Map / Fleet Positions |
| CargoMax delayed shipments | Jobs at Risk |
| CargoMax fleet status | Fleet Overview / Vehicle Registry |
| CargoMax driver assignments | Allocations / Drivers |
| CargoMax vendors/clients | Companies / Brokers |
| CargoMax revenue analysis | Finance / Revenue |
| CargoMax audit logs | Platform Audit Logs |
| ShipNow shipment management composition | Jobs / Deliveries ledgers |
| ShipNow tracking composition | Tracking & ETA / Job Inspector |
| ShipNow fleet management patterns | Fleet / Vehicle / Driver pages |
| ShipNow driver management patterns | Drivers / Availability |
| ShipNow invoice/billing patterns | Finance / Invoices / Payments |
| ShipNow centralized text/color styles | XDrive v3 design tokens/components |
| ShipNow responsive layout discipline | XDrive shell/table responsiveness |

This mapping is functional/design guidance, not authorization to copy template text or demo data.

---

## 13. Mandatory execution phases

### Phase 0 - Baseline and protection

Status: substantially complete.

Required evidence:

- repo/branch/main SHA verified;
- MASTER CONTRACT v3 read;
- current-state document read;
- Super Admin routes/endpoints inventoried;
- baseline dependency install recorded;
- baseline TypeScript result recorded;
- baseline regression failures recorded separately from transformation regressions;
- no Production write/deploy.

Remaining Gate 0 item:

- baseline screenshots require authenticated access; if current browser session is logged out, do not fake the screenshot gate.

### Phase 1 - Enterprise shell

Status: IN PROGRESS.

Tasks:

1. finish `SuperAdminSidebar`;
2. replace glyph/emoji nav with Lucide mapping;
3. build `SuperAdminTopbar`;
4. build/reconcile `SuperAdminEnterpriseShell` behavior;
5. implement expanded/collapsed state;
6. implement responsive drawer fallback;
7. preserve Global Search;
8. preserve Action Centre;
9. preserve Platform Overview/Health/Notifications destinations;
10. preserve owner menu/sign-out;
11. keep all current destinations reachable;
12. migrate shell CSS from v2 tokens to v3 tokens;
13. update shell tests from cancelled v2 assertions to v3 assertions.

**Gate 1:** all current Super Admin destinations remain reachable, no owner-auth semantics change, TypeScript/lint/targeted shell tests pass.

### Phase 2 - Design primitives

1. page header;
2. metric card/grid;
3. section card;
4. status badge;
5. data grid;
6. filter bar;
7. empty state;
8. unavailable state;
9. entity link;
10. density/responsive tokens.

**Gate 2:** representative pages use the same visual system without functional regressions.

### Phase 3 - Command Centre

1. rebuild `/super-admin` cockpit hierarchy;
2. reuse canonical command-centre/stats/health sources;
3. add only genuinely missing read-model fields;
4. document KPI sources;
5. integrate live operations and attention queue;
6. integrate Secure Operations summary;
7. add charts only with proven historical source;
8. expose partial/unavailable state visibly.

**Gate 3:** every visible metric/chart/panel has canonical source truth.

### Phase 4 - Secure Operations

1. reconcile partial Secure Load derivation against v3;
2. complete owner-only secure-loads API;
3. complete Secure Loads ledger;
4. extend Job Inspector from shared derivation;
5. connect Jobs at Risk / Tracking / POD evidence where current sources support them;
6. keep read-only.

**Gate 4:** unavailable credential sources never produce false CLEAR.

### Phase 5 - Operations and Fleet convergence

1. Jobs;
2. Active Jobs;
3. Pending Jobs;
4. Completed Jobs;
5. Quotes;
6. Allocations;
7. Deliveries;
8. Drivers;
9. Driver Availability;
10. Vehicle Registry;
11. Fleet Positions;
12. Return Journeys.

**Gate 5:** Platform Owner can inspect cross-company operational evidence without tenant impersonation.

### Phase 6 - Companies, Finance and Compliance

1. Companies/Brokers visual convergence;
2. Membership & Access remains distinct from platform roles;
3. Finance Overview;
4. Invoices/Payments/Revenue;
5. Subscriptions/Stripe/Webhooks;
6. Financial Breakdown;
7. Compliance Overview;
8. Identity/Fraud;
9. Insurance;
10. Operator Licences;
11. Expiries;
12. Document Review.

**Gate 6:** authorization, finance truth, compliance audit and fail-closed behavior remain intact.

### Phase 7 - Platform, Support and Inspector consistency

1. Support Tickets;
2. Complaints;
3. Support Disputes;
4. Notifications;
5. Platform Health;
6. Roles & Permissions;
7. Audit Logs;
8. Global Settings;
9. Legal & Agreements;
10. Feature Flags;
11. Inspector visual convergence;
12. related-entity navigation.

**Gate 7:** Super Admin behaves and looks like one product.

### Phase 8 - Optional polish

Only after light-mode core visual acceptance:

- dark mode;
- saved views/filters;
- configurable widgets;
- richer chart drilldowns;
- command palette;
- controlled export flows.

### Phase 9 - Release hardening

1. exact-head local validation;
2. canonical Netlify Deploy Preview;
3. exact-head preview build evidence;
4. authenticated Platform Owner E2E;
5. visual screenshots;
6. regression classification;
7. PR evidence update;
8. user visual approval;
9. only then merge/release decision.

---

## 14. Page-level acceptance

### Command Centre

- coherent hierarchy;
- <= 8 primary KPIs;
- risk visually stronger than neutral state;
- explicit unavailable/partial states;
- no fabricated deltas;
- no misleading KPI navigation.

### Ledger pages

- filters/search before table;
- stable header where useful;
- dense readable rows;
- consistent status chips;
- canonical formatting;
- inspector action on relevant entities;
- backend pagination truth;
- empty != unavailable.

### Maps

- no fake pins;
- telemetry freshness visible;
- unavailable source != empty healthy map;
- accessible table fallback.

### Charts

- explicit time window;
- canonical units/currency;
- no synthetic trends;
- no chart when only a single current total exists.

### Secure Loads

- BLOCKED has explicit reasons;
- REVIEW has explicit signals;
- UNAVAILABLE is distinct from VERIFIED/BLOCKED;
- overview and inspector use same server derivation.

---

## 15. Validation plan

### Local code gates

Run on the actual implementation head:

- dependency install from lockfile when needed;
- `npm run typecheck`;
- scoped ESLint on every changed TS/TSX file;
- targeted Vitest for v3 shell;
- targeted Vitest for Secure Load read model when implemented;
- relevant existing Super Admin regressions;
- explicit classification of baseline v2 test failures;
- `git diff --check`;
- correct Next.js build context;
- existing secret/release gate used by the repository.

### Authenticated preview gates

Use canonical Netlify project only.

Verify:

- owner login/session;
- sidebar expand/collapse;
- responsive fallback;
- primary areas reachable;
- Global Search works;
- Action Centre reachable;
- Command Centre real data;
- partial/error states truthful;
- Secure Loads cross-company read-only;
- Job Inspector from Secure Loads;
- Companies/Finance/Compliance/Audit reachable;
- no transformation-caused console errors;
- no global horizontal layout break;
- keyboard focus visible.

### Visual evidence

Capture at minimum:

- 1440px Command Centre expanded sidebar;
- 1440px Command Centre collapsed sidebar;
- 1280px Command Centre;
- Secure Loads;
- All Jobs;
- Finance Overview;
- Compliance Overview;
- Job Inspector;
- one medium-width responsive shell state.

Compare quality principles, not pixel similarity to CargoMax or ShipNow.

---

## 16. Copyright / IP separation gate

Before release, verify all of the following:

- no CargoMax source file exists in repo;
- no CargoMax proprietary asset exists in repo;
- no CargoMax branding/text has been copied as product content;
- ShipNow-derived assets/components are used only within the licensed End Product and applicable terms;
- no Envato license code is committed;
- no Envato certificate containing personal/licensing details is exposed publicly unless intentionally required;
- external stock imagery is independently suitable for production use;
- XDrive colors, terminology and information architecture are visibly its own;
- implementation code is XDrive-native;
- the final product is not a pixel-for-pixel clone of either reference.

---

## 17. Expected implementation scope

Core files likely to evolve first:

- `app/super-admin/layout.tsx`
- `app/super-admin/_components/SuperAdminWorkspaceShell.tsx`
- `app/super-admin/_components/SuperAdminSidebar.tsx`
- `app/super-admin/_components/SuperAdminTopbar.tsx`
- `app/super-admin/_components/SuperAdminCardNavigationShell.tsx`
- `app/super-admin/_components/SuperAdminCardNavigationShell.module.css`
- `app/super-admin/_components/SuperAdminLiveTablePage.tsx`
- `app/super-admin/_components/superAdminFormatters.tsx`
- `app/super-admin/super-admin-master-contract.css`
- `app/super-admin/page.tsx`
- `app/api/super-admin/command-centre/route.ts`
- `app/api/super-admin/operations-cockpit/route.ts`
- `app/api/super-admin/stats/route.ts`
- `app/api/super-admin/inspect/[entityType]/[entityId]/route.ts`
- Secure Load server/client files introduced by this workstream;
- v3 Super Admin contract tests.

This list is guidance, not permission to rewrite unrelated code.

---

## 18. Workstream isolation

Do not modify as part of this transformation:

- PR #502 go-live/PostGIS work;
- PR #510 Driver Phone GOLDEN work;
- PR #515 Driver dashboard visual review;
- tenant workspace visual contracts;
- Production Supabase migrations;
- Production Netlify deployment.

Partial Secure Load code in the older worktree is not automatically trusted. Reconcile it deliberately during Phase 4 rather than copying it wholesale into the v3 branch.

---

## 19. Definition of done

The transformation is complete only when the Platform Owner can open XDrive Super Admin and immediately understand:

- what is happening across the platform now;
- active jobs;
- delayed / blocked / at-risk jobs;
- driver operational readiness;
- fleet readiness;
- compliance/document failures;
- Secure Loads requiring review;
- financial exposure;
- company/account issues;
- current support/platform incidents;
- recent relevant activity;
- how to drill from every important metric/row into canonical evidence.

The result must have CargoMax-level operational maturity, ShipNow-level visual consistency and XDrive-native product identity.

No PASS may be declared until required code, preview, authenticated E2E and visual gates are actually evidenced.

---

## 20. Exact continuation instruction

Use this instruction when another agent continues the workstream:

> CONTINUE XDRIVE SUPER ADMIN EXACTLY FROM `docs/blueprints/SUPER_ADMIN_CARGOMAX_SHIPNOW_ENTERPRISE_EXECUTION_BLUEPRINT_2026-09-07.md`. MASTER CONTRACT FINAL v3 IS CANONICAL; MASTER CONTRACT FINAL v2 IS CANCELLED. DO NOT RESTART THE AUDIT FROM ZERO. USE CARGOMAX ONLY AS AN ARCHITECTURE/UX BENCHMARK. SHIPNOW IS THE LICENSED DESIGN ASSET FOR THE XDRIVE LOGISTICS SUPER ADMIN END PRODUCT; DO NOT EXPOSE LICENSE CODES OR PERSONAL LICENSE DATA IN THE REPOSITORY. KEEP XDRIVE BRAND, BACKEND, AUTHORIZATION, AUDIT, SUPABASE CONTRACTS AND PLATFORM ENTITY INSPECTOR CANONICAL. DO NOT MODIFY PR #502, #510 OR #515. DO NOT DEPLOY PRODUCTION OR RUN PRODUCTION DB MIGRATIONS. CONTINUE FROM THE CURRENT PHASE AND DO NOT DECLARE PASS WITHOUT THE BLUEPRINT'S LOCAL, EXACT-HEAD PREVIEW, AUTHENTICATED E2E AND VISUAL GATES.

---

## 21. Immediate next execution order

The next agent/action must continue in this exact order:

1. finish the partial `SuperAdminSidebar.tsx` in `C:\Users\Danny\xg-super-admin-v3`;
2. implement `SuperAdminTopbar.tsx`;
3. convert `SuperAdminCardNavigationShell` into the v3 enterprise shell composition;
4. migrate v2 CSS variables/selectors to v3 shell tokens without mass page-body redesign;
5. add/update v3 shell contract tests;
6. run Phase 1 typecheck + scoped lint + targeted tests + diff-check;
7. push the Phase 1 implementation head;
8. only after Gate 1 passes, start Phase 2 reusable primitives.

Do not jump directly to Command Centre cosmetics before the shell and design primitives are stable.

---

**End of canonical CargoMax + ShipNow execution blueprint.**
