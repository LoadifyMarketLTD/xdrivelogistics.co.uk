# XDrive Super Admin + Driver Workspace — Unified Execution Plan

Date: 2026-08-30
Repository: `LoadifyMarketLTD/xdrivelogistics.co.uk`
Current PR at plan creation: `#405`
Current branch: `fix/owner-driver-remediation-main-20260830`
Verified PR head at plan creation: `f56f422dcc35de43d01782811278edc35d4670d9`
Base: `main` @ `82db18de37b564b4dfc7a5df6141bb902afb5b82`

## 0. Purpose

This document is the single execution source for the visual, functional, data-governance and runtime remediation identified from the authenticated XDrive screenshots, the current repository implementation and production Supabase state.

It is deliberately broader than PR #405. PR #405 remains a narrow remediation PR and MUST NOT absorb the redesign and platform-wide cleanup work described below. The work in this document is to be executed in controlled follow-up slices after #405 reaches its own runtime gate or is explicitly superseded.

This plan does not authorize weakening RLS, bypassing server-authoritative compliance, importing PR #359 Workspace visual changes, replacing Expo/React Native with Android-native/Kotlin, or making destructive production cleanup without an evidence-led reconciliation step.

## 1. Global verdict

### KEEP

- Server-side owner verification pattern for Super Admin APIs.
- Signed private-storage document preview URLs.
- Audit logging for privileged document access and governance actions.
- Company status transition guardrails.
- Compliance-gated company activation.
- Driver vehicle company ownership checks and single-active-assignment guard.
- Driver quote server authorization through operational eligibility.
- Canonical Driver compliance concept.
- Invoice PDF validation before preview/send.
- Expo/React Native as canonical Driver mobile implementation.

### REPAIR

- Super Admin information architecture and page hierarchy.
- Super Admin table density, typography, action hierarchy and filtering.
- Driver Documents terminology and summary correctness.
- Driver Vehicle page layout and hierarchy.
- Driver Load quote UI fail-closed behaviour.
- Driver governance visibility.
- Company governance readiness visibility.
- Document Review state-aware actions.
- Platform Health latency semantics and integration readiness semantics.
- Invoice money/VAT canonicalisation.
- Invoice email terms source.
- Legacy/test production data reconciliation.

### CONSOLIDATE

- Compliance Overview / Onboarding Review / Document Review / Expiries into one coherent Compliance domain.
- Driver governance signals currently scattered across `drivers`, `profiles`, `company_memberships`, onboarding, identity registry, vehicle and compliance tables.
- Company governance + onboarding + company compliance into one read model for Platform Owner review.
- Shared Super Admin UI primitives instead of page-local inline style systems.
- Money fields and VAT source of truth.

### REMOVE / RETIRE

- Customer posted-load editing as an operational requirement. Posted job details remain authoritative; changes are communicated through Driver messages/instructions.
- Approve/Reject actions displayed on already-finalised compliance documents unless an explicit state transition remains valid.
- Hard-coded invoice overdue penalty text in the Driver invoice email component.
- Production-only visual/test fixtures after an explicit inventory and safe cleanup decision.
- Technical database terminology from normal Driver-facing copy where it does not help the Driver complete a task.

---

# 2. Visual design system — mandatory baseline

The redesign MUST use one common Super Admin/Driver operational visual grammar. Do not redesign individual pages independently.

## 2.1 Colour tokens

Use the established XDrive palette:

- `--xd-navy`: `#0B2F6B`
- `--xd-blue`: `#1D57D8`
- `--xd-orange`: `#F5A300`
- `--xd-white`: `#FFFFFF`
- `--xd-charcoal`: `#1A1F2B`
- `--xd-page`: `#F4F6F8`
- `--xd-border`: `#D9E1EA`
- `--xd-muted`: `#64748B`
- success: `#16A34A`
- danger: `#DC2626`

Orange is an accent/attention colour, not a dominant background.

## 2.2 Page geometry

Desktop operational baseline:

