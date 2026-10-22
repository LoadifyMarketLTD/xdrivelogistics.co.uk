# CX-style pre-job Live Availability - 2026-10-21

## Problem
Courier Exchange separates pre-job availability presence from active-job tracking. XDrive already had both data models, but web availability presence was only a one-shot location when the driver pressed Start. Company Live Availability also derived own-fleet map coordinates primarily from active-job driver_locations, so an available driver with no job could remain invisible or stale.

## Repair
- Driver/Owner Driver opt-in availability presence now runs from the persistent Driver workspace shell, not only the Live Availability page.
- While presence is active, browser geolocation is watched and the server is refreshed every 30 seconds. Returning from background forces an immediate refresh.
- Location permission removal stops server-side availability rather than leaving a stale point advertised.
- POST/PUT eligibility failures clear stale presence when the driver is no longer Available or gains an active assigned job.
- Exchange/Nearby discovery only returns availability points refreshed within five minutes.
- Company Live Availability loads exact same-fleet availability presence separately from exchange discovery and prefers the newest of availability presence vs execution tracking for each driver.
- Super Admin does not classify an old availability-presence point as online once it exceeds the existing online freshness threshold.
- Exchange discovery continues to expose rounded coordinates and member/vehicle capacity, not driver identity or exact coordinates.
- Available Exchange members in Company Live Availability now provide a Book Direct action into the existing directCarrier Post Load workflow.

## Invariants
- No job is required for availability presence.
- Active-job tracking remains separate in driver_locations.
- Starting availability remains explicit opt-in and time bounded (1/4/8 hours).
- Drivers with an active assigned job are excluded from availability discovery.
- Exact coordinates remain same-fleet / platform-owner scoped; Exchange uses rounded coordinates.
- No automatic job allocation or open-board publication is introduced.

## Verification
- Focused Live Availability / location / direct-booking / Super Admin suite: 43/43 tests passed across 9 files.
- Standalone TypeScript: pass (incremental disabled).
- git diff --check: pass.
- Production publication and production browser/API verification remain required before declaring the change live.
