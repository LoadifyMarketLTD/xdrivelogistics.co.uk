# XDrive Owner Driver Workspace Visual Implementation Blueprint
Date: 2026-09-30
Status: FINAL ROLE EXECUTION SPEC
Required base: XDRIVE_OPERATIONAL_ROLE_VISUAL_SYSTEM_MASTER_2026-09-30.md

## 1. Scope
Primary nav target:
Dashboard / Directory / Return Journeys / Loads / Quotes / Diary / Event Log / Settings / More.
Owner Driver combines driver execution with business/commercial capability.

## 2. Current defects found
Driver CSS currently contains multiple generations: driver-master, driver-operational, driver-reference, prototype-exact, live-parity and prototype-parity.
Current driver prototype uses 245px rail, 36px controls, 38px tabs and sticky top 74px.
Current dashboard H1 can reach 23px and PageHeader min-height 62px.
Current load records use 82px primary rows plus 30px meta rows.
These values conflict with the shared operational contract and are a major source of visual drift.

## 3. Dashboard exact target
Use master page header 78px.
Header title: Driver Dashboard.
Persona label stays Owner Driver Workspace in shell identity, not as a second H1.
Signal strip: 3 columns x 56px:
1. Availability
2. Active Vehicle
3. Assigned Work

After signals: 12px.
Desktop execution grid: master Dashboard grid 1.9fr / .75fr.
Main:
- Current Assignment panel
- Driver Readiness panel
Aside:
- Next Booking panel
- Owner Driver Commercial Position panel
All panel headers 44px.
All empty states 64px.
Current Assignment populated job summary uses one 92px operational record.
Next Booking populated state uses one 92px operational record.
Driver Readiness uses 3 equal 56px facts: Availability / Vehicle / Documents.
Commercial Position uses 3 equal 56px facts: Invoice Readiness / Outstanding / Return Capacity.

## 4. Owner Driver page families
Directory: 220px rail + 92px member records.
Return Journeys: 220px rail + 12px + main; List mode uses 92px records; Map mode uses 280px map body; List/Map toggle 32px.
Loads: 220px rail + 92px load records.
Quotes: 220px rail + 92px quote records.
Diary: 220px rail + 92px booking records.
Event Log: filter toolbar + 36px/44px table.
Settings: 220px settings rail.
More renders only routes authorised by the current role; every More destination uses the shared master geometry.
## 5. Driver-specific exact overrides
Old 245px rail is removed; target rail is 220px.
Old 36px input height becomes 32px.
Old 38px tabs become 32px.
Old sticky top 74px becomes 102px.
Old 82+30 record anatomy becomes shared 92px total.
Old 23px H1 becomes 20px/26px.
All dashboard section headers become 44px.

## 6. Mobile priority
At <=768 Current Assignment appears before Next Booking, then Readiness, then Commercial Position.
Execution actions remain reachable without horizontal scrolling.
Status lifecycle buttons use 32px standard height.
POD/photo/signature functionality is functional logic and must not be simplified for visual consistency.

## 7. Acceptance
Owner Driver must visually belong to the same platform as Carrier and Customer while retaining its execution-first information architecture.
No legacy driver spacing token survives unless explicitly listed in this blueprint.