- viewport design target: 1366–1920 px wide;
- page horizontal padding: 20 px desktop, 16 px tablet, 12 px small screens;
- page vertical padding: 16 px;
- content max-width: none for operational tables, but maintain 20 px breathing room;
- header height target: 64–72 px;
- section gap: 16 px;
- card gap: 12–16 px;
- table row target: 48–56 px;
- table header target: 40–44 px;
- drawer width: 440–520 px desktop;
- modal width: 520–760 px depending on task;
- border radius: 6 px for operational surfaces, 8 px only for prominent cards/modals;
- shadows: minimal; use border hierarchy first.

## 2.3 Typography

Do not use 10 px as the normal working text size.

- page title: 24 px / 700–800;
- section title: 16–18 px / 700;
- table/body: 13–14 px;
- secondary/body: 12–13 px;
- labels/eyebrows: 11–12 px, uppercase only where useful;
- status badge: 11–12 px;
- button text: 12–13 px;
- minimum normal interactive text: 12 px.

## 2.4 Buttons

Button hierarchy:

- Primary action: filled royal blue.
- Positive approval: filled/outlined green only when the operation is truly positive and allowed.
- Secondary: white + border.
- Destructive/reject/suspend/revoke: red outlined by default; filled red only in final confirmation.
- Text-link action only for low-risk navigation.

Minimum button height: 34 px desktop, 40 px touch-heavy layouts.

No page should present several equally weighted actions without a clear primary path.

## 2.5 Status language

User-facing statuses must be task-oriented.

Driver examples:

- `Ready to work`
- `Waiting for review`
- `Action required`
- `Vehicle missing`
- `Document expired`

Super Admin can expose technical status in details, but the main table should use business meaning.

## 2.6 Common table pattern

Every major Super Admin register should support, where relevant:

1. Page title and one-line description.
2. Compact summary strip.
3. Search input.
4. Status tabs.
5. Secondary filters.
6. Sort.
7. Data table.
8. Row click/detail drawer.
9. Contextual actions inside the drawer or rightmost action column.
10. Pagination.

The table must not require users to infer hidden API capability that is not exposed in UI.

---

# 3. Information architecture — Super Admin

## 3.1 Top navigation

Keep top-level domains but reduce duplication and clarify scope:

- Dashboard
- Marketplace
- Operations
- Fleet
- Companies
- Finance
- Compliance
- Support
- Platform

`XDrive Logistics` remains a product/workspace switch, not another governance domain.

## 3.2 Compliance domain

Target navigation:

- Compliance Overview
- Onboarding Review
- Document Review
- Expiry Tracking
- Insurance
- Operator Licences
- Identity & Fraud

Do NOT permanently place a full Onboarding Approval Queue above the Document Review table. Onboarding is a separate operational queue with different decision semantics.

---

# 4. Super Admin — Command Centre

## Current problems

- Too many large summary cards for very small data.
- Operational queue is useful but visually flat.
- `Degraded services` can show unknown while Platform Health separately claims healthy.
- Critical actions and normal KPIs compete for the same visual weight.
- Large empty horizontal areas.

## Target layout

### Header

Left:
- `Command Centre`
- environment badge (`STAGING`, `PRODUCTION`)
- last refresh time

Right:
- `Refresh`
- `Open Platform Health` when health is degraded

### KPI strip

One compact row, 4–5 cards maximum:

- Active Companies
- Open Jobs
- Pending Approvals
- Unpaid Invoices
- Platform Health

Height: 76–88 px.

### Critical attention

Use one alert panel with severity chips:

`P0 / P1 / P2`

Each item:
- entity;
- human-readable reason;
- age;
- one `Review` action.

### Runtime gate

PASS only when:
- counts match production queries;
- queue links land on the correct entity/task;
- Platform Health state matches Platform Health semantics;
- no stale/unknown health state is represented as OK.

Verdict: **REPAIR**.

---

# 5. Super Admin — Companies Governance

## Current backend strength

Keep:
- owner-only auth;
- server-side pagination/search;
- allowed transitions;
- reason requirement for reject/suspend;
- compliance assertion before activation;
- atomic governance RPC/audit path.

## Current UI defects

- API search/filter capability is not presented as a first-class workflow.
- `Active` can be mistaken for `fully compliant`, which is false for legacy records.
- approval action does not first show the complete readiness decision in the list.
- audit history occupies table space that should be in a drawer.

## Target page

### Summary

