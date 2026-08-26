# Android tracking stop safety contract

Validated against the current Courier Exchange operating model and the existing XDrive Android runtime.

## Contract

- Job lifecycle/status and GPS tracking remain separate channels.
- Availability/pre-job tracking may be stopped by the driver.
- An active allocated job cannot have mandatory tracking stopped through the semantic stop actions.
- If Android destroys/stops the service externally while the authenticated app is visible and the runtime is already in JOB mode, the service recovers and restarts.
- Availability mode does not auto-recover from an external stop; pre-job tracking remains driver-controlled.
- No server-side fresh-GPS gate is introduced for manual job status progression.

## Current implementation evidence

`TrackingService.ACTION_STOP` routes through `stopIfNoActiveJob()`. When server state reports `shouldTrack == true`, the service remains in JOB mode and keeps tracking.

`ACTION_STOP_AVAILABILITY` routes through `stopAvailabilityIfNoActiveJob()`. Availability controls cannot stop tracking for an active allocated job.

`onDestroy()` recovers from an unintentional external stop only when `mode == RuntimeMode.JOB`, the app is visible, location permission is present, and an authenticated session remains available.

The UI currently contains a direct Android `stopService(...)` call. The service-level recovery contract prevents that from becoming a persistent active-job tracking stop once JOB mode is established, while Availability can stop without being automatically restarted. A future atomic UI cleanup may route the control directly through `ACTION_STOP`; that cleanup must not be implemented by broad rewriting of `MainActivity.kt`.
