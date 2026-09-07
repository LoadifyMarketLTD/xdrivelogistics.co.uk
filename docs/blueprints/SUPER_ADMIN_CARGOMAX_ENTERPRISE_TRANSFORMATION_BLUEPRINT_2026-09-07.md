# XDrive Super Admin � Cargomax-Level Enterprise Transformation Blueprint

**Date:** 2026-09-07
**Repository:** `LoadifyMarketLTD/xdrivelogistics.co.uk`
**Canonical production site:** `https://www.xdrivelogistics.co.uk`
**Benchmark:** Cargomax Shipping & Logistics Admin Dashboard � visual/UX reference only
**Benchmark demo:** `https://cargomax-dashboard.vercel.app/`
**Purpose:** canonical execution blueprint for any agent continuing the Super Admin transformation.

## 0. Mission

Transform the existing XDrive Super Admin into a professional logistics control system with the information density, navigation clarity, operational hierarchy and visual maturity observed in Cargomax, while preserving XDrive's existing backend, security model, data contracts, auditability and brand identity.

The target is **not** to install, clone or imitate Cargomax source code. The target is to achieve a comparable level of product polish using XDrive-native React/Next.js components and canonical XDrive data.

The finished Super Admin must feel like one coherent operations platform, not a collection of unrelated admin pages.

## 1. Current source-of-truth state

At blueprint creation time, current `main` is `73deceeb5055d6b0c6e47c44cf5d0cedae114b4b`.
The active local branch is `feat/cx-secure-load-compliance-intelligence-20260907`.

Existing merged Super Admin control-plane work remains authoritative. Do not discard or bypass it.

At blueprint creation time the worktree also contains an **uncommitted partial Secure Load implementation**. Treat it as work-in-progress only. It must be validated before any claim of completion, commit or merge.

Do not confuse this workstream with Driver PR #510, visual review PR #515 or go-live security PR #502. Those workstreams keep their own gates and must not be modified by this transformation unless the user explicitly redirects them.

## 2. Non-negotiable execution rules

1. Read this blueprint in full before any implementation action.
2. Do not restart the Super Admin audit from zero.
3. Do not replace the existing backend, Supabase model, permissions, audit trail or Platform Entity Inspector.
4. Do not introduce Bootstrap, jQuery, Elementor, WordPress or Cargomax source code into XDrive.
5. Do not copy Cargomax branding, proprietary assets, exact text, icons, illustrations or pixel-for-pixel layouts.
6. Use Cargomax only as a benchmark for information architecture, density, interaction hierarchy, component composition and logistics-dashboard polish.
7. Preserve XDrive identity, terminology and canonical business logic.
8. Do not use fabricated production metrics, sample companies, fake alerts or dummy charts in production routes.
9. Missing/unavailable data must fail closed and be shown as unavailable, never silently converted to zero or healthy.
10. Never expose service-role credentials or privileged secrets to the browser.
11. No Production DB migration is required for the visual transformation unless a later verified functional gap genuinely requires one.
12. Do not deploy Production until all specified gates pass and the user has visually accepted the transformation.
13. GitHub Actions are not accepted as validation evidence for this XDrive workstream unless the user explicitly changes that rule.
14. Preserve existing Platform Owner authorization and `ProtectedRoute` / server-side owner verification semantics.
15. Every mutation surface must retain explicit authorization, validation, auditability and rollback/fail-closed behavior.
16. Secure Load / Compliance Intelligence is read-only in its first release. Do not add automatic suspensions, payment actions, refunds, compliance overrides or load cancellation.
17. Do not hide existing functionality simply to make the UI look cleaner. Re-home it into the new information architecture.
18. No page may regress into a decorative mock. Every visible metric, status, chart and list must resolve from a documented canonical source.
19. Prefer reusing existing endpoints and shared components; introduce new read models only when existing contracts cannot represent the required truth safely.
20. Keep the implementation accessible, responsive and keyboard usable.

## 3. Benchmark observations to translate into XDrive

Cargomax is valuable because it behaves like one logistics operating system. The useful patterns are:

- persistent, collapsible left navigation grouped by operational domains;
- compact top bar for global controls, notifications and owner identity;
- clear page title + short operational description + primary actions;
- uniform KPI cards immediately below the page header;
- charts and operational summaries below KPIs rather than above them;
- dedicated live map / fleet / shipment / delayed-work surfaces;
- explicit quick actions instead of burying common tasks;
- visible activity stream and alerts;
- dense but readable tables with strong status hierarchy;
- consistent card surfaces, spacing, typography and icon treatment;
- role/permissions, support and audit logs treated as first-class platform areas.

Translate those principles into XDrive. Do not reproduce the Cargomax visual composition literally.
## 4. Target information architecture

The Super Admin shell must expose these primary groups in this order unless a later usability test proves a better order:

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
## 5. Super Admin shell blueprint

Create one reusable enterprise shell used by all Super Admin pages.

### Left sidebar
- Persistent desktop sidebar; collapsible to icon rail.
- Group labels as defined in Section 4.
- One consistent icon family; prefer existing Lucide usage.
- Active page must be obvious without excessive decoration.
- Nested destinations must remain discoverable; no hidden critical areas.
- Sidebar must scroll independently on smaller-height screens.
- Brand area must display XDrive identity, not Cargomax identity.

### Top bar
- Sidebar toggle.
- Global Platform Search.
- Notification entry with verified unread count only.
- Optional theme control only after light mode is complete and accepted.
- Platform Owner menu with account context and sign-out.
- Do not hard-code personal information when a canonical authenticated value exists.

### Main canvas
- Standard page-header component: eyebrow/domain, H1, one-line description, contextual actions.
- Standard content max-width behavior suitable for wide operations screens.
- Allow full-width map and data-grid surfaces where operationally justified.
- Maintain consistent breadcrumbs or domain context on deep pages.

## 6. Visual system

The desired quality level is Cargomax-like; the design language remains XDrive.
### XDrive visual rules
- Primary identity: XDrive navy / blue with restrained orange accent.
- Operational states: green = verified/healthy/complete, yellow = review/attention, red = blocked/critical, grey = unavailable/inactive.
- Do not import Cargomax colors verbatim.
- Use Inter as the primary UI font unless the canonical design contract is intentionally revised.
- Prefer 8px radius for controls/cards unless an existing approved component contract requires otherwise.
- Shadows must be subtle and consistent; avoid floating-card visual noise.
- Reduce excessive 24px padding inside dense tables. Data rows should target approximately 44�52px where practical.
- Section spacing can remain generous while table/content density increases.
- Keep status chips small, legible and consistent.
- Use icons to improve scanning, not as decoration.
- Avoid emoji icons in final production navigation; replace provisional glyphs with the approved icon family.

### Contract rule
`docs/super-admin/MASTER_CONTRACT_FINAL.md` is MASTER CONTRACT FINAL v3 and is the sole canonical Super Admin contract. MASTER CONTRACT v2 is superseded/cancelled. Execute this blueprint against v3; do not reintroduce cancelled v2 navbar, no-collapse, no-responsive or four-KPI-only constraints.

## 7. Command Centre target composition

The rebuilt `/super-admin` must become an operations cockpit.

### Row A � page header
- `Command Centre`
- current environment badge;
- last verified refresh time;
- Refresh action;
- no fake green/healthy state when a source fails.

### Row B � primary KPIs
Target eight compact cards, all backed by canonical sources:
- Active Jobs
- Jobs at Risk
- Drivers Online
- Fleet Ready
- Compliance Blocks
- Unpaid Exposure
- Active Companies
- Platform Incidents

### Row C � live operations
Two-column or responsive composition:
- Live Operations Map / geographic operational picture.
- Jobs requiring attention / active execution queue.

Map markers must originate from canonical tracked entities. Do not expose data that the Platform Owner is not authorized to inspect.

### Row D � Secure Operations
- Secure Loads state distribution: Blocked / Review / Awaiting Assignment / Clear.
- Jobs at Risk reasons.
- Compliance blockers.
- POD / delivery evidence readiness.
- Tracking evidence presence.

### Row E � operational performance
- Job lifecycle trend over a useful, explicit time window.
- Delivered vs delayed / at-risk trend where canonical evidence supports it.
- No invented percentage change badges. Every delta must have a defined comparison period and source.

### Row F � fleet status
- Active / Available / Busy / Compliance Blocked / Maintenance if supported.
- Do not infer mechanical health from compliance documents.
- Clearly distinguish availability, compliance and telemetry freshness.