- Total
- Active
- Pending approval
- Suspended
- Rejected
- Legacy/incomplete compliance

### Tabs

`All | Pending | Active | Suspended | Rejected | Legacy incomplete`

### Search

Search by:
- company name;
- company number;
- email;
- XDrive member/company ID when available.

### Columns

- Company
- Governance
- Compliance
- Type
- Registration
- Primary contact
- Members
- Drivers
- Last activity
- Action

### Company detail drawer

Sections:

1. Identity / legal data.
2. Governance status.
3. Onboarding application(s).
4. Required compliance.
5. Company documents.
6. Drivers/vehicles.
7. Governance history.
8. Actions.

### Approval rule

The UI must display server-derived readiness before enabling Approve.

Never derive final readiness only in the browser.

### Legacy state

Introduce a read-model state such as:

- `ready`
- `under_review`
- `blocked`
- `legacy_incomplete`
- `not_applicable`

Do not silently rewrite historical `active` companies before reconciliation.

Verdict: **KEEP BACKEND / REPAIR UI + DATA READ MODEL**.

---

# 6. Super Admin — Onboarding Review

This becomes a dedicated page.

## Queue eligibility

Default queue contains only applications requiring Platform Owner action:

- submitted;
- under_review;
- request_changes.

Rejected/suspended company governance must disable approval.

## Columns

- Applicant
- Company
- Account Type
- Governance
- Identity
- Company Compliance
- Vehicle Compliance
- Risk
- Application Status
- Submitted / Updated
- Action

## Readiness badge

Use one of:

- `READY FOR APPROVAL`
- `ACTION REQUIRED`
- `BLOCKED BY COMPANY`
- `RISK REVIEW`

## Review drawer

Show exact requirement ledger:

- requirement name;
- required/optional;
- evidence present;
- evidence current;
- review status;
- expiry;
- reason if blocked;
- provenance/source.

Bottom actions:

- Approve onboarding
- Request changes
- Reject onboarding

Reject and request-changes require a reason.

## Dannyel Bill Sole Trader gate

Expected evidence based on the current audited state:

- Driving Licence verified;
- Proof of Address satisfied by accepted policy/evidence;
- Right to Work verified;
- MOT approved/current;
- Vehicle Insurance approved/current;
- canonical vehicle assigned;
- risk clear;
- company active.

Runtime PASS requires authenticated owner action and post-action DB verification. Static code is not sufficient.

Verdict: **REPAIR / SEPARATE PAGE**.

---

# 7. Super Admin — Document Review

## Backend

KEEP:

- platform-owner authentication;
- private bucket resolution;
- short-lived signed URL;
- audit log on document view;
- feature flag for review;
- DB RPC for review mutation.

## UI defects

- finalised approved/verified rows still expose `Approve` and `Reject` visually.
- all document families are mixed without useful operational filtering.
- audit/history context is absent at decision point.
- the table is too sparse horizontally and too dense typographically.

## Target filters

Primary tabs:

- Needs Review
- Expiring Soon
- Rejected
- All

Family filter:

- Identity
- Driver
- Vehicle
- Company

Search:

- entity name;
- company;
- registration;
- document type.

## Target columns

- Owner / Entity
- Company
- Family
- Document
- Status
- Issued
- Expiry
- Uploaded
- Review state
- Action

## State-aware actions

### pending / under_review / unverified

- View
- Approve
- Reject

### approved / verified

- View
- View audit

No generic `Approve` again.

If future product requirements allow reversal, implement an explicit `Revoke approval` state transition with mandatory reason and DB support. Do not overload `Reject` to mean revoke.

### rejected

- View
- View reason
- Re-review only if the backend explicitly supports a valid transition.

Verdict: **KEEP SECURITY / REPAIR WORKFLOW + VISUAL**.

---

# 8. Super Admin — Drivers Governance

## Current defect

The current Drivers page behaves primarily as an availability/location table. It is not sufficient as a Platform Owner governance page.

Production currently contains driver records with incomplete profile/membership/identity linkage. Displaying `Unknown driver` without explaining the missing relationships hides the actual governance defect.

## Target columns

- Driver
- Company
- Governance
- Platform Identity
- Personal Compliance
- Vehicle Compliance
- Canonical Vehicle
- App Access
- Commercial Bidding
- Availability
- Last Seen
- Action

