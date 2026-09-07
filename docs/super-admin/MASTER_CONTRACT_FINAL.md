# XDrive Super Admin - MASTER CONTRACT FINAL v3

**Effective date:** 2026-09-07
**Status:** CANONICAL
**Supersedes:** MASTER CONTRACT FINAL v2 in full
**Execution blueprint:** `docs/blueprints/SUPER_ADMIN_CARGOMAX_ENTERPRISE_TRANSFORMATION_BLUEPRINT_2026-09-07.md`

> MASTER CONTRACT FINAL v2 is cancelled and is no longer an implementation target. Git history remains historical evidence only.

## 0. SUPREME RULE

Every Super Admin page, component, status, action, metric and data surface must comply with this v3 contract.

The target is a professional logistics control system with Cargomax-level information architecture, density and operational clarity, implemented natively in XDrive. Cargomax is a benchmark only. Do not copy its source, branding, assets, text or pixel-for-pixel layout.

The Super Admin must remain unmistakably XDrive and must preserve canonical backend truth, authorization, auditability and fail-closed behavior.

## 1. PLATFORM OWNER BOUNDARY

`/super-admin` is the Platform Owner cross-company control plane.

It must not grant implicit access to tenant-only `/broker`, `/customer`, `/driver` or company `/admin` workspaces merely for inspection. Cross-platform oversight belongs inside `/super-admin` through owner-authorized APIs and canonical entity Inspector links.
All `/api/super-admin/*` privileged routes must use the canonical active Platform Owner verification boundary.

Deploy Preview remains read-only for Super Admin mutations unless a later contract explicitly authorizes otherwise.

No browser-side service-role access is permitted.

## 2. DATA TRUTH / FAIL-CLOSED

1. Failed or unavailable data is never converted to zero, healthy, compliant, clear, paid or complete.
2. Exact-count `null` is unknown/failure, never zero.
3. A failed refresh clears stale rows/summaries before rendering the error.
4. A successful HTTP response with an invalid required contract is an error, not an empty state.
5. Platform totals must use global/exact sources, not the currently visible page.
6. Page-scoped counts must be labelled as page-scoped.
7. Multi-currency amounts must not be silently summed into GBP.
8. Optional-source failure must mark dependent aggregates partial/unknown.
9. Empty, unavailable and error states are visually distinct.
10. No production route may contain fabricated metrics, fake alerts, demo companies, synthetic charts or invented trend percentages.

## 3. ENTERPRISE VISUAL SYSTEM

### 3.1 Brand
- XDrive Logistics identity only.
- Primary visual language: XDrive navy / blue with restrained orange accent.
### 3.2 Status palette
- Blue `#1A73E8` = active/in-progress/informational.
- Green `#34A853` = verified/healthy/complete/available.
- Yellow `#FBBC05` = review/attention/warning.
- Red `#EA4335` = blocked/critical/cancelled/failure.
- Grey `#8A9099` = unavailable/inactive/offline/unknown.
- Background remains light/white for the core accepted mode.

### 3.3 Typography
- Primary UI font: Inter.
- Page titles: 20px / 700 minimum canonical baseline.
- Buttons: 16px / 500 where full-size controls are used.
- Compact labels/tables may use smaller approved sizes for enterprise density.

### 3.4 Geometry
- Canonical radius: 8px unless a shared component contract explicitly defines another value.
- Canonical shadow: `0px 2px 6px rgba(0,0,0,0.08)` for elevated enterprise surfaces.
- Page/section rhythm: 24px.
- Dense tables may use reduced cell padding to target approximately 44-52px row height.
- Status chips remain compact and consistent.

### 3.5 Icons
Use one approved icon family, preferably Lucide already present in the repository. Production navigation must not use emoji or provisional glyph characters.
## 4. ENTERPRISE SHELL - FINAL

MASTER CONTRACT v2 navbar rules are cancelled.

The canonical Super Admin shell is now:

`LEFT SIDEBAR | TOP BAR | MAIN OPERATIONS CANVAS`