### Row G � finance
- Revenue / invoiced / unpaid / overdue / disputed exposure.
- Currency handling must be explicit; never silently aggregate incompatible currencies as GBP.

### Row H � platform activity and alerts
- Recent verified administrative/operational activity.
- Critical alerts and Action Centre items.
- Quick actions limited to safe, authorized destinations.

## 8. Secure Load / Compliance Intelligence module

Secure Load is a first-class Super Admin domain, not a generic table.
### Canonical signals already available
Use existing schema and logic before considering migrations:
- job cargo value (`cargo_value_gbp`);
- `High Value Goods` and other special requirements;
- requested document checklist;
- direct-delivery requirement;
- POD requirement and POD evidence;
- assigned driver and vehicle;
- driver account/app/commercial-bid state;
- platform identity registry and onboarding approval;
- personal compliance;
- company active state and membership;
- canonical active assigned vehicle;
- vehicle MOT / insurance compliance;
- tracking evidence / latest telemetry;
- job documents;
- disputes, invoices and lifecycle evidence where relevant.

### Secure Load states
The read model must expose a small, explainable state set:
- `CLEAR` � no verified blocker in the evaluated evidence.
- `REVIEW` � elevated load conditions or requirements merit human review but no hard blocker is established.
- `BLOCKED` � one or more verified execution/compliance blockers exist.
- `AWAITING ASSIGNMENT` � the load has not yet reached a state where execution credentials can be evaluated because no driver is assigned.

### Fail-closed rule
If required credential verification cannot be completed because a canonical source errors, return `UNAVAILABLE` / blocker context. Never label the driver or load `CLEAR` because a query failed.

### Secure Loads overview page
Header + compact state metrics + filtered ledger.
Minimum columns:
`Load | Route | Secure state | Credentials | Load signals | Tracking | POD | Documents | Posting company | Carrier | Created | Inspect`

Rows must link to the canonical Platform Entity Inspector for the job.
### Job inspector extension
For `entityType=job`, add a dedicated Secure Load / Security section backed by the same derivation logic. It must show:
- secure state;
- credential state;
- explicit blockers;
- load risk/signals;
- declared cargo value;
- direct-delivery requirement;
- requested vs uploaded documents;
- assigned driver operational eligibility checks;
- canonical vehicle ID and vehicle compliance;
- tracking evidence presence/freshness;
- POD requirement and evidence state.

Do not duplicate business logic independently in the page. Derivation belongs in a shared server-side library/read model.

## 9. Core reusable component set

Before rewriting many pages, establish a small Super Admin component system:

- `SuperAdminEnterpriseShell`
- `SuperAdminSidebar`
- `SuperAdminTopbar`
- `SuperAdminPageHeader`
- `SuperAdminMetricCard`
- `SuperAdminMetricGrid`
- `SuperAdminSectionCard`
- `SuperAdminDataGrid`
- `SuperAdminStatusBadge`
- `SuperAdminFilterBar`
- `SuperAdminQuickActions`
- `SuperAdminActivityFeed`
- `SuperAdminAlertPanel`
- `SuperAdminChartCard`
- `SuperAdminMapCard`
- `SuperAdminEmptyState`
- `SuperAdminUnavailableState`
- `SuperAdminEntityLink`

Avoid one-off inline style systems on every page. Centralize repeatable shell, card, table, metric and status primitives.
## 10. Data architecture rules

Every widget must have a documented source contract.

Preferred flow:
`Supabase canonical tables/RPC -> owner-verified server API/read model -> typed client component -> display`

Never:
`browser -> service-role client`

For aggregate endpoints:
- return `refreshedAt`;
- expose `partialData` / unavailable source context where applicable;
- expose explicit definitions for ambiguous KPIs;
- use exact counts when the UI labels a value as a platform total;
- page-scoped counts must be labelled as page-scoped;
- separate currencies or declare the conversion source/time if conversion is ever introduced.

Do not create parallel status vocabularies where canonical lifecycle/status helpers already exist.

## 11. Cargomax ? XDrive functional mapping

