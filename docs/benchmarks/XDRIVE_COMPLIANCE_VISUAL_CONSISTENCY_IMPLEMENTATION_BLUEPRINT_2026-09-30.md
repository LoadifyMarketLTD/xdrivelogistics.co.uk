# XDrive Compliance Workspace Visual Implementation Blueprint
Date: 2026-09-30
Status: FINAL ROLE EXECUTION SPEC
Required base: XDRIVE_OPERATIONAL_ROLE_VISUAL_SYSTEM_MASTER_2026-09-30.md

## 1. Scope
Primary nav target:
Dashboard / Driver Docs / Vehicle Docs / Company Docs / Expiry / Incidents / Settings / More.

## 2. Dashboard mission
Verification, expiry, rejected/pending records, incidents and operational readiness.

## 3. Dashboard exact target
Page header: 78px.
Signals: exactly 6 x 56px:
1. Expired
2. Due 7d
3. Due 30d
4. Pending
5. Inactive Accounts
6. Incidents
Gap after signals: 12px.
Use master Dashboard grid 1.9fr / .75fr.

Main:
- Priority Verification & Expiry Queue
- Incidents Requiring Follow-up
Aside:
- Compliance Coverage
- Compliance Actions

Priority queue:
44px panel header.
36px table header.
44px row.
Columns Document / Driver-Vehicle / Expiry / Status / Review.
Review action 28px.

Incidents:
44px panel header.
36px table header.
44px rows.

Compliance Coverage:
44px panel header.
4 rows x 44px:
No Local Alert / Due within 30d / Expired-Rejected / Pending Review.

Compliance Actions:
44px header.
32px actions.

## 4. Secondary pages
Driver Docs: 220px filter rail + 12px gap + 36px/44px register.
Vehicle Docs: identical geometry to Driver Docs.
Company Docs: identical geometry.
Expiry: 220px filter rail + 36px/44px table.
Incidents: 220px filter rail + 12px gap + 36px/44px table.
Settings: 220px settings rail.

## 5. Truth and permissions
No document is described as approved/verified unless canonical status supports it.
Expiry and rejection are distinct states.
Compliance role does not gain finance or marketplace ownership functions.

## 6. Acceptance
Compliance uses the exact same shell/header/signals/panels/tables/buttons as other operational roles.
No compliance-specific card radius, spacing or table height.
