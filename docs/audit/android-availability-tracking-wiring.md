# Android Availability Tracking Wiring

Status: implementation in progress on `feat/android-availability-tracking-20260826`.

Implemented and safe to review:
- dedicated `AvailabilityPresenceApi` using only `/api/driver/availability-presence`;
- authenticated server calls only; no direct Supabase availability table writes;
- 1/4/8 hour duration contract and private/fleet/exchange visibility contract;
- one-shot `AvailabilityPresenceController` using fused last location;
- no `TrackingService`, no job `driver_locations`, no foreground-service start;
- source-level contract coverage.

Deliberately not yet claimed complete:
- the control is not yet wired into the existing native `More/Profile` Compose screen;
- no merge should occur until that UI wiring is added and Android compile/build evidence is available.

This separation is intentional: pre-award availability must never silently become continuous active-job tracking.