## Derived state

Build a server-side Driver Governance read model from:

- `drivers`;
- `profiles`;
- `company_memberships`;
- `platform_identity_registry`;
- onboarding application;
- canonical compliance resolver;
- vehicle assignment;
- company governance.

Examples:

- `READY`
- `IDENTITY INCOMPLETE`
- `MEMBERSHIP MISSING`
- `COMPANY BLOCKED`
- `COMPLIANCE EXPIRED`
- `VEHICLE MISSING`
- `LEGACY RECORD`

## Driver drawer

Display:

1. Account.
2. Company membership.
3. Platform identity.
4. Onboarding.
5. Personal documents.
6. Vehicle.
7. Operational eligibility.
8. Availability/location.
9. Audit events.

No destructive remediation is performed automatically from this screen until the production legacy inventory is classified.

Verdict: **REBUILD PAGE ON EXISTING DATA CONTRACTS**.

---

# 9. Super Admin — Fleet Availability / Fleet Positions

## Keep

- server-resolved latest driver location;
- company mapping;
- availability status.

## Repair

Availability and Fleet Positions should not be two almost-identical tables.

Target:

### Driver Availability

Operational readiness:
- Driver;
- company;
- availability;
- current/last known area;
- last seen;
- vehicle;
- active job;
- status.

### Fleet Positions

Map-focused operational view:
- interactive map;
- driver list rail;
- last update age;
- stale-location indicator;
- active-job relationship.

Never represent old location as live position without an age/stale indicator.

Verdict: **CONSOLIDATE RESPONSIBILITIES**.

---

# 10. Super Admin — Platform Health

## Critical semantic defect

HTTP success must not automatically mean `Healthy` when response latency is operationally unacceptable.

## New health model

Each check returns separately:

- `availability`: up/down;
- `latency_ms`;
- `performance_state`;
- `last_checked_at`;
- optional dependency error.

Suggested default latency thresholds:

- `< 500 ms`: healthy;
- `500–2000 ms`: degraded;
- `> 2000 ms`: severe/degraded;
- timeout / network failure / 5xx: error.

Allow service-specific thresholds later.

Overall Platform Health:

- ERROR if any critical dependency is unavailable;
- DEGRADED if any critical dependency is degraded/severe;
- HEALTHY only if all critical checks are healthy.

## Integration readiness semantics

Separate:

- `Configured`
- `Connection verified`
- `Operational`
- `Last successful check`

Environment variable presence alone must not be labelled operational readiness.

No secret value may be exposed.

## Services to test

At minimum:

- Supabase DB;
- Supabase Storage;
- Notification store;
- Email/Resend;
- Companies House where a safe metadata call exists;
- Stripe where a safe authenticated metadata check exists;
- Google Maps/provider configuration/readiness;
- Redis/Upstash;
- core Super Admin APIs.

Verdict: **P0 REPAIR**.

---

# 11. Driver Workspace — global visual rules

Driver screens must answer these questions immediately:

1. Can I work?
2. What load/job am I dealing with?
3. What action do I need to take now?
4. What is blocking me?
5. What evidence/action fixes it?

Avoid exposing internal terms such as:

- canonical registry;
- legacy reconciliation;
- remediation payload;
- server-authoritative eligibility;

unless placed under `Technical details`.

Use task language instead.

---

# 12. Driver — Documents / Compliance

## Current strength

- separate personal and vehicle compliance data;
- upload actions;
- secure server APIs;
- operational blockers;
- accepted policy relationship between Driving Licence and Proof of Address;
- preservation of legacy evidence.

## Current defects

- technical terminology dominates the page;
- summary `Vehicle approvals` must not simply count all approved vehicle documents;
- legacy evidence is too prominent;
- the Driver is shown implementation detail rather than the fastest route to eligibility.

## Target page

### Hero status

One prominent status card:

- `Ready to work`
- `Waiting for Platform review`
- `Action required`

One-line explanation.

### Personal compliance

Rows/cards:

- Driving Licence
- Proof of Address
- Right to Work
- optional CPC/visa/other based on account type

Each row:

- status;
- expiry;
- action (`Upload`, `Replace`, `View status`).