| Cargomax pattern | XDrive destination |
| --- | --- |
| Dashboard Overview | Command Centre |
| Live Shipment Map | Live Operations Map / Fleet Positions |
| Fleet Status | Fleet Overview / Vehicle Registry |
| All Shipments | All Jobs |
| Track Shipment | Tracking & ETA / Job Inspector |
| Delayed Shipments | Jobs at Risk |
| Driver Assignments | Allocations / Drivers |
| Vendors & Clients | Companies / Brokers / Directory |
| Scheduled Deliveries | Active Jobs / Deliveries |
| Delivery Performance | Operations Analytics |
| Revenue Analysis | Finance / Revenue |
| Fleet Efficiency | Fleet Analytics |
| Roles & Permissions | Access Matrix |
| Notifications Setup | Notifications / settings |
| Support Tickets | Support Tickets |
| Audit Logs | Platform Audit Logs |
## 12. Execution phases � mandatory order

### Phase 0 � baseline and protection
1. Verify repository, branch, `main` SHA and active worktrees.
2. Read `docs/super-admin/MASTER_CONTRACT_FINAL.md` fully.
3. Read the existing Super Admin current-state/checkpoint documentation.
4. Inventory all current Super Admin routes and endpoints.
5. Capture screenshots of the current Command Centre and representative pages for regression comparison.
6. Record existing targeted tests and baseline lint/typecheck/build truth.
7. Do not modify Production.

**Gate 0:** agent can state exactly what already exists, what is being retained and which files are in scope.

### Phase 1 � enterprise shell
1. Build/reconcile shared sidebar and top bar.
2. Implement the Section 4 navigation hierarchy without dropping existing destinations.
3. Replace provisional emoji/glyph navigation with consistent icon components.
4. Add active-state handling, collapse behavior and responsive fallback.
5. Preserve global search, Action Centre, Platform Overview and owner menu.
6. Do not redesign domain page bodies yet beyond compatibility changes.

**Gate 1:** every existing Super Admin destination remains reachable and authorization semantics are unchanged.

### Phase 2 � design primitives
1. Centralize page header, metric card, section card, status badge, data grid and unavailable state.
2. Reconcile spacing and typography with the approved XDrive contract.
3. Establish table-density tokens and responsive behavior.
4. Add chart/map wrappers only around existing approved libraries; do not add dependencies casually.

**Gate 2:** representative pages render consistently without breaking existing functional tests.
### Phase 3 � Command Centre transformation
1. Rebuild `/super-admin` using Section 7 composition.
2. Reuse existing command-centre/stats/platform-health truth wherever possible.
3. Add new read-model fields only where a required KPI is genuinely missing.
4. Convert isolated cards into a coherent cockpit hierarchy.
5. Integrate Connected Exchange intelligence without allowing it to dominate the platform overview.
6. Add real chart/trend data only after the underlying time-series source is proven.
7. Keep unavailable/partial-data warnings prominent.

**Gate 3:** no displayed metric is fabricated; all primary cards and panels have documented source definitions.

### Phase 4 � Secure Operations
1. Finish the shared Secure Load derivation library.
2. Finish owner-only `/api/super-admin/secure-loads` read model.
3. Build `/super-admin/operations/secure-loads` with state metrics, filters and dense ledger.
4. Extend Job Inspector using the shared Secure Load derivation.
5. Connect Jobs at Risk, Tracking/ETA and POD evidence surfaces where existing endpoints already support them.
6. Keep Secure Load read-only for this phase.

**Gate 4:** credential source failures produce unavailable/blocked truth, never false clear states.

### Phase 5 � Operations and Fleet convergence
1. Apply the shared data-grid/page-header system to Jobs, Active Jobs, Pending Jobs, Completed Jobs, Allocations and Deliveries.
2. Upgrade Fleet overview, Drivers, Vehicles, Availability and Fleet Positions.
3. Add operational map presentation using existing canonical telemetry sources.
4. Clearly label stale telemetry and unavailable positions.
5. Preserve Return Journey / Return IQ semantics; do not clone CX or Cargomax behavior.

**Gate 5:** cross-company Platform Owner inspection works end-to-end without changing tenant permissions.
### Phase 6 � Companies, Finance and Compliance
1. Standardize Companies and Broker oversight using the new shell/grid primitives.
2. Keep Membership & Access visibly distinct from platform roles.
3. Upgrade Finance Overview with real invoice/payment/revenue state and explicit currency truth.
4. Standardize Invoices, Payments, Subscriptions, Stripe/Webhook monitoring and financial breakdown.
5. Create a Compliance Overview that summarizes identity, insurance, licences, expiries and document-review workload.
6. Preserve existing document review mutations, owner verification and audit rollback behavior.