### 4.1 Left sidebar
- Persistent on desktop.
- Collapsible to an icon rail.
- Grouped by operational domains.
- Independent vertical scroll when required.
- Active route and active group must be obvious.
- Critical destinations must never disappear because the sidebar is collapsed.
- XDrive brand area at the top.

### 4.2 Top bar
- Sidebar toggle.
- Global Platform Search.
- Notifications with verified unread count only.
- Platform Owner identity/context.
- Sign-out entry.
- Optional theme control only after light mode is complete and visually accepted.

### 4.3 Narrow-screen behavior
A drawer control is allowed only where the full sidebar cannot fit safely. Responsive behavior must preserve access to all critical destinations.
## 5. CANONICAL INFORMATION ARCHITECTURE

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
## 6. COMMAND CENTRE - FINAL COMPOSITION

`/super-admin` is the primary operations cockpit.

### 6.1 Header
- Command Centre title.
- Environment badge.
- Last verified refresh time.
- Explicit Refresh action.
- Partial/unavailable source warning when applicable.

### 6.2 Primary KPIs
Up to eight compact, canonical cards:
- Active Jobs
- Jobs at Risk
- Drivers Online
- Fleet Ready
- Compliance Blocks
- Unpaid Exposure
- Active Companies
- Platform Incidents

KPI cards are informational surfaces by default. A distinct labelled action may navigate; the entire KPI card must not become an ambiguous link.
### 6.3 Live operations
- Live Operations Map / geographic operational picture.
- Jobs requiring attention / active execution queue.
- Map markers only from canonical tracked entities.
- Telemetry freshness must be visible where relevant.

### 6.4 Secure Operations
- Secure Loads distribution.
- Jobs at Risk reasons.
- Compliance blockers.
- POD / delivery-evidence readiness.
- Tracking evidence presence.
### 6.5 Performance
- Job lifecycle trend over an explicit time window.
- Delivered / delayed / at-risk trend only when historical source truth exists.
- No invented deltas or percentages.

### 6.6 Fleet
- Active / Available / Busy / Compliance Blocked.
- Maintenance only when a canonical maintenance domain exists.
- Do not infer mechanical health from compliance documents.

### 6.7 Finance and activity
- Revenue / invoiced / unpaid / overdue / disputed exposure with explicit currency truth.
- Recent verified platform activity.
- Action Centre items.
- Safe quick actions only.
## 7. SECURE LOAD / COMPLIANCE INTELLIGENCE

Secure Load is a first-class Super Admin domain and is read-only in its first release.

### 7.1 Canonical states
- `CLEAR` - no verified blocker in evaluated evidence.
- `REVIEW` - elevated requirements need human review; no hard blocker established.
- `BLOCKED` - one or more verified execution/compliance blockers exist.
- `AWAITING ASSIGNMENT` - execution credentials cannot yet be evaluated because no driver is assigned.

Credential verification may separately be `VERIFIED`, `BLOCKED`, `UNAVAILABLE` or `NOT ASSIGNED`.

### 7.2 Required evidence domains
Use existing canonical schema before considering migrations:
- cargo value and special requirements;
- document checklist and uploaded job documents;
- direct-delivery requirement;
- POD requirement and POD evidence;
- assigned driver and vehicle;
- driver operational eligibility;
- company active/membership state;
- identity/onboarding/compliance state;
- vehicle MOT/insurance compliance;
- tracking evidence / telemetry freshness.
### 7.3 Fail-closed behavior
If required credential verification fails because a source cannot be read, the result must expose `UNAVAILABLE` / blocker context. Query failure can never produce `CLEAR`.

### 7.4 Secure Loads overview
Minimum columns:
`Load | Route | Secure state | Credentials | Load signals | Tracking | POD | Documents | Posting company | Carrier | Created | Inspect`

Required state metrics:
`Blocked | Review | Awaiting Assignment | Clear`

Every row must link to the canonical job Inspector.

