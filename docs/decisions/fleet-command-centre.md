# Fleet Command Centre — approved product decision

Date: 2026-08-10
Baseline: `main`
Scope: Carrier Fleet workspace only

## Product position

XDrive Fleet is a carrier resource-control workspace, not a copy of the Carrier Dashboard, Operations Centre, Finance, or a pure telematics product.

It combines:

- Courier Exchange-style driver/vehicle availability and allocation;
- dispatch-ready resource matching;
- live tracking health;
- vehicle and document readiness;
- actionable exception handling.

The primary operating unit is:

`driver + vehicle + status + location freshness + readiness`

## Approved dashboard hierarchy

1. Six concise KPIs:
   - Drivers available
   - Vehicles available
   - Work awaiting allocation
   - Active fleet work
   - Tracking exceptions
   - Readiness blockers
2. Fleet attention queue
3. Allocation board
4. Capacity matrix
5. Live fleet execution
6. Fleet resource status

## Explicit separations

- Fleet controls resources, allocation pressure, tracking health and readiness.
- Operations Centre controls execution events, delays, pickup/delivery progression and interventions.
- Drivers manages identities, accounts and app access.
- Driver Availability manages current and future availability.
- Live Positions owns the detailed map and location register.
- Maintenance owns defects, inspections, service and return-to-service evidence.
- Documents owns evidence; Document Expiry owns expiry and missing-document queues.
- Commercial pricing and Finance remain outside Fleet.

## Required data semantics

- `Live`: valid position within the freshness threshold.
- `Stale`: a position exists but is older than the threshold.
- `Missing`: no valid position exists.
- Missing and stale must never be combined under a label that says only “stale”.
- A vehicle with no recorded documents is a readiness blocker.
- “Available vehicle” and “ready vehicle” are not synonyms.
- A driver can be available while no dispatch-ready driver/vehicle team exists.

## UI decisions

Keep:

- Fleet Command Centre visual language
- KPI strip
- attention queue
- allocation board
- capacity matrix
- live execution
- contextual links to assignments and live positions

Remove:

- duplicate Resource Readiness rail metrics
- duplicate Drivers/Vehicles/Maintenance toolbar buttons
- static Fleet operating sequence
- repeated presentation of the same counts
- unnecessary horizontal scrolling for compact tables

## Courier Exchange reference findings

The repository reference set in `public/reference/courier-exchange` contains 20 Courier Exchange screenshots and one XDrive comparison screenshot.

Useful Courier Exchange concepts to adapt, not copy:

- driver and assigned vehicle on one row;
- vehicle size/type;
- current operational status;
- current location and last tracked;
- future position and future journey;
- advertised availability;
- tracking notification;
- return-journey and capacity context.

Fields that are not yet supported by the verified XDrive dataset must not be fabricated in the UI. They require a separate backend/data-contract phase.