**Gate 6:** no finance or compliance action loses existing authorization, audit or fail-closed protection.

### Phase 7 � Platform, support and inspector consistency
1. Apply the common visual system to Platform Health, Notifications, Roles & Permissions, Settings, Support and Audit Logs.
2. Keep Platform Entity Inspector read-only unless a separate audited action flow already exists.
3. Ensure all important table entities can open the appropriate inspector.
4. Improve related-entity navigation so the owner can follow `Company -> Driver -> Vehicle -> Job -> POD -> Invoice -> Payment/Audit` where canonical relations exist.

**Gate 7:** the Super Admin feels like one product across all domains.

### Phase 8 � optional advanced polish
Only after light-mode core is accepted:
- dark mode;
- saved filters/views;
- configurable dashboard widgets;
- richer chart drilldowns;
- keyboard command palette;
- export actions where authorization and data-volume controls are defined.

These are optional. Do not delay the core transformation for them.

### Phase 9 � release hardening
Run the full validation plan in Section 15, generate a Deploy Preview, complete authenticated owner visual E2E, resolve regressions, and only then seek merge/release approval.
## 13. Page-level acceptance requirements

### Command Centre
- One coherent dashboard hierarchy.
- Eight or fewer primary KPI cards visible without overwhelming the first viewport.
- At-risk work and critical alerts are visually stronger than neutral metrics.
- Partial/unavailable data is explicit.
- No KPI card becomes a misleading navigation link if the contract says it is informational only.

### Data-ledger pages
- Search/filter controls appear before the table.
- Sticky or visually stable table header where useful.
- Consistent status chips and date/number formatting.
- Entity inspection action is available on relevant records.
- Pagination uses the backend's real pagination contract.
- Empty state is different from unavailable/error state.

### Maps
- Never render fabricated pins.
- Show telemetry age/freshness.
- If a map source is unavailable, show a real unavailable state, not an empty healthy map.
- Keep map and tabular fallback accessible.

### Charts
- Each chart states its time window.
- Tooltips/labels use canonical units and currencies.
- No synthetic trend lines.
- If only current totals exist, use metric cards instead of pretending historical series exist.

### Secure Loads
- `BLOCKED` must always provide explicit blocker reasons.
- `REVIEW` must expose the elevated signals that triggered review.
- Credential `UNAVAILABLE` is not equivalent to `VERIFIED` or `BLOCKED`.
- Job Inspector and overview ledger must derive from the same server-side logic.
## 14. Forbidden shortcuts

An executing agent must not:

- paste a purchased/template codebase into the repository;
- use Cargomax screenshots/assets as production assets;
- create hard-coded dashboard numbers to make the page look populated;
- invent percentage-change badges;
- hide API errors and display `0`;
- aggregate currencies without a documented conversion rule;
- duplicate canonical lifecycle or compliance logic in client components;
- add a second authentication/authorization mechanism;
- weaken Platform Owner checks for convenience;
- use browser-side Supabase service-role access;
- turn read-only inspection into mutation without a separate action contract;
- introduce mass auto-fixes, suspensions, refunds, payouts or job cancellations;
- remove existing Super Admin routes merely because they are absent from Cargomax;
- redesign Driver, customer or company workspaces as collateral work;
- modify PR #515, #510 or #502 as part of this task;
- merge an incomplete visual transformation directly to `main`;
- declare PASS from static code inspection alone when the gate requires authenticated browser evidence.

## 15. Validation and release gates

Validation must be evidence-based and performed on the actual implementation head.

### Local code gates
- dependency install from lockfile (`npm ci`) when needed;
- `npm run typecheck`;
- scoped ESLint for every changed TS/TSX file;
- targeted Vitest contracts for new shell/read-model behavior;
- existing Super Admin regression suites;
- `git diff --check`;
- production/deploy-preview build with the correct context;
- secret scan / release gate already used by the repository.
### Authenticated Deploy Preview gates
Use the canonical XDrive Netlify site only.

