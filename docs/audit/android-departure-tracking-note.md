# Android departure tracking contract

`On My Way` is a driver lifecycle action and live GPS is a visibility channel. XDrive keeps them coordinated but not mutually blocking.

When the driver initiates `on_my_way` while the app is visible, the native app makes a best-effort attempt to start the existing `TrackingService` if Android Precise Location and Location Services prerequisites are available. A temporary GPS, permission, location-services, or network problem does not deadlock the manual lifecycle transition.

This matches the product behavior being targeted from Courier Exchange: availability/status and live tracking are related operational signals, but they remain distinct mechanisms. It also respects Android 14+ while-in-use foreground-location service restrictions by only attempting the location foreground-service start while the app is visible.

Do not add a server rule requiring a location point within an arbitrary freshness window before `On My Way` can succeed.
