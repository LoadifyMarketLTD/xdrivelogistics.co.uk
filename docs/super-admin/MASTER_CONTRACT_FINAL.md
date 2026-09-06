# XDrive Logistics — MASTER CONTRACT FINAL v2 — SUPER ADMIN

Status: FINAL, integrated and non-interpretable contract for PR #505 and validation checker PR #509. Every Super Admin component, page, style, status, action and geometry MUST comply exactly. No approximation, implicit exception or responsive substitution is permitted.

## 0. SUPREME RULE

Every component, every page, every style, every status, every action and every geometry MUST respect the exact values in this contract.

## 1. DESIGN SYSTEM ENTERPRISE

### 1.1 Radius

`8px` everywhere: cards, panels, sections, tables and dialogs.

### 1.2 Shadow

`0px 2px 6px rgba(0,0,0,0.08)` everywhere on enterprise surfaces.

### 1.3 Spacing

- Enterprise container spacing: `24px`
- Enterprise button spacing: `12px 18px`
- StatusChip: `4px 10px`
- Pager buttons: `0 14px`
- Compact table actions: `0 12px`

### 1.4 Typography

- Titles: `Inter, 20px, 700`
- Buttons: `Inter, 16px, 500`
- Dropdown: `Inter, 14px, 400`

### 1.5 Icons

Icons are `24px` everywhere.

### 1.6 Enterprise palette

- Blue: `#1A73E8`
- Green: `#34A853`
- Yellow: `#FBBC05`
- Red: `#EA4335`
- Grey: `#8A9099`
- Background: `#FFFFFF`

## 2. NAVBAR ENTERPRISE

### 2.1 Behaviour

- MUST NOT contain a hamburger.
- MUST NOT collapse.
- MUST NOT use responsive hiding.
- MUST be fixed and permanently visible.
- MUST preserve every required item at insufficient viewport width by horizontal scrolling, never by hiding or collapsing controls.
- Navbar contract CSS MUST NOT contain an `@media` rule.

### 2.2 Exact visible structure and order

`XDrive Logistics | Search platform... | Explore areas | Action Centre | Platform Overview | Platform Owner`

Required destinations:

- `Explore areas` → `/super-admin/directory`
- `Action Centre` → `/super-admin/action-centre`
- `Platform Overview` → `/super-admin/platform`

### 2.3 Geometry

- Navbar padding: `24px`
- Enterprise buttons: `12px 18px`
- Icon spacing: `8px`
- Icons: `24px`
- Radius: `8px`
- Shadow: `0px 2px 6px rgba(0,0,0,0.08)`

### 2.4 Brand

- `XDrive Logistics`
- `Inter, 20px, 700`
- icon `24px`

### 2.5 Search

- placeholder exactly `Search platform...`
- flexible/full-width enterprise search
- search icon `24px`
- padding `12px 18px`
- radius `8px`
- exact enterprise shadow

### 2.6 Primary navigation buttons

Exactly:

1. `Explore areas`
2. `Action Centre`
3. `Platform Overview`

Typography: `Inter, 16px, 500`.

### 2.7 User dropdown

Trigger: `Platform Owner`.

The account email is shown and the options are exactly:

1. `Super Admin home`
2. `Explore all areas`
3. `Sign out`

`Sign out` uses `/auth/sign-out`, which invokes the existing authenticated logout implementation and does not introduce a second authentication mechanism.

Dropdown typography: `Inter, 14px, 400`.

## 3. DIRECTORY 3 × 3 FIX

- Exactly 3 columns × 3 rows for the nine canonical Super Admin groups.
- No responsive breakpoint may alter the Directory grid.
- Enterprise cards use the exact radius, shadow and container spacing.
- Icons: `24px`.
- Titles: `Inter, 20px, 700`.

## 4. COMMAND CENTRE ENTERPRISE

- KPI cards are enterprise `<div>` information surfaces, never `<Link>`.
- Exactly four KPI summary cards.
- Required sections: `Critical attention`, `Operational queue`, `Administrative activity`.

## 5. OPERATIONS CONTROL CENTRE

- Exactly six enterprise KPI surfaces.
- Live Operational Map covers UK + Ireland.
- Quick Actions is present.
- Live Feed contains the five canonical event types.

## 6. JOBS MANAGEMENT

- Operations Control Centre — Jobs Management Preview uses a fixed three-column preview grid showing 3–6 cards as data permits.
- It MUST NOT collapse to a one-column responsive layout.
- Visible actions: `View details`, `Assign driver`.
- Assign remains non-mutating where no governed mutation exists.
- All Jobs — Full Workspace remains a separate enterprise table.

## 7. DRIVERS CENTER

- Layout is fixed `2×2` or `4×1`; current canonical implementation is two columns.
- MUST NOT collapse to one column.
- Visible actions: `View profile`, `Assign job`.

## 8. FLEET OVERVIEW

- Fixed `4×1` layout.
- Tail-lift, GPS and Health indicator are present.
- Status is truth-preserving.
- MUST NOT collapse to one column.

## 9. VEHICLE REGISTRY

