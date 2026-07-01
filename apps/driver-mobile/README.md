# XDrive Driver Mobile

Native driver app scaffold for Android/iOS built with Expo React Native.

This is not a mobile web page, PWA, or `/m` route. The target output is an installable Android APK/AAB and later an iOS build.

## MVP Scope

- Persistent driver login.
- Active Job as the default operational screen.
- My Jobs with Active, Upcoming, and Completed scopes.
- Job Detail with operational fields only.
- Canonical execution flow from awarded to delivered.
- POD capture shell for photo, document, and signature.
- Critical notification registration shell.
- Offline queue skeleton for status/POD retry.

## Commands

```bash
npm install
npm run start
npm run android
npm run build:android:apk
```

From the repository root:

```bash
npm run mobile:dev
npm run mobile:android
npm run mobile:apk
```

## Architecture Rules

- Backend remains the source of truth.
- The mobile client does not decide critical business transitions.
- Status changes use atomic backend endpoints.
- Offline actions are queued and retried; the UI must show pending/synced/failed states.
