# XDrive More — all operational workspaces audit

Date: 2026-10-03

## Scope

Audited and repaired the shared `More` navigation for operational workspaces:
Carrier/Admin, Broker, Customer, Driver, Owner Driver, Fleet Manager, Dispatcher/Operations, Finance, Compliance and Viewer.

Super Admin remains out of scope and unchanged.

## Canonical rule

`More` is secondary navigation only. A destination must not remain in `More` when:
- the same function is already primary navigation;
- the same function is already exposed by a dedicated header action;
- the destination is only a compatibility redirect to another primary page;
- the destination is a settings subsection already reachable from the primary Settings page;
- a consolidated hub already replaces the lower-level duplicate routes.

## Owner Driver final structure

Primary navigation remains:
Dashboard, Directory, Live Availability, My Fleet, Return Journeys, Loads, Quotes, Diary, Event Log, Freight Vision, Drivers & Vehicles, Settings.

`More` is now intentionally limited to two sections.

### Work & matching
- My Jobs
- Won Work
- My Availability
- Auto-match & Alerts
- Who's Nearby

### Business
- Finance & Invoices
- Documents
- Messages

Removed from Owner Driver `More` as duplicated:
- Notifications — already exposed by the header notification control
- Security — available inside primary Settings
- Account — available as My Profile inside primary Settings
- Company Profile — available inside primary Settings
- Company Settings — primary Settings already owns these controls
- Membership & Billing — available from the Settings overview

## Other repairs

- Carrier/Admin: removed duplicate Drivers, Vehicles and position routes where the consolidated Drivers & Vehicles hub already exists.
- Fleet: removed redundant low-level resource duplicates and retained operational secondary tools.
- Dispatcher: removed duplicate Drivers/Vehicles routes and retained incident, POD, Freight Vision, availability, resources, messages and event log.
- Broker: removed compatibility-only Compare Quotes and Awards links; standardised Directory.
- Customer: removed compatibility-only Awards; standardised Directory.
- Driver: retired the standalone card-based `/driver/more` implementation; the compatibility route now redirects to the canonical shared shell.
- Driver Settings access now matches the primary navbar for employed Driver as well as Owner Driver.
- Finance, Compliance and Viewer no longer render a one-item `More` dropdown.

## Visual and responsive verification

Automated Playwright verification was run at:
- desktop 1440 × 900
- mobile 390 × 844

Final state:
- Carrier: 12 More items
- Broker: 9
- Customer: 8
- Driver: 5
- Owner Driver: 8
- Fleet: 10
- Dispatcher/Operations: 7
- Finance: no More
- Compliance: no More
- Viewer: no More

All remaining menus fit inside the viewport on both sizes and no duplicate labels were detected.

Owner Driver menu height after repair: 315px on desktop and mobile, down from the previous 14-item overflow menu.

## Regression protection

`__tests__/workspaceMoreAuditContract.test.ts` protects:
- fixed/viewport-safe menu geometry;
- removal of compatibility-only duplicate destinations;
- consolidated resource hubs;
- role permission coverage for retained destinations;
- Owner Driver curated More membership and labels;
- employed Driver Settings access;
- retirement of the legacy standalone Driver More page.
