# XDrive Driver Mobile

`apps/driver-mobile/` is the active XDrive Driver mobile client built with Expo / React Native.

## Canonical production owner

- Production mobile source: `apps/driver-mobile/`
- Framework: Expo / React Native
- Production Android package: `co.uk.xdrivelogistics.driver`
- Production iOS bundle ID: `co.uk.xdrivelogistics.driver`
- EAS organization: `xdrive-logistics-ltd`
- EAS project ID: `c19b0bdf-567a-488e-b78f-d36b84f25c99`

The older `android-native/` Kotlin implementation remains in repository history/source as technical reference only. It is not the current Driver product and must not be distributed or merged as a replacement without a separate product decision and full release gate.

## Driver scope

The application owns the mobile Driver experience, including:

- secure Driver login, persisted session and password recovery;
- Live Loads and commercial quote submission;
- active/upcoming/completed Driver jobs;
- authoritative lifecycle transitions;
- collection evidence before Loaded;
- multi-drop stop progression;
- delivery POD, photos, documents, signature and recipient confirmation;
- durable offline mutation replay;
- push registration and notification handling;
- job-bound live GPS tracking while work is actively being performed.

The backend remains authoritative for identity, tenant/company boundaries, device sessions, job assignment, lifecycle transitions, quote eligibility, POD rules and location publishing.

## Local commands

```bash
npm install
npm run typecheck
npm run test
npm run bundle:android
npm run start
npm run android
```

Internal APK builds use:

```bash
npm run build:android:apk
```

Do not treat a successful JavaScript bundle or TypeScript compile as a mobile release pass. Android native build, signing/install and physical-device E2E remain separate release gates.

## Configuration

The application can bootstrap public Supabase configuration from the canonical XDrive backend at `https://www.xdrivelogistics.co.uk/api/driver/mobile/config` or receive the equivalent public Expo environment values at build time.

Android push delivery uses the provider-native Firebase token registered through the server-owned Driver push-device registry. The production Android build therefore requires the authorised Firebase `google-services.json` configuration through the protected build environment; it must not be committed as a secret-bearing replacement file.

Live tracking is job-bound and server-authorised. The app does not queue old GPS points and later present them as current live location. Background tracking requires the platform permissions and foreground-service behaviour declared in Expo config and must be validated on a physical Android device.

## Release rules

- Preserve the existing Driver UX unless a visual change is explicitly requested.
- Do not bypass server APIs with direct privileged database writes.
- Keep offline actions account-scoped and replay them in deterministic order.
- Do not weaken collection/POD evidence requirements to make offline flows easier.
- Do not merge a Driver release until the exact-head source gate, Expo mobile typecheck/tests/bundle, Android build, signing/install and physical-device E2E gates have passed.
- GitHub Actions are not the release gate for this workstream.
