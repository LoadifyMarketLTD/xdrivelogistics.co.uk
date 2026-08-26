# Android tracking stop safety contract

Validated against the current Courier Exchange operating model and the existing XDrive Android runtime.

## Contract

- Job lifecycle/status and GPS tracking remain separate channels.
- Availability/pre-job tracking may be stopped by the driver.
- An active allocated job cannot have mandatory tracking stopped through the semantic stop actions.
- If Android destroys/stops the service externally while the authenticated app is visible, the runtime is allowed to recover and restart.
- No server-side fresh-GPS gate is introduced for manual job status progression.

## Current implementation evidence

`TrackingService.ACTION_STOP` routes through `stopIfNoActiveJob()`. When server state reports `shouldTrack == true`, the service remains in JOB mode and keeps tracking.

`ACTION_STOP_AVAILABILITY` routes through `stopAvailabilityIfNoActiveJob()`. Availability controls cannot stop tracking for an active allocated job.

`onDestroy()` recovers from an unintentional external stop while the app is visible, location permission is present, and an authenticated session remains available.

The UI currently contains a direct Android `stopService(...)` call. The runtime safety contract above prevents that from becoming a persistent active-job tracking stop. A future atomic UI cleanup may route the control directly through `ACTION_STOP`, but that cleanup is not required to preserve the active-job tracking invariant and must not be implemented by broad rewriting of `MainActivity.kt`.
