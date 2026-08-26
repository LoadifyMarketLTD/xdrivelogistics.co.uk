# XDrive Driver — Firebase / FCM Production Gate

Production Android package: `co.uk.xdrivelogistics.driver`

## Verified live on 26 August 2026

- Supabase Edge Function `notify-operational-event` is deployed and ACTIVE (version 8 at audit time).
- The server implementation uses FCM HTTP v1 with a Firebase service account.
- The production RPC `active_driver_push_devices_for_user` exists.
- `driver_push_devices` contained 0 registered devices at audit time, so no physical-device FCM delivery can yet be proven.
- The deployed version 8 source was behind the repository FCM source: the repository includes the Android `click_action` for `co.uk.xdrivelogistics.driver.OPEN_JOB`, while the deployed version did not. Production source parity must be restored before physical push verification.

## Android client configuration

A production release must provide all four values for the Firebase Android app registered to the exact production package:

- `XDRIVE_FIREBASE_PROJECT_ID`
- `XDRIVE_FIREBASE_APPLICATION_ID`
- `XDRIVE_FIREBASE_API_KEY`
- `XDRIVE_FIREBASE_SENDER_ID`

These may be supplied through protected Gradle properties or environment variables. They are Firebase client configuration values; the server private key must never be put in Android BuildConfig or committed to Git.

The Gradle production gate fails release/bundle tasks if any client Firebase value is missing.

## Server configuration

The Supabase Edge Function expects the secret:

- `FIREBASE_SERVICE_ACCOUNT_JSON`

The secret JSON must contain `project_id`, `client_email` and `private_key` for a service account authorized to send Firebase Cloud Messaging messages. The secret value must never be committed or printed in logs.

The available connected Supabase tooling does not expose secret values, so this audit does not claim that `FIREBASE_SERVICE_ACCOUNT_JSON` is currently present. A successful physical-device FCM send is the authoritative verification.

## Required production verification

1. Confirm/create the Firebase Android app for `co.uk.xdrivelogistics.driver`.
2. Supply the four Android client configuration values to the build environment.
3. Confirm `FIREBASE_SERVICE_ACCOUNT_JSON` exists in Supabase Edge Function secrets and belongs to the same Firebase project.
4. Deploy the repository `notify-operational-event` source so deployed source matches the reviewed repository source.
5. Install a real Native Android build on a physical phone and sign in.
6. Verify one enabled row appears in `driver_push_devices` for that installation.
7. Assign a test job to that driver through the normal XDrive workflow.
8. Verify the phone receives the FCM notification when the app is foreground, background and process-not-running.
9. Tap the notification and verify it opens the exact assigned job through `JobDeepLinkActivity` / `xdrive://job/<jobId>`.
10. Rotate the FCM token or reinstall and verify stale/unregistered tokens are disabled server-side.

Do not mark production push PASS until steps 1–10 have real evidence.