### 7.5 Job Inspector extension
The job Inspector must expose the same server-side Secure Load derivation, including:
- secure state and credential state;
- explicit blockers and elevated signals;
- cargo value / direct-delivery requirement;
- requested vs uploaded documents;
- driver eligibility checks and canonical vehicle;
- tracking evidence/freshness;
- POD requirement/evidence.

The overview and Inspector must not implement separate derivation logic.
## 8. OPERATIONS & JOBS

All Jobs, Active Jobs, Pending Jobs, Completed Jobs, Quotes, Allocations, Deliveries and Disputes must use a coherent enterprise ledger pattern.

Requirements:
- page header with domain context;
- filter/search controls before the ledger;
- canonical backend pagination;
- stable status chips and date/number formatting;
- entity inspection action on relevant records;
- empty state distinct from unavailable/error state;
- no hidden first-page cap presented as platform truth.

Jobs at Risk is a derived operational view and must expose the reason a job is considered at risk.

Tracking & ETA must distinguish live/recent telemetry, stale telemetry and unavailable telemetry.

POD Queue and Delivery Evidence must preserve canonical POD truth and never claim delivery evidence that is not persisted.

## 9. FLEET

Fleet surfaces must distinguish:
- driver availability;
- driver operational/compliance readiness;
- vehicle availability/status;
- vehicle compliance state;
- telemetry freshness/position.

These concepts must not be collapsed into one generic `healthy` status.
Return Journey / Return IQ remains an XDrive capability. Do not clone CX or Cargomax semantics.

A maintenance state may be shown only if a canonical persisted maintenance domain exists. Compliance expiry is not mechanical maintenance.

## 10. COMPANIES & AUTHORITY

Company governance, memberships and platform/application roles must remain visibly distinct.

Required domains:
- All Companies
- Broker Oversight
- Membership & Access
- Pending Approval
- Active / Suspended Companies
- Verification
- Company Compliance

Company approve/reject/suspend/reinstate must retain active-owner authorization, Deploy Preview write lock, audited governance behavior and reconciliation evidence.

No Platform Owner tenant-workspace impersonation is introduced by this UI transformation.

## 11. FINANCE

Finance must surface canonical invoice/payment/subscription/Stripe state without inventing accounting truth.

Requirements:
- explicit currency handling;
- no implicit FX conversion;
- exact global totals where labelled as platform totals;
- server-side pagination for ledgers;
- secure omission of Stripe secrets and sensitive connected-account identifiers;
- no payout/refund/transfer/replay action without a separately audited action contract.
## 12. COMPLIANCE

Compliance Overview must summarize the real workload across:
- identity / fraud review;
- insurance;
- operator licences;
- expiry tracking;
- document review.

Compliance document review mutations must retain owner verification, durable audit evidence and compensating rollback semantics where already implemented.

A source failure must block a false-compliant result.

## 13. SUPPORT

Support Tickets, Complaints and Support Disputes use the shared enterprise ledger and Inspector patterns.

Summary counts must not be derived from a capped visible page.

Any mutation such as assign/resolve must use an explicit authorized backend contract and must not be simulated as a visual-only production action.

## 14. PLATFORM GOVERNANCE

First-class areas:
- Users & Access
- Roles & Permissions
- Notifications
- Platform Health
- Audit Logs
- Global Settings
- Legal & Agreements
- Feature Flags
Roles & Permissions remains read-only unless a separately designed authority-mutation contract is approved.

Promotion/demotion, global session revocation and arbitrary cross-tenant authority mutation are outside this contract.

Platform Health must clear stale state on failure and must not report unavailable services as healthy.

## 15. PLATFORM ENTITY INSPECTOR

The Inspector remains the canonical read-only drill-down for inspectable platform entities.

Important ledgers should link into the Inspector rather than inventing duplicate detail systems.

Target relationship traversal, where canonical relations exist:
`Company -> User/Driver -> Vehicle -> Job -> POD -> Invoice -> Payment/Audit`

Inspector pages may expose richer contextual sections, but they must remain GET/read-only unless a separately governed action flow already exists.

## 16. REUSABLE SUPER ADMIN COMPONENT SYSTEM