Verify at minimum:
- Platform Owner login/session resolves correctly;
- sidebar opens/collapses and every primary area is reachable;
- global search remains functional;
- Command Centre loads verified data;
- partial-data/error states are truthful;
- Secure Loads loads cross-company read-only data;
- Job Inspector opens from Secure Loads;
- Companies, Finance, Compliance and Audit routes remain accessible;
- no client console errors caused by the transformation;
- no horizontal-layout break at common desktop widths;
- keyboard focus remains visible on interactive controls.

### Visual review gates
Capture consistent screenshots at representative viewport sizes, including at least:
- 1440px desktop Command Centre;
- 1280px desktop Command Centre;
- Secure Loads overview;
- All Jobs ledger;
- Finance Overview;
- Compliance Overview;
- Job Inspector;
- collapsed sidebar state.

Compare against the target principles, not pixel similarity to Cargomax.

### Release gate
Do not merge until:
1. required code/test/build gates pass;
2. exact-head canonical Deploy Preview is healthy;
3. authenticated owner E2E is complete;
4. the user has visually approved the transformation;
5. no known severe regression remains;
6. PR body records exact evidence and remaining limitations.

## 16. Expected file scope

Likely core files/components to inspect or evolve first:
- `app/super-admin/_components/SuperAdminWorkspaceShell.tsx`
- `app/super-admin/_components/SuperAdminNavbar.tsx`
- `app/super-admin/_components/SuperAdminCardNavigationShell.tsx`
- `app/super-admin/_components/SuperAdminLiveTablePage.tsx`
- `app/super-admin/_components/superAdminFormatters.tsx`
- `app/super-admin/page.tsx`
- `app/api/super-admin/command-centre/route.ts`
- `app/api/super-admin/operations-cockpit/route.ts`
- `app/api/super-admin/stats/route.ts`
- `app/api/super-admin/inspect/[entityType]/[entityId]/route.ts`
- Secure Load read model/components introduced by this workstream.

This list is guidance, not authorization to rewrite unrelated code. Inspect dependencies before changing them.

## 17. Definition of done

The transformation is complete only when a Platform Owner can open XDrive Super Admin and immediately understand:
- what is happening across the platform now;
- which jobs are active, delayed, blocked or at risk;
- which drivers and vehicles are operationally ready;
- where compliance or document failures exist;
- which secure loads need review;
- the current financial exposure;
- important company/account issues;
- recent platform activity and incidents;
- how to drill from any important metric or row into canonical evidence.

The interface must have Cargomax-level professional polish while remaining unmistakably XDrive and more deeply connected to real operational truth than the benchmark template.

## 18. Continuation instruction for the next agent

Use the following instruction verbatim when handing this workstream to another agent:

> CONTINUE XDRIVE SUPER ADMIN EXACTLY FROM `docs/blueprints/SUPER_ADMIN_CARGOMAX_ENTERPRISE_TRANSFORMATION_BLUEPRINT_2026-09-07.md`. READ THE BLUEPRINT IN FULL BEFORE ANY ACTION. DO NOT RESTART THE AUDIT FROM ZERO. CARGOMAX IS A UI/UX BENCHMARK ONLY; DO NOT COPY ITS SOURCE, BRANDING, ASSETS OR PIXEL-FOR-PIXEL LAYOUT. PRESERVE XDRIVE BACKEND, AUTHORIZATION, AUDIT, SUPABASE CONTRACTS, PLATFORM ENTITY INSPECTOR AND EXISTING FUNCTIONALITY. DO NOT MODIFY PR #502, #510 OR #515 AS PART OF THIS WORKSTREAM. DO NOT DEPLOY PRODUCTION OR RUN PRODUCTION DB MIGRATIONS. FINISH THE TRANSFORMATION PHASE-BY-PHASE AND DO NOT DECLARE PASS WITHOUT THE BLUEPRINT'S VALIDATION AND AUTHENTICATED VISUAL GATES.

## 19. Status at handoff

This blueprint is the canonical target specification. It is intentionally broader than the partial Secure Load patch that existed when the blueprint was written.

If the worktree contains uncommitted Secure Load files, inspect and validate them against this blueprint before retaining them. Do not assume partial code is correct merely because it predates the blueprint.

The next execution step is **Phase 0 baseline and protection**, followed by the shell transformation. Secure Load must be completed inside the new coherent Super Admin architecture rather than treated as an isolated table page.

---

**End of canonical blueprint.**
