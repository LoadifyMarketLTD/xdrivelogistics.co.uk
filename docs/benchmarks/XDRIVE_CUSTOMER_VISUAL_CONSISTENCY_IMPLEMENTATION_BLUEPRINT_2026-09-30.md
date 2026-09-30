# XDrive Customer Workspace Visual Implementation Blueprint
Date: 2026-09-30
Status: FINAL ROLE EXECUTION SPEC
Required base: XDRIVE_OPERATIONAL_ROLE_VISUAL_SYSTEM_MASTER_2026-09-30.md

## 1. Scope
Primary nav target:
Dashboard / Action Centre / View All Loads / Quotes / Bookings / Tracking / Diary / Invoices / Settings / More.
Current source files include CustomerDashboardHome.tsx, CustomerOperationalPages.tsx, CustomerWorkspaceModules.tsx and customer-dashboard.css.

## 2. Current defects found
Current KPI cards are 72px and use 22px values; shared target is 56px and 18px values.
Current table header is 40px while shared target is 36px.
Current customer boxes use 36px natural headers while shared target is 44px.
Default EmptyState creates large blank regions and decorative X.
Dashboard currently stacks large full-width empty panels, producing dead space.
Customer dashboard uses its own CSS family instead of the shared operational primitives.

## 3. Dashboard exact target
Page header: master 78px.
Gap after header: 8px.
Signal strip: 4 columns desktop, each 56px.
Signals:
1. Open Loads
2. Quotes to Review
3. Active Deliveries
4. Outstanding Invoices

After signals: 12px gap.
Use master Dashboard main grid: 1.9fr / .75fr.
Main column:
- Recent Transport panel first.
- table header 36px; rows 44px.
- columns: Reference / Route / Pickup / Status / Action.
Aside:
- Needs Your Attention panel.
- each attention row 44px.
- Action Centre link belongs in panel header as one 32px action.
Both panels use 44px headers.
Zero-data state uses 64px empty state, never a tall blank body.

## 4. Dashboard behaviour
Do not fabricate zero-state financial totals when datasets are unavailable/partial.
Warnings remain above signals and use shared alert geometry.
Recent Transport shows real jobs only.
Attention contains only genuine action items.
No duplicate navigation card is permitted.

## 5. Secondary page families
Action Centre: full-width Carrier-style attention register; 44px panel header, 36px table header, 44px rows.
View All Loads: 220px filter rail + 12px + operational record register; records 92px desktop.
Quotes: 220px rail + 12px + quote register; records 92px.
Bookings: 220px filter rail + 12px gap + register; 36px table header and 44px rows.
Tracking: shared 44.134% map / 55.866% register split; 280px bodies.
Diary: 220px rail + 12px + register; 92px booking records.
Invoices: full-width finance table; 36px header, 44px rows.
Settings: master 220px settings rail.

## 6. Customer page-specific geometry
Loads/Quotes/Diary rail sticky top: 102px.
Tracking map/register total panel height: 326px.
All local tabs: 32px.
All standard actions: 32px.
All row actions: 28px.
All panel headers: 44px.
All list empty states: 64px.

## 7. Responsive
At <=1199 dashboard grid stacks.
At <=1024 all filter rails stack.
At <=768 dashboard signal strip becomes 2x2.
Tables scroll inside wrapper only.
Operational records become content-height single-column cards.

## 8. Acceptance
No customer page uses 72px KPI cards after convergence.
No customer table header remains 40px.
No decorative X empty state.
No full-width empty panel taller than 64px unless it is a 280px map.
No duplicate H1.
All primary nav items remain role-appropriate.