### Vehicle compliance

Header:

`KM57CXL — Mercedes Sprinter`

Requirements:

- MOT
- Vehicle Insurance

Only the canonical active vehicle contributes to the visible 2/2 summary.

`Vehicle approvals 2/2` requires:

- one valid/current approved MOT;
- one valid/current approved vehicle insurance;
- both for the same canonical active vehicle.

### Previous documents

Collapsed section:

`Previous documents (N)`

Legacy/reconciliation details stay there unless action is required.

Verdict: **REPAIR + REDESIGN**.

---

# 13. Driver — Vehicle

## Current strength

Keep server rules:

- only owner/admin company member can manage company vehicles;
- regular company Driver gets read-only assigned vehicles;
- same-company check;
- active vehicle required;
- prevent assignment if assigned elsewhere;
- prevent second active assigned vehicle;
- conditional update protects races.

## Target layout

### Active vehicle card

Prominent:

- registration;
- make/model;
- type;
- payload;
- pallet capacity;
- equipment;
- active/canonical state.

Actions:

- Edit vehicle (authorized users only)
- Documents
- Unassign

### Other vehicles

Separate compact register below for company owner/admin.

Remove redundant left rail when the same data is already shown in the active vehicle card.

For company Driver read-only mode, display only assigned vehicle and a short note: `Fleet changes are managed by your company.`

Verdict: **KEEP LOGIC / REDESIGN PAGE**.

---

# 14. Driver — Loads / Quote

## Rule

Browse may remain available when compliance is incomplete; quoting may not.

## UI fail-closed contract

When `quoteEligibility.eligible !== true`:

- quote CTA visually disabled;
- quote modal cannot open;
- clicking a disabled CTA should direct to the blocker summary or Documents;
- show one concise reason with `Fix compliance` link;
- server POST remains authoritative and rejects any attempted bypass.

## Modal

The quote modal must never imply quote submission is possible if eligibility is false.

## Runtime gate

Test both sides:

1. non-eligible authenticated Driver:
   - browse loads works;
   - quote button disabled;
   - no modal submit path;
   - API rejects direct POST.

2. eligible authenticated Driver:
   - quote opens;
   - valid amount submits;
   - bid persists;
   - UI refresh shows quote state.

Verdict: **P0 REPAIR UX**.

---

# 15. Driver — Invoice / Finance

## P0 data problem

There must be one canonical money model.

Current repository/runtime history has evidence of multiple overlapping monetary fields:

- `net_amount`;
- `vat_amount`;
- `amount`;
- `subtotal`;
- `total`;
- `agreed_gross_amount`;
- VAT treatment/rate.

## Canonical model proposal

For invoice financial truth:

- `net_amount` = canonical pre-tax amount;
- `vat_rate` = canonical rate;
- `vat_amount` = canonical tax amount;
- `amount` = canonical gross amount;
- `vat_treatment` = canonical tax treatment.

Legacy `subtotal`, `total`, `agreed_gross_amount` may remain for compatibility only after explicit mapping and cannot independently drive final PDF/send calculations.

## Required work

1. Inventory every read/write of money columns.
2. Define conversion rules per historical invoice state.
3. Build a dry-run discrepancy report.
4. Backfill only unambiguous rows through a migration.
5. Add/check constraints where safe.
6. Make edit/preview/send use the same canonical calculation helper.
7. Verify VAT registered / not registered / reverse charge scenarios.

## Invoice email

REMOVE hard-coded commercial penalty sentence:

`£25.00 per week after 7 days overdue`

Replace with one of:

- configured Company Invoice Terms;
- configured platform template tokens;
- no penalty text by default.

No legal/commercial penalty is silently injected by front-end source code.

## Runtime gate

- draft preview succeeds when totals/treatment are valid;
- invalid draft gives precise remediation message;
- PDF totals equal UI totals;
- send attaches the same PDF;
- sending changes status only through intended mutation;
- email terms match configured company terms.

Verdict: **P0 DATA + FUNCTIONAL REPAIR**.

---

# 16. Production company/onboarding data reconciliation

## Observed production shape at audit time

Companies:

- 18 total;
- 13 active;
- 4 pending approval;
- 1 rejected.

Compliance document rows:

