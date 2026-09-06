# XDrive Logistics — Super Admin MASTER CONTRACT FINAL

Status: FINAL contract for PR #505. This document is the normative source for the final Super Admin audit, shared-shell corrections and the exact enterprise navbar. Runtime code and contract checkers must agree with this document.

## 1. Command Centre KPI semantics

Command Centre KPI cards are non-interactive information surfaces.

- The loaded, loading and unavailable KPI states MUST render as enterprise `<div>` cards.
- Command Centre KPI cards MUST NOT render as `<a>` or Next.js `<Link>`.
- Navigation remains available through separately labelled controls such as `Full analytics`.
- Navigational enterprise cards outside the Command Centre KPI surface remain permitted.

## 2. Source-compliance design values

Canonical Super Admin values are:

- Blue: `#1A73E8`
- Green: `#34A853`
- Yellow: `#FBBC05`
- Red: `#EA4335`
- Grey: `#8A9099`
- White: `#FFFFFF`
- Background: `#F5F7FA`
- Text: `#4A4A4A`
- Border: `#E0E3E7`
- Radius: `8px`
- Shadow: `0px 2px 6px rgba(0,0,0,0.08)`
- Title: `Inter, 20px, 700`
- Body/control text: `14px` unless an explicit surface amendment below specifies otherwise.

SOURCE COMPLIANCE applies to component-emitted style declarations and design tokens. A conflicting emitted value is non-compliant even when a later CSS layer overrides it at runtime.

Legacy values appearing only inside compatibility-selector match expressions are not emitted design values and are not treated as a source-compliance violation.

## 3. Spacing contract and exact enterprise navbar amendment

`24px` is the canonical internal padding for enterprise containers, cards, panels, sections, dialogs, alerts, table header cells and table body cells.

`24px` is NOT a universal padding value for compact interactive controls.

Existing explicit compact exceptions remain:

- Status chips/badges: `4px 10px`
- Standard compact action/pager buttons: `0 14px`

The standard compact action/pager rule applies outside the enterprise navbar. The enterprise navbar is an explicit final surface amendment and uses its own exact geometry below.

### 3.1 Fundamental navbar rules

- Navbar MUST be `fixed` and permanently visible.
- Navbar MUST NOT contain a hamburger control.
- Navbar MUST NOT contain a hidden navigation menu.
- Navbar MUST NOT transform into a hamburger.
- Navbar MUST NOT use responsive hiding.
- Navbar MUST NOT shrink away primary navigation controls.
- When viewport width is insufficient, the navbar MUST preserve its controls through horizontal scrolling rather than hiding them.
- No navbar `@media` rule is permitted in the final master navbar CSS.

### 3.2 Exact navbar order

The visible order is exactly:

`XDrive Logistics | Search platform… | Explore areas | Action Centre | Platform Overview | Platform Owner`

Primary navigation routes are:

- `Explore areas` → `/super-admin/directory`
- `Action Centre` → `/super-admin/action-centre`
- `Platform Overview` → `/super-admin/platform`

### 3.3 Brand

- Label: `XDrive Logistics`
- Font: `Inter, 20px, 700`
- Icon: `24px`
- Navbar internal padding: `24px`

### 3.4 Search

- Full-width/flexible enterprise search surface.
- Placeholder: `Search platform…`
- Search icon: `24px`
- Padding: `12px 18px`
- Radius: `8px`
- Shadow: `0px 2px 6px rgba(0,0,0,0.08)`

### 3.5 Primary buttons

Visible buttons are exactly:

1. `Explore areas`
2. `Action Centre`
3. `Platform Overview`

Each uses:

- Padding: `12px 18px`
- Radius: `8px`
- Shadow: `0px 2px 6px rgba(0,0,0,0.08)`
- Icon: `24px`
- Icon spacing: `8px`
- Font: `Inter, 16px, 500`

### 3.6 User dropdown

The trigger is `Platform Owner`.

The dropdown displays the account email and exactly these options:

1. `Super Admin home`
2. `Explore all areas`
3. `Sign out`

`Sign out` MUST invoke the existing authenticated logout behaviour; it MUST NOT invent a non-existent sign-out endpoint.

Dropdown typography is `Inter, 14px, 400`.