The transformed product must centralize repeatable patterns instead of duplicating inline styles page-by-page.

Canonical component families include:
- Enterprise Shell / Sidebar / Topbar
- Page Header
- Metric Card / Metric Grid
- Section Card
- Data Grid
- Status Badge
- Filter Bar
- Quick Actions
- Activity Feed
- Alert Panel
- Chart Card
- Map Card
- Empty / Unavailable / Error states
- Entity Link
## 17. MAPS, CHARTS & ACTIVITY

### Maps
- No fabricated pins.
- Canonical coordinates/telemetry only.
- Telemetry age/freshness visible.
- Unavailable source renders unavailable state, not an empty healthy map.
- Provide accessible tabular fallback where practical.

### Charts
- Explicit time window.
- Canonical units/currencies.
- No synthetic trend lines.
- If historical data does not exist, use current metric cards instead.

### Activity
- Recent activity must be backed by a persisted/auditable source.
- Do not fabricate friendly activity-feed events from unrelated timestamps.

## 18. RESPONSIVE & ACCESSIBILITY

The v2 prohibition on responsive behavior is cancelled.

The new shell must work at common desktop widths and degrade safely on narrower screens without hiding critical functions.

Requirements:
- visible keyboard focus;
- semantic controls and headings;
- keyboard-reachable sidebar/topbar actions;
- sufficient contrast;
- tables remain inspectable without destructive clipping;
- no horizontal layout break at accepted desktop widths.
## 19. FORBIDDEN SHORTCUTS

Do not:
- import Cargomax source/assets;
- add Bootstrap/jQuery/Elementor/WordPress;
- hard-code fake dashboard data;
- hide source errors behind zero values;
- weaken owner checks;
- expose service-role credentials;
- duplicate canonical business logic in client components;
- introduce automatic suspensions, refunds, payouts or load cancellations;
- remove existing Super Admin functionality merely to simplify the UI;
- alter Driver, Broker, Customer or company workspaces as collateral work;
- claim PASS without the required evidence.

## 20. VALIDATION GATES

Required before merge/release:
1. `npm ci` from lockfile when needed.
2. TypeScript typecheck.
3. Scoped ESLint for changed TS/TSX.
4. Targeted Super Admin unit/contract tests.
5. Existing control-plane/security regression tests.
6. `git diff --check`.
7. Production/deploy-preview build in correct context.
8. Repository release/secret scan gates.
9. Exact-head canonical Netlify Deploy Preview.
10. Authenticated Platform Owner browser E2E.
11. Visual review at representative desktop widths.
12. User visual approval before merge to Production.

GitHub Actions are not accepted as XDrive validation evidence unless explicitly re-authorized.
## 21. CHECKER / TEST CONTRACT MIGRATION

All tests/checkers that encode MASTER CONTRACT v2 structural requirements are now superseded and must be updated before they can be used as acceptance gates.

Specifically, v2 assertions requiring:
- fixed top-only navbar;
- no collapse;
- no responsive navigation;
- exactly four Command Centre KPIs;
- other v2-only layout constraints;

must be replaced by v3 assertions for:
- sidebar + topbar shell;
- collapse/icon-rail behavior;
- complete destination reachability;
- Cargomax-level Command Centre composition using canonical data;
- Secure Operations first-class navigation;
- fail-closed state rendering;
- responsive/accessibility behavior.

Security, owner authorization, audit, finance truth, pagination and fail-closed tests remain valid unless their implementation detail specifically depended on the cancelled v2 shell.

## 22. DEFINITION OF DONE

The Super Admin transformation is complete only when a Platform Owner can immediately understand platform operations, risk, fleet readiness, compliance, finance, company/account issues and recent activity, and can drill from important records into canonical evidence.

The product must reach Cargomax-level professional polish while remaining XDrive-native and more deeply connected to real operational truth than the benchmark.

---

**MASTER CONTRACT FINAL v3 is the sole canonical Super Admin contract from 2026-09-07 onward. MASTER CONTRACT FINAL v2 is superseded and cancelled.**
