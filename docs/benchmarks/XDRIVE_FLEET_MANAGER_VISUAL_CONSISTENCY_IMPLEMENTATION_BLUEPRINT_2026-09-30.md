# XDrive Fleet Manager Workspace Visual Implementation Blueprint
Date: 2026-09-30
Status: FINAL ROLE EXECUTION SPEC
Required base: XDRIVE_OPERATIONAL_ROLE_VISUAL_SYSTEM_MASTER_2026-09-30.md

## 1. Scope
Primary nav target:
Dashboard / Live Availability / My Fleet / Return Journeys / Jobs / Diary / Freight Vision / Drivers & Vehicles / Settings / More.
Settings MUST be directly visible; current fleet nav composition must be corrected if it omits Settings.

## 2. Dashboard mission
Fleet Manager controls capacity and execution, not company ownership.
Dashboard emphasizes allocation, active execution, resource readiness, tracking and compliance.

## 3. Dashboard exact target
Page header: 78px.
Signals: exactly 6 x 56px:
1. Unallocated
2. Allocated
3. Active Jobs
4. Available Drivers
5. Tracking Alerts
6. Compliance
Remove Connected Workspace duplicate-navigation card.
Gap after signals: 12px.
Use master Dashboard grid 1.9fr / .75fr.
Main: Won/Received -> Allocation -> Execution; Fleet Resource Register; Fleet Attention.
Aside: Capacity Summary; Exception Summary only when derived from real data.
No shortcut cards that duplicate navbar.
Tables: 36px headers, 44px rows, 28px row actions.

## 4. Secondary pages
Live Availability: shared 44.134/55.866 map/register split with 280px bodies.
My Fleet / Vehicles: full-width resource register, 36px/44px.
Return Journeys: 220px rail + 92px records.
Jobs: operational table/register.
Diary: 220px rail + 92px records.
Freight Vision: same map/register split.
Drivers & Vehicles: controls 32px; tables 36px/44px.
Settings: 220px settings rail.

## 5. Exact corrections from current code
Current My Fleet wrapper top padding 10px -> 12px desktop.
Current 7 signals -> 6.
Current duplicate Connected Workspace card -> remove.
All panel headers -> 44px.
All standard actions -> 32px.

## 6. Acceptance
Fleet Manager and Carrier share resource/tracking component geometry.
Fleet Manager content remains fleet-control only; no owner-only finance/posting administration is added.