Optional right-aligned status indicators may be introduced only for truthful Platform health, Notifications or Live status state and must not replace or hide any required navbar element.

## 4. StatusChip and page allowlists

The generic `StatusChip` may render truthful domain statuses beyond the eight named master status semantics, but it may use only canonical palette colours.

A page with an explicit displayed-status restriction MUST pass a page-specific allowlist to `StatusChip` and MUST fail closed for values outside that allowlist.

Required restricted surfaces:

- All Jobs: `posted`, `cancelled`, `delivered`
- Driver Availability: `available`, `offline`

The master semantic colour anchors remain:

- AVAILABLE → green
- OFFLINE → grey
- POSTED → blue
- CANCELLED → red
- DELIVERED → green
- READY → green
- ATTENTION → yellow
- CRITICAL → red

## 5. Vehicle Registry truth-preserving status

Vehicle Registry MUST preserve canonical vehicle truth.

- If canonical `is_available === true`, Status MUST render exactly `WAITING FOR NEXT JOB (AVAILABLE)`.
- If canonical `current_status` is exactly `waiting for next job (available)` case-insensitively, Status MUST render exactly `WAITING FOR NEXT JOB (AVAILABLE)`.
- A non-available vehicle MUST NOT be relabelled AVAILABLE.
- Otherwise the UI MUST display canonical `current_status`, then canonical `status` as fallback.
- If neither source contains a value, display `UNKNOWN`.

## 6. Support visible scope vs backend lifecycle

`SUPPORT VISIBLE CONTRACT` applies to the Super Admin Support Tickets presentation layer.

Visible columns are exactly:

`Ticket ID | Company | Type | Severity | Status | Created`

Visible actions are exactly:

`Open | Assign | Resolve`

- `Assign` remains non-mutating while no canonical audited Assign mutation exists.
- The visible Support Tickets UI MUST NOT expose `investigating`, `close` or `reopen` controls.
- Backend storage may retain `subject`, `category`, `priority` and other internal governance fields.
- Backend governance may retain audited lifecycle actions `investigating`, `resolve`, `close`, `reopen`.
- A richer backend lifecycle is not a UI-contract violation when those extra actions are not exposed by the visible Support Tickets surface.

## 7. Platform navigation and `/super-admin/users`

Platform governance destinations are exactly:

1. Global Settings
2. Legal & Agreements
3. Access Matrix
4. Feature Flags
5. Audit Logs

These are exposed from `Platform Overview` and the Super Admin Directory; they are not extra primary navbar buttons.

`All Users` and `Platform Admins` MUST NOT appear as visible Platform navigation destinations.

`Removed from nav` does NOT require physical deletion of owner-protected routes required by another canonical domain.

- `/super-admin/users` is a legacy aggregation entry point and MUST redirect to `/super-admin/settings/roles-permissions`.
- Access Matrix MUST NOT link to `/super-admin/users`.
- `/super-admin/users/drivers` may remain because Drivers belongs to Fleet.
- Other owner-protected user-role routes may remain physically present for control-plane inspection, but MUST NOT be promoted into Platform navigation without a contract amendment.

## 8. Jobs Management preview vs All Jobs workspace

These are two separate surfaces and MUST NOT be treated as interchangeable layout requirements.

### Operations Control Centre — Jobs Management Preview

- Embedded in Operations Control Centre.
- MUST use the fixed 3-column enterprise card grid.
- MUST NOT collapse the grid through a responsive breakpoint.
- Operational preview actions remain `View details` and non-mutating `Assign driver` where no governed mutation exists.

### All Jobs — Full Workspace

Route: `/super-admin/operations/jobs`

- MUST use the enterprise table primitive.
- Columns are exactly:

`Route | Status | Posting company | Awarded company | Bids | Created`

- Displayed statuses are restricted to `posted`, `cancelled`, `delivered` through the page allowlist.

## Final gate rule

A FINAL PASS requires all four dimensions to pass on the same HEAD:

1. SOURCE COMPLIANCE
2. RUNTIME COMPLIANCE
3. CHECKER COMPLIANCE
4. CONTRACT CONSISTENCY

A PASS does not authorize merge. PR #505 may be merged only after the explicit command `APROB MERGE #505`.
