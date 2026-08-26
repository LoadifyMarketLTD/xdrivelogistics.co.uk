# Android Availability Tracking wiring

Status: UI wiring complete on PR #368; merge remains gated on verification.

- Native client: `AvailabilityPresenceApi` uses only `/api/driver/availability-presence`.
- Location acquisition: one-shot fused-location lookup on explicit driver Start.
- More/Profile: `AvailabilityPresencePanel(state.session)` is wired into the existing screen.
- Visibility: Private / My Fleet / Exchange.
- Auto-off choices: 1 / 4 / 8 hours.
- Server envelopes are matched explicitly: GET `{ active, presence }`, POST `{ ok, visibility, available_until }`, DELETE `{ ok }`.
- Existing active-job `TrackingService` remains separate and unchanged.
- No direct Supabase writes, no `driver_locations` writes, no availability-triggered foreground service.

Verification required before merge:
- focused source contract PASS;
- real XDrive Netlify preview PASS;
- Android compile/build evidence where a free runner/toolchain is available.

Do not report Android build PASS unless compilation has actually run successfully.