- driver documents exist;
- identity documents exist;
- vehicle documents exist;
- company documents currently total zero.

The company table includes legacy/test/visual-audit shaped records and active companies with no canonical onboarding linkage.

## Principle

Do not assume `company.status = active` means modern onboarding compliance is complete.

## Reconciliation ledger

Generate a read-only row per company:

- company id/name;
- created date;
- company type;
- governance status;
- creator;
- memberships count;
- driver count;
- linked onboarding count;
- onboarding account type/status;
- company-doc requirements;
- company-doc evidence;
- identity registry linkage;
- operational activity counts;
- classification.

Classification:

- `CANONICAL_CURRENT`
- `LEGACY_VALID_NEEDS_LINKAGE`
- `LEGACY_INCOMPLETE`
- `TEST_FIXTURE_CONFIRMED`
- `UNKNOWN_REQUIRES_REVIEW`

No row is deleted or suspended merely because its name looks like a test record.

## Cleanup gate

Destructive cleanup requires:

- no commercial/job/invoice/document/audit dependencies requiring preservation;
- explicit classification as test fixture;
- rollback/audit plan;
- separate migration/script.

Verdict: **P0/P1 DATA GOVERNANCE**.

---

# 17. Production Driver reconciliation

Generate a Driver ledger with:

- driver id;
- user id;
- display name;
- auth/profile existence;
- profile state;
- company;
- membership;
- driver status;
- app_access;
- can_commercial_bid;
- onboarding;
- platform identity;
- personal compliance;
- assigned vehicle;
- vehicle compliance;
- operational eligibility;
- active job/history counts;
- classification.

Important contradictions must be visible, for example:

- active Driver without profile;
- active Driver without membership;
- app access enabled without platform identity;
- Driver under rejected/suspended company;
- commercial bid allowed while eligibility fails.

Do not repair by manually forcing flags independently. The remediation must restore the canonical relationship chain.

Verdict: **P0 GOVERNANCE AUDIT BEFORE CLEANUP**.

---

# 18. `spatial_ref_sys` advisory

Current audited state identifies `public.spatial_ref_sys` as PostGIS-managed and owned by `supabase_admin` with RLS disabled.

Policy:

- do not enable RLS blindly;
- do not alter extension-owned system/reference tables solely to silence a generic advisory;
- document as extension-managed exception unless the installed Supabase/PostGIS version explicitly requires a supported hardening action.

Verdict: **KEEP / DOCUMENT EXCEPTION — NO BLIND DDL**.

---

# 19. Auth Hooks

No Auth Hook is required merely because the Auth Hooks page is empty.

Add an Auth Hook only when a concrete requirement needs it and the hook materially improves security/workflow.

Do not move existing application governance logic into Auth Hooks without a design decision.

Verdict: **NO ACTION**.

---

# 20. Security invariants

Every implementation slice must preserve:

- server verifies bearer token;
- privileged route verifies the authoritative role/membership;
- browser never supplies trusted company/user/role identity without server validation;
- service-role access stays server-side;
- no public signed-document path longer than required;
- every privileged review/governance action is audited;
- destructive actions require reason/confirmation where appropriate;
- RLS is not weakened;
- client UI cannot grant capability absent from backend;
- backend remains fail-closed on ambiguous eligibility.

---

# 21. Execution sequencing

## Phase 0 — Freeze and truth baseline

1. Keep PR #405 DRAFT / NOT MERGED until its own runtime gate is resolved.
2. Do not add the broad redesign to PR #405.
3. Record current production company/driver reconciliation snapshots.
4. Record current invoice money discrepancy report.
5. Record current Platform Health latency sample.

Exit gate: reproducible truth baseline exists.

## Phase 1 — P0 functional correctness

1. Platform Health semantics.
2. Driver Quote UI fail-closed.
3. Invoice canonical money/VAT consistency.
4. Remove/configure hard-coded invoice penalty text.
5. Company/Driver governance read models.

Exit gate: no known UI says `healthy/ready/allowed` when authoritative data says otherwise.

## Phase 2 — Compliance information architecture

1. Dedicated Onboarding Review page.
2. Document Review state-aware actions.
3. Compliance Overview.
4. Expiry queue integration.