- If canonical `is_available === true`, render exactly `WAITING FOR NEXT JOB (AVAILABLE)`.
- If not available, render the real canonical status without invention.
- A non-available vehicle MUST NOT be relabelled AVAILABLE.
- If no canonical status exists, fail closed as `UNKNOWN`.

## 10. DRIVER AVAILABILITY

Displayed status allowlist is exactly:

- `AVAILABLE`
- `OFFLINE`

Values outside the allowlist fail closed.

## 11. ACTIVE COMPANIES

Exact labels include:

- `Company Name`
- `Reg. Number`

## 12. FINANCE ENTERPRISE

Required surfaces:

- Four enterprise KPI cards
- `Weekly Earnings`
- `Expense Breakdown`
- `Top Clients`

Finance remains truth-preserving. If an authoritative expense ledger or canonical client-ranking dataset is unavailable, the required panel remains visible and explicitly renders `Unavailable`; monetary values, expenses, profit or rankings are not fabricated.

## 13. COMPLIANCE

Exact titles:

- `Insurance`
- `Operator Licences`

Exact visible actions:

- `Review docs`
- `Request update`

No mutation is invented for `Request update`.

## 14. SUPPORT

- UI DTO remains deliberately clean.
- Backend governance may be richer than the visible UI.
- Visible actions are exactly `Open`, `Assign`, `Resolve`.
- `Assign` remains visual-only while no canonical audited Assign mutation exists.
- Visible UI MUST NOT expose `investigating`, `close` or `reopen` controls.
- Backend governance may retain audited lifecycle actions `investigating`, `resolve`, `close`, `reopen`.

## 15. PLATFORM

Visible Platform governance navigation is exactly five pages:

1. `Global Settings`
2. `Legal & Agreements`
3. `Access Matrix`
4. `Feature Flags`
5. `Audit Logs`

The settings page title is exactly `Global Settings`.

Additional physical owner-protected routes may remain only when required by an existing canonical domain; they MUST NOT be promoted into Platform navigation without an explicit contract amendment.

`/super-admin/users` remains a legacy aggregation entry and redirects to `/super-admin/settings/roles-permissions`.

## 16. STATUS PALETTE

Canonical semantic statuses:

- `available`
- `offline`
- `posted`
- `cancelled`
- `delivered`
- `ready`
- `attention`
- `critical`

Restricted pages MUST pass explicit allowlists and fail closed outside them.

## 17. LEGACY VALUES

- Legacy value removal is progressive across historical source.
- Every touched/finalized surface MUST emit the v2 contract values.
- Checker coverage MUST be extended with each finalized surface.
- Compatibility-selector literals that only match historical markup are not emitted design values.

## 18. FORBIDDEN RESPONSIVE COLLAPSE

The following layouts MUST NOT have responsive rules that collapse their canonical grids:

- Directory
- Jobs Management preview
- Drivers Center
- Fleet Overview

## 19. CHECKER CONTRACT — PR #509 VALIDATION VEHICLE

The checker verifies at minimum:

1. no hamburger implementation;
2. brand presence;
3. exact search placeholder;
4. all three primary navbar buttons and exact destinations;
5. Platform Owner dropdown and exact options;
6. exact navbar geometry;
7. no navbar collapse, responsive hiding or navbar `@media`;
8. exact DOM/source order of required navbar elements;
9. TSX parsing as an AST and absence of forbidden hamburger identifiers;
10. Directory fixed 3×3 and no Directory breakpoint;
11. Command Centre KPI `<div>` semantics and required sections;
12. Operations Control Centre KPI/map/quick-actions/five-event contract;
13. Jobs/Drivers/Fleet fixed layout and actions;
14. vehicle status truth preservation;
15. Driver Availability allowlist;
16. Active Companies labels;
17. Finance four KPI + Weekly Earnings + Expense Breakdown + Top Clients;
18. Compliance titles/actions;
19. Support DTO/actions/backend distinction;
20. Platform five-page navigation and `Global Settings` title;
21. exact v2 spacing, typography, icon, palette, radius and shadow tokens;
22. release-gate inclusion for PR #505, #506 and validation PR #509.

## 20. FINAL GATE / SELF-VERIFICATION

A `100/100` or FINAL PASS may be declared only when the same exact HEAD has all of the following evidence:

1. SOURCE COMPLIANCE — PASS
2. CHECKER COMPLIANCE — PASS
3. CONTRACT CONSISTENCY — PASS
4. TypeScript/build release gate — PASS
5. Canonical Netlify `netlify/xdrivelogistics/deploy-preview` — READY/SUCCESS with exact `commit_ref`
6. RUNTIME COMPLIANCE — authenticated, read-only browser verification of the required Super Admin routes and navbar behaviour on that exact HEAD
7. PR/HEAD COMPLIANCE — validation evidence refers to the exact current head and not an earlier deploy

GitHub Actions are excluded from validation evidence.

A PASS never authorizes merge. PR #505 may be merged only after the exact explicit command `APROB MERGE #505`. PR #509 is validation-only and MUST NEVER be merged.
