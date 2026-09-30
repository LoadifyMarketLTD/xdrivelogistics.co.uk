# XDrive Dispatcher Workspace Visual Implementation Blueprint
Date: 2026-09-30
Status: FINAL ROLE EXECUTION SPEC
Required base: XDRIVE_OPERATIONAL_ROLE_VISUAL_SYSTEM_MASTER_2026-09-30.md

## 1. Scope
Primary nav target:
Dashboard / Diary / Unallocated / Active Jobs / Collections / Deliveries / Live Positions / Settings / More.

## 2. Dashboard mission
Real-time operational control: allocate, monitor and recover exceptions.
No company ownership or finance management.

## 3. Dashboard exact target
Page header: 78px.
Signals: exactly 6 x 56px:
1. Unallocated
2. Due Next 2h
3. Active
4. Exceptions
5. Available Drivers
6. Stale GPS
Gap after signals: 12px.
Use master Dashboard grid 1.9fr / .75fr.
Main stack: Dispatch Priority Queue; Resource Availability.
Aside stack: Live Exceptions; Dispatcher Actions.

Dispatch Priority Queue:
44px panel header.
36px table header.
44px row.
Columns Route / Pickup / Driver / Priority / Status / Action.
Max 10 visible rows before explicit register navigation.

Resource Availability:
44px panel header.
Each metric row 44px.
No decorative cards.

Live Exceptions:
44px panel header.
Exception row min-height 52px because it carries priority + entity + state + action.
Action 28px.

Dispatcher Actions:
44px panel header.
2-column action grid with 32px buttons at >=1280.
1 column at <=768.
Only execution/exception workflows.

## 4. Secondary pages
Diary: 220px rail + 92px records.
Unallocated: full-width allocation table; 36px/44px.
Active Jobs: full-width execution table/register.
Collections and Deliveries: 40px toolbar + 36px/44px register.
Live Positions: shared map/register split, 280px bodies.
Settings: 220px settings rail.

## 5. Acceptance
Dispatcher is the densest action-oriented workspace but uses the same header, signals, panels, tables and actions as other roles.
No separate dispatcher visual system.
