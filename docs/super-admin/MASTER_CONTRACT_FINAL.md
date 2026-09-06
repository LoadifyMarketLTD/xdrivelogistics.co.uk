# XDrive Logistics — Super Admin MASTER CONTRACT FINAL

Status: FINAL contract for PR #505. This document is the normative source for the final Super Admin audit and shared-shell corrections. Runtime code and `__tests__/superAdminVisualContract.test.ts` must agree with this document.

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
- Body/control text: `14px`

SOURCE COMPLIANCE applies to component-emitted style declarations and design tokens. A conflicting emitted value is non-compliant even when a later CSS layer overrides it at runtime.

Legacy values appearing only inside compatibility-selector match expressions are not emitted design values and are not treated as a source-compliance violation.

## 3. Spacing contract

`24px` is the canonical internal padding for enterprise containers, cards, panels, sections, dialogs, alerts, table header cells and table body cells.

`24px` is NOT a universal padding value for compact interactive controls.

Explicit compact exceptions are:

- Status chips/badges: `4px 10px`
- Standard compact action/pager buttons: `0 14px`

No other compact padding value may be introduced without an explicit contract amendment.

### Shared Super Admin topbar amendment

The shared Super Admin topbar is a compact enterprise control surface, not an enterprise content card. Its desktop contract is:

- Height: `76px` (inside the approved `72–80px` topbar range).
- Horizontal shell padding: `24px`.
- Primary control gap: `12px`.
- Search and topbar controls: `40px` high.
- Search maximum width: `480px`.
- Account control: `170–200px` wide on desktop.
- Radius: `8px`.
- Background: `#FFFFFF`.
- Bottom border: `1px solid #E0E3E7`.
- The topbar itself MUST NOT use a decorative box shadow or backdrop blur.
- Topbar buttons use the standard compact `0 14px` padding and one neutral border/background treatment.
- The keyboard shortcut uses the compact badge padding `4px 10px`.
- The account control displays `Platform Owner` only; the account email remains available inside the account dropdown and MUST NOT be permanently displayed in the topbar.
- Yellow `#FBBC05` is reserved for warning/accent semantics. `Action Centre` MUST NOT use a permanent yellow border or yellow-filled background; only its warning icon may use yellow at rest.

Responsive contraction may hide control labels or the account label when space is insufficient, but MUST preserve the same canonical colour, radius and compact-control system.

### Professional primary navigation amendment

The shared Super Admin shell MUST expose the complete workspace navigation through a professional two-level navigation system.

Desktop navigation contains exactly the workspace groups already defined in `SUPER_ADMIN_WORKSPACE_DEFINITION`, in that source order:

`Dashboard | Marketplace | Operations | Fleet | Companies | Finance | Compliance | Support | Platform`

- Every top-level group MUST reveal its submenu on mouse hover and keyboard focus.
- Hovering or focusing a top-level group MUST NOT navigate away from the current page.
- Each submenu MUST expose every child route defined for that group, in source order, with no silently hidden child options.
- Selecting a submenu item performs the existing route navigation only; this amendment introduces no new mutation behaviour.
- The currently active group and route MUST receive a visible active state using the canonical palette.
- Desktop navigation controls use the same `40px` compact-control height, `8px` radius and canonical neutral/blue styling as the topbar.
- Dropdown panels are enterprise panels and therefore use `24px` internal padding, canonical border/radius, white background and the canonical light shadow.
- On widths at or below `1180px`, the desktop group row is replaced by a hamburger control in the topbar.
- Opening the hamburger MUST expose all nine groups and every child option in a scrollable navigation panel; mobile/tablet navigation MUST NOT hide functionality that is available on desktop.
- The existing Super Admin directory may remain as a secondary navigation surface, but it is not a substitute for the primary navbar/hamburger system.
- Navigation changes MUST NOT alter route authorization, backend behaviour, Production data, or the established Platform submenu restriction below.

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

Platform navigation is exactly:

1. Global Settings
2. Legal & Agreements
3. Access Matrix
4. Feature Flags
5. Audit Logs

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
