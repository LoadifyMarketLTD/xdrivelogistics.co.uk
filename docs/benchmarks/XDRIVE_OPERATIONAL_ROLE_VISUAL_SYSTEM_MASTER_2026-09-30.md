# XDrive Operational Role Visual System Master
Date: 2026-09-30
Status: FINAL SHARED EXECUTION CONTRACT
Scope: all operational workspaces. Super Admin excluded.

## 1. Purpose
This file is the mandatory visual base contract for Customer, Broker, Owner Driver, Employed Driver, Fleet Manager, Dispatcher, Finance, Compliance and Carrier.
Every role-specific blueprint MUST be read together with this file.
If a role blueprint does not explicitly override a value, the value in this master applies exactly.
An agent may not invent a new spacing, width, height, typography size, grid, radius, breakpoint or component anatomy.

## 2. Canonical shell
Global header: 50px.
Primary navigation: 40px.
Total sticky shell chrome: 90px.
Header horizontal padding: 16px.
Header internal gap: 14px.
Logo button: 136px x 44px.
Logo image: 136px x 36px.
Header standard action: 32px high, 12px horizontal padding.
Notification control: 32px x 32px.
Primary nav item: 40px high, 10px horizontal padding, 12px/16px/600.
Active underline: 2px #1D57D8.
Super Admin does not use this contract.

## 3. Page frame
Desktop >=1025px: padding 12px 12px 16px.
Tablet 769-1024px: padding 10px 10px 14px.
Mobile <=768px: padding 8px 8px 12px.
Page background: #F4F6F8.
Surface: #FFFFFF.
Page-level horizontal overflow: 0px.

## 4. Page header
Desktop content block: exactly 78px.
Bottom margin: 8px.
Eyebrow: 11px/14px/700.
H1: 20px/26px/650.
Description: 12px/16px/400.
Meta: 11px/14px/400.
Title stack gaps: 2px, 2px, 4px.
Actions gap: 8px.
One H1 per page.
If meta is absent, reserve its 14px row on desktop.
At <=1024px header height becomes auto.

## 5. Shared design tokens
Border: #D8DEE8.
Divider: #E5E7EB.
Text: #1A1F2B.
Shell text: #172033.
Muted: #64748B.
Primary blue: #1D57D8.
Navy: #0B2F6B.
Orange: #F5A300.
Success: #198754.
Danger: #C62828.
Warning text: #B76E00.
Hover surface: #F1F6FF.
Selected surface: #E8F0FF.
Radius: 4px for panels, inputs, selects and buttons.
Status badge radius: 999px.
Operational box shadow: none.
Font family: "Segoe UI", Arial, sans-serif.

## 6. Spacing scale
Allowed layout spacing only: 2px, 4px, 6px, 8px, 10px, 12px, 16px.
Major section gap: 12px unless a role blueprint states 16px.
Internal component gap: 8px.
Micro action gap: 4px.
Do not introduce arbitrary rem spacing into converged operational pages.

## 7. Standard controls
Standard button/control height: 32px.
Micro/row action: 28px.
Standard horizontal button padding: 12px.
Micro button horizontal padding: 8px.
Input/select horizontal padding: 9px.
Focus ring: 2px solid #1D57D8, offset -1px.
Disabled opacity: 0.55.
No scale/bounce animation.
Normal transition: 120ms ease-out.

## 8. Panel contract
Panel border: 1px solid #D8DEE8.
Panel radius: 4px.
Panel header: exactly 44px.
Panel header padding: 6px 10px.
Panel title: 13px/18px/700.
Panel subtitle: 10px/13px/400.
Panel body padding: 10px.
Flush table/register body: 0px.
Panel footer: min-height 32px, padding 4px 10px.
No oversized blank panel bodies.

## 9. Signal/KPI strip
Signal cell height: exactly 56px.
Cell padding: 4px 10px.
Semantic accent edge: 3px.
Label: 11px/14px/650.
Value: 18px/20px/800.
Detail: 10px/12px/400.
Strip border: 1px #D8DEE8.
Strip radius: 4px.
Desktop: role-defined column count, maximum 6.
769-1200px: maximum 3 columns.
<=768px: maximum 2 columns.
All cells stay 56px high.

## 10. Dashboard main grid
Use for non-board home dashboards.
Desktop >=1280px: grid-template-columns minmax(0,1.9fr) minmax(320px,.75fr).
Gap: 12px.
At 1920 viewport / 1896 inner: main 1350.6px, aside 533.4px.
At 1440 viewport / 1416 inner: main 1006.6px, aside 397.4px.
At 1280 viewport / 1256 inner: main 891.9px, aside 352.1px.
At <=1199px: one column.
Main and aside align at the same top Y coordinate.

## 11. Filter rail
Width: exactly 220px.
Board grid: 220px minmax(0,1fr).
Grid gap: 12px.
Sticky top: 102px.
Rail header: 36px.
Rail body padding: 10px.
Field gap: 6px.
Label/control gap: 2px.
At <=1024px rail width becomes 100% and stacks above content.
No filter rail horizontal scrolling.

## 12. Tabs and toolbars
Tab strip height: 32px.
Tab button height: 32px.
Tab horizontal padding: 10px.
Tab font: 11px/14px/650.
Active underline: 2px #1D57D8.
Toolbar height desktop: 40px.
Toolbar padding: 4px 8px.
Toolbar gap: 8px.
At <=1024px toolbar uses flex-wrap:wrap, height:auto and min-height:40px.

