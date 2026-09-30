# XDrive Broker Workspace Visual Implementation Blueprint
Date: 2026-09-30
Status: FINAL ROLE EXECUTION SPEC
Required base: XDRIVE_OPERATIONAL_ROLE_VISUAL_SYSTEM_MASTER_2026-09-30.md

## 1. Scope
Primary nav target:
Dashboard / Action Centre / Enquiries / Loads / Carrier Quotes / Jobs / Diary / POD Review / Finance / Settings / More.
Current source includes BrokerDashboardHome.tsx and broker-dashboard-convergence.css.

## 2. Current defects found
Current KPI cards are 92px high with 14px padding and 6px radius.
Current Broker panels use 6px radius and 12px/14px padding instead of shared 4px/10px.
Current tables have variable row height and min-width 900px.
Current Commercial cards are 86px and form another visual system.
Current footer links are 34px high.
Broker dashboard is visually more balanced than Customer but still not on shared primitives.

## 3. Dashboard exact target
Page header: 78px.
Header actions: Compare Quotes / Active Jobs, both 32px.
Signal strip: 4 columns x 56px.
Signals:
1. Open Loads
2. Awaiting Award
3. Active Jobs
4. Gross Margin

Gap after signals: 12px.
Use master Dashboard grid 1.9fr / .75fr.
Main stack:
- Current Transport
- Needs Your Attention
Aside:
- Commercial Position only.
Action Centre remains a primary-nav destination and is not duplicated as a dashboard card.
All stack gaps: 12px.

Current Transport:
panel header 44px.
table header 36px.
row 44px.
columns Reference / Customer / Route / Pickup / Status / Action.

Needs Attention:
panel header 44px.
attention rows 44px.
empty state 64px.

Commercial Position:
panel header 44px.
body uses 3 equal metric rows/cards, each 56px; no 86px standalone cards.
Metrics: Awaiting Customer Payment / Carrier Costs / Margin.
Open Finance action is 32px in header.

## 4. Secondary page families
Action Centre: shared attention register.
Enquiries: always use 220px filter rail + 12px gap + main register; rail controls 32px.
Loads: 220px rail + 92px operational records.
Carrier Quotes: 220px rail + 92px quote records.
Jobs: full-width operational table/register; 36px/44px.
Diary: 220px rail + 92px records.
POD Review: full-width evidence review register; 36px header, 44px rows, preview detail in expandable area.
Finance: dashboard grid 1.9fr/.75fr with shared finance tables.
Settings: 220px settings rail.
More pages such as Customers, Carrier Network, Messages, Event Log, Disputes use the same shared panel/table system.

## 5. Broker visual restrictions
No 6px operational card radius after convergence.
No 34px footer action.
No separate broker-only KPI geometry.
Margin may only render from real revenue minus carrier-cost data.
No commercial metric may be shown as exact when source data is partial.

## 6. Responsive
4 signals -> 2x2 at <=1024; 1x4 only below 480 if content cannot fit.
Dashboard grid stacks <=1199.
Rail pages stack <=1024.
Tables scroll inside wrappers.
No page horizontal overflow.

## 7. Acceptance
Broker and Customer must share identical header, panel, table, empty-state and button geometry.
Broker retains different information hierarchy, not a different design system.
