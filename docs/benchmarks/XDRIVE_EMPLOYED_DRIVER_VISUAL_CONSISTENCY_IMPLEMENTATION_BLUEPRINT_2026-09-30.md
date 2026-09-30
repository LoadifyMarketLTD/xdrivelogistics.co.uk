# XDrive Employed Driver Workspace Visual Implementation Blueprint
Date: 2026-09-30
Status: FINAL ROLE EXECUTION SPEC
Required base: XDRIVE_OPERATIONAL_ROLE_VISUAL_SYSTEM_MASTER_2026-09-30.md

## 1. Scope
Primary nav target:
Dashboard / My Jobs / Diary / Availability / Vehicle / Documents / Settings / More.
Employed Driver is execution-only and must not inherit owner/company finance or posting administration.

## 2. Dashboard exact target
Page header: 78px.
Signal strip: 3 columns x 56px.
Signals:
1. Availability
2. Active Vehicle
3. Assigned Work
After signals: 12px.
Desktop grid: master 1.9fr / .75fr.
Main: Current Assignment, then Driver Readiness.
Aside: Next Booking.
No Owner Driver Commercial Position.
No company finance card.
No Post Load commercial panel.
Current Assignment header 44px; populated job record 92px; empty 64px.
Next Booking header 44px; populated job record 92px; empty 64px.
Driver Readiness header 44px; 3 facts x 56px: Availability / Vehicle / Documents.

## 3. Secondary pages
My Jobs: 220px filter rail + 12px gap + 92px execution records.
Diary: 220px rail + 92px historical records.
Availability: 220px filter/control rail + 12px gap + main availability panel; all controls 32px.
Vehicle: full-width 44px-header panel; vehicle register uses 36px table header and 44px rows.
Documents: 36px/44px register with 22px status badges.
Settings: 220px settings rail.
More: Messages, Event Log, Notifications only when authorised.

## 4. Driver convergence changes
Replace 245px rail with 220px.
Replace 36px inputs with 32px.
Replace 38px tabs with 32px.
Replace sticky top 74px with 102px.
Replace 82px+30px job card stack with 92px shared record.
Remove duplicate CSS generations as pages migrate to shared primitives.
Do not change lifecycle authority or POD behaviour.

## 5. Responsive
At <=768 order is Current Assignment / Next Booking / Readiness.
No company/business panel is inserted.
All execution actions wrap but remain 32px high.

## 6. Acceptance
Employed Driver and Owner Driver share visual geometry but not permissions or commercial content.
No employed driver sees company invoice, company billing or other-driver administration by default.