Exit gate: Platform Owner can complete onboarding/document review without navigating contradictory queues.

## Phase 3 — Companies + Drivers governance UI

1. Companies Governance redesign.
2. Driver Governance redesign.
3. detail drawers and audit history.
4. search/filter/pagination.

Exit gate: legacy/canonical distinction visible and actionable without hidden DB knowledge.

## Phase 4 — Driver visual convergence

1. Driver Documents redesign.
2. Driver Vehicle redesign.
3. Load quote blocker presentation.
4. Invoice detail/email convergence.

Exit gate: Driver can identify work readiness and required action in under one screen.

## Phase 5 — Production reconciliation cleanup

Only after ledger review:

1. safe linkage/backfill migrations;
2. remove confirmed disposable test fixtures;
3. preserve audit/commercial history;
4. rerun governance ledgers.

Exit gate: no unexplained active Driver/company without a classified governance state.

## Phase 6 — Final runtime gates

Authenticated runtime testing for:

- Platform Owner onboarding;
- document review;
- company governance;
- Driver compliance;
- vehicle assignment;
- load quote;
- invoice preview/send;
- Platform Health;
- mobile/Expo execution gates from the canonical project checkpoint.

No static-only PASS.

---

# 22. Branch/PR strategy

Do not continue accumulating unrelated work in PR #405.

Recommended slices after #405:

### PR A — Platform truth and health

- health semantics;
- integration state wording;
- quote UX fail-closed;
- no broad visual redesign.

### PR B — Finance canonicalisation

- money/VAT model;
- migration/backfill;
- invoice email terms configuration;
- finance tests.

### PR C — Compliance IA

- dedicated Onboarding Review;
- Document Review state-aware UI;
- shared compliance navigation;
- no Companies/Drivers redesign yet.

### PR D — Governance read models + pages

- Companies Governance;
- Driver Governance;
- legacy/canonical state indicators.

### PR E — Driver visual convergence

- Documents;
- Vehicle;
- related Workspace components only.

### PR F — Reconciliation cleanup

- only after review of the produced production ledger;
- migration/data cleanup focused.

This keeps risk reviewable and prevents one PR from becoming a platform rewrite.

---

# 23. Required tests/gates per PR

Every PR must include, as applicable:

- typecheck;
- targeted unit/contract tests;
- server authorization tests;
- invalid-state tests;
- browser/runtime preview validation;
- Supabase migration replay/contract validation when DB changes exist;
- production verification for hosted migration effects;
- no RLS/security relaxation;
- no PR #359 visual import;
- no native Android resurrection;
- exact Netlify preview success on the PR HEAD before UI runtime PASS.

GitHub Actions infrastructure failure before runner execution is infrastructure-unavailable, not application failure and not application PASS.

---

# 24. Definition of visual completion

A page is visually complete only when:

- normal body text is readable without zoom;
- primary task is obvious in under 3 seconds;
- status is not encoded by colour alone;
- action hierarchy is clear;
- empty/loading/error states are designed;
- no large unused dead areas dominate the page;
- tables use the available width intentionally;
- search/filter controls match actual API capability;
- destructive actions have deliberate visual treatment;
- the same component patterns repeat across domains;
- mobile/tablet overflow remains usable.

---

# 25. Definition of functional completion

A function is complete only when all are true:

1. UI offers the action only in valid state.
2. API independently revalidates authorization/state.
3. DB mutation is atomic where concurrency matters.
4. audit history is durable where governance/compliance requires it.
5. failure is explicit and does not create partial state.
6. successful runtime effect is verified in production/preview as appropriate.
7. UI refresh agrees with DB truth.
8. no adjacent role gains unintended capability.

---

# 26. Immediate next action

Do not begin a broad UI rewrite inside PR #405.

Immediate execution order:

1. resolve/finalise the narrow #405 runtime state;
2. create the production Company + Driver reconciliation ledger read-only;
3. create the invoice canonical money discrepancy ledger read-only;
4. prepare PR A for Platform Health + Quote fail-closed;
5. prepare Finance PR separately;
6. then start the Compliance/Super Admin visual architecture from this document.

This document is the canonical execution plan for the audited Super Admin + Driver issues until superseded by a later dated checkpoint.