## 13. Tables
Header height: 36px.
Header padding: 0 10px.
Header font: 11px/14px/700.
Normal row height: 44px.
Wrapped row height: 52px only when documented.
Cell padding: 6px 10px.
Body: 12px/16px/400.
Strong cell: 12px/16px/650.
Metadata: 10px/12px/400.
Status badge: 22px high, 0 7px padding, 10px/14px/700.
Pagination bar: 36px.
Pagination button: 28px x 28px.
Every table wrapper uses overflow-x:auto; page-level horizontal overflow remains 0px.

## 14. Operational records
Desktop collapsed record: exactly 92px.
Primary area: 60px.
Action/footer bar: 32px.
Record gap: 8px.
Cell padding: 8px 10px.
Footer padding: 2px 8px.
Expanded detail padding: 10px.
Expanded detail gap: 8px.
At <=768px records become content-height one-column cards.

## 15. Empty states
Register/list empty state: exactly 64px.
Padding: 10px 12px.
Title: 12px/16px/650.
Description: 11px/14px/400.
No decorative X icon.
No empty register may stretch to fill viewport space.
Map empty-state body: 280px.
Map title: 13px/18px/650.
Map description: 11px/14px/400.

## 16. Map/register split
Desktop >=1200px: minmax(0,.79fr) minmax(0,1fr).
Gap: 12px.
Map fraction 44.134%; register fraction 55.866%.
Panel body: 280px.
Total panel height: 326px including 44px header and borders.
At <=1199px stack to one column.

## 17. Settings layout
Desktop settings navigation rail: 220px.
Gap: 12px.
Sticky top: 102px.
Settings section panel uses the same 44px header.
At <=1024px settings navigation becomes full-width and static.

## 18. Responsive breakpoints
>=1280: full desktop.
1200-1279: desktop rails remain; map/register still two columns.
1025-1199: rails remain; map/register stacks; dashboard main/aside stacks.
769-1024: rails stack; page padding 10px; max 3 signal columns.
<=768: page padding 8px; max 2 signal columns; record grids one column; actions wrap.
390 reference mobile inner width: 374px.

## 19. Accessibility and interaction
Exactly one H1.
No positive tabIndex.
Controls that switch mutually exclusive in-page views use role=tablist/tab; navigation links remain links.
View toggles use aria-pressed or tabs.
Colour is not the only state indicator.
Escape closes modal/popover.
Focus returns to trigger after close.
prefers-reduced-motion disables non-essential motion.
Primary action must be visible without scrolling at 1920x1080 and 1440x900.

## 20. Shared implementation ownership
TopWorkspaceShell owns only global header/nav/actions.
WorkspaceUI owns shared page frame, header, panel, toolbar, tabs, rail, tables, empty state and action groups.
OperationalConvergence owns signal strips and shared map/register layouts.
Role pages own data, permissions, business actions and role-specific content order only.
Role pages must not invent geometry tokens.

## 21. Verification
Every operational role home must be captured at 1920x1080, 1440x900, 1280x800, 1024, 768 and 390.
Fixed dimensions must differ by 0px in computed CSS.
Screenshot edge tolerance: +/-2px.
Desktop/tablet page horizontal overflow: exactly 0px.
Any new numeric value requires a blueprint amendment before merge.
## 22. Cross-role dashboard composition matrix
All dashboard rows below inherit the same 78px page header, 56px signal height, 44px panel header, 12px section gap, 32px standard control and 64px register empty state.

| Role | Signal count | Desktop composition | Main column | Aside column |
|---|---:|---|---|---|
| Carrier | 6 | 220px control rail + main workboard | Workboard + commercial/report panels | Activity + workflow panels inside Carrier-specific lower grid |
| Customer | 4 | 1.9fr / .75fr | Recent Transport | Needs Your Attention |
| Broker | 4 | 1.9fr / .75fr | Current Transport + Needs Your Attention | Commercial Position |
| Owner Driver | 3 | 1.9fr / .75fr | Current Assignment + Driver Readiness | Next Booking + Commercial Position |
| Employed Driver | 3 | 1.9fr / .75fr | Current Assignment + Driver Readiness | Next Booking |
| Fleet Manager | 6 | 1.9fr / .75fr | Allocation/Execution + Resource Register + Fleet Attention | Capacity Summary + Exception Summary |
| Dispatcher | 6 | 1.9fr / .75fr | Dispatch Priority Queue + Resource Availability | Live Exceptions + Dispatcher Actions |
| Finance | 6 | 1.9fr / .75fr | Ready to Invoice + Receivables + Recently Settled | Financial Exposure + Finance Actions |
| Compliance | 6 | 1.9fr / .75fr | Verification/Expiry Queue + Incidents | Compliance Coverage + Compliance Actions |

No role may change its signal count without amending its role blueprint.
No role may substitute a different desktop dashboard grid without amending this master.
Carrier is the only dashboard allowed to use the 220px control-rail home composition because its home is an operational control desk rather than a summary dashboard.

## 23. Cross-role visual equivalence rule
The following elements must be pixel-identical across roles:
- global shell heights;
- page frame padding;
- page header anatomy;
- signal cell height and typography;
- panel borders/radius/header height;
- standard and micro button heights;
- table header/row geometry;
- tabs/toolbars;
- empty-state geometry;
- filter rail width/sticky offset;
- map/register split;
- responsive breakpoints.

Roles may differ only in information architecture, permitted actions, labels, signal count up to 6, and page-specific data density explicitly written in a role blueprint.